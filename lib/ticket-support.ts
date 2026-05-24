/**
 * Ticket Support System
 * ระบบส่งปัญหา/ร้องเรียน - สมาชิกส่งได้ แอดมินตอบในระบบ
 * Production Ready
 */

import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit-logger';
import { sendLineAlert } from '@/lib/notifications/line-notify';

// Ticket Types
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
export type TicketCategory = 
  | 'deposit'
  | 'withdraw'
  | 'bet'
  | 'result'
  | 'account'
  | 'promotion'
  | 'technical'
  | 'complaint'
  | 'suggestion'
  | 'other';

export interface Ticket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string;
  assignedToName?: string;
  attachments?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  rating?: number;
  feedback?: string;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userRole: 'customer' | 'admin' | 'system';
  content: string;
  attachments?: string[];
  isInternal: boolean;
  createdAt: string;
}

export interface CreateTicketInput {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  category: TicketCategory;
  subject: string;
  description: string;
  priority?: TicketPriority;
  attachments?: string[];
}

// Priority SLA (in hours)
const PRIORITY_SLA: Record<TicketPriority, number> = {
  urgent: 1,
  high: 4,
  medium: 24,
  low: 72,
};

// Category labels
const CATEGORY_LABELS: Record<TicketCategory, string> = {
  deposit: 'ปัญหาการฝากเงิน',
  withdraw: 'ปัญหาการถอนเงิน',
  bet: 'ปัญหาการแทงหวย',
  result: 'ปัญหาผลรางวัล',
  account: 'ปัญหาบัญชี',
  promotion: 'โปรโมชั่น/โบนัส',
  technical: 'ปัญหาทางเทคนิค',
  complaint: 'ร้องเรียน',
  suggestion: 'ข้อเสนอแนะ',
  other: 'อื่นๆ',
};

/**
 * Generate Ticket Number
 */
function generateTicketNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `TK${year}${month}${day}-${random}`;
}

/**
 * Auto-assign priority based on category
 */
function autoPriority(category: TicketCategory): TicketPriority {
  switch (category) {
    case 'deposit':
    case 'withdraw':
      return 'high';
    case 'complaint':
      return 'urgent';
    case 'bet':
    case 'result':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Create New Ticket
 */
export async function createTicket(input: CreateTicketInput): Promise<{
  success: boolean;
  ticket?: Ticket;
  error?: string;
}> {
  const supabase = await createClient();
  const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const ticketNumber = generateTicketNumber();
  const now = new Date().toISOString();
  const priority = input.priority || autoPriority(input.category);
  
  const ticket: Ticket = {
    id: ticketId,
    ticketNumber,
    customerId: input.customerId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    category: input.category,
    subject: input.subject,
    description: input.description,
    priority,
    status: 'open',
    attachments: input.attachments,
    createdAt: now,
    updatedAt: now,
  };
  
  const { error } = await supabase.from('support_tickets').insert({
    id: ticketId,
    ticket_number: ticketNumber,
    customer_id: input.customerId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    category: input.category,
    subject: input.subject,
    description: input.description,
    priority,
    status: 'open',
    attachments: input.attachments,
    created_at: now,
    updated_at: now,
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Send LINE notification for high priority
  if (priority === 'urgent' || priority === 'high') {
    await sendLineAlert('system_alert', `Ticket ใหม่ (${priority.toUpperCase()})`, {
      'เลขที่': ticketNumber,
      'หมวด': CATEGORY_LABELS[input.category],
      'หัวข้อ': input.subject,
      'ลูกค้า': input.customerName,
    });
  }
  
  // Auto-assign if urgent
  if (priority === 'urgent') {
    await autoAssignTicket(ticketId);
  }
  
  return { success: true, ticket };
}

/**
 * Auto-assign ticket to available admin
 */
async function autoAssignTicket(ticketId: string): Promise<void> {
  const supabase = await createClient();
  
  // Get admin with least open tickets
  const { data: admins } = await supabase
    .from('admin_users')
    .select(`
      id,
      display_name,
      support_tickets!support_tickets_assigned_to_fkey(id)
    `)
    .eq('is_active', true)
    .eq('role', 'support')
    .limit(10);
  
  if (!admins || admins.length === 0) return;
  
  // Find admin with least tickets
  const adminWithLeast = admins.reduce((min, admin) => {
    const ticketCount = Array.isArray(admin.support_tickets) ? admin.support_tickets.length : 0;
    const minCount = Array.isArray(min.support_tickets) ? min.support_tickets.length : 0;
    return ticketCount < minCount ? admin : min;
  }, admins[0]);
  
  await assignTicket(ticketId, adminWithLeast.id, adminWithLeast.display_name);
}

/**
 * Assign Ticket to Admin
 */
export async function assignTicket(
  ticketId: string,
  adminId: string,
  adminName: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('support_tickets')
    .update({
      assigned_to: adminId,
      assigned_to_name: adminName,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);
  
  if (error) return false;
  
  // Add system reply
  await addTicketReply({
    ticketId,
    userId: 'system',
    userName: 'System',
    userRole: 'system',
    content: `Ticket assigned to ${adminName}`,
    isInternal: true,
  });
  
  return true;
}

/**
 * Add Reply to Ticket
 */
export async function addTicketReply(input: {
  ticketId: string;
  userId: string;
  userName: string;
  userRole: 'customer' | 'admin' | 'system';
  content: string;
  attachments?: string[];
  isInternal?: boolean;
}): Promise<{ success: boolean; reply?: TicketReply; error?: string }> {
  const supabase = await createClient();
  const replyId = `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const reply: TicketReply = {
    id: replyId,
    ticketId: input.ticketId,
    userId: input.userId,
    userName: input.userName,
    userRole: input.userRole,
    content: input.content,
    attachments: input.attachments,
    isInternal: input.isInternal || false,
    createdAt: now,
  };
  
  const { error } = await supabase.from('ticket_replies').insert({
    id: replyId,
    ticket_id: input.ticketId,
    user_id: input.userId,
    user_name: input.userName,
    user_role: input.userRole,
    content: input.content,
    attachments: input.attachments,
    is_internal: input.isInternal || false,
    created_at: now,
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Update ticket status and timestamp
  const newStatus = input.userRole === 'admin' ? 'pending_customer' : 'in_progress';
  await supabase
    .from('support_tickets')
    .update({
      status: newStatus,
      updated_at: now,
    })
    .eq('id', input.ticketId);
  
  return { success: true, reply };
}

/**
 * Get Ticket by ID
 */
export async function getTicket(ticketId: string): Promise<Ticket | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    ticketNumber: data.ticket_number,
    customerId: data.customer_id,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    category: data.category,
    subject: data.subject,
    description: data.description,
    priority: data.priority,
    status: data.status,
    assignedTo: data.assigned_to,
    assignedToName: data.assigned_to_name,
    attachments: data.attachments,
    tags: data.tags,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    resolvedAt: data.resolved_at,
    closedAt: data.closed_at,
    rating: data.rating,
    feedback: data.feedback,
  };
}

/**
 * Get Ticket Replies
 */
export async function getTicketReplies(
  ticketId: string,
  includeInternal: boolean = false
): Promise<TicketReply[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('ticket_replies')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  
  if (!includeInternal) {
    query = query.eq('is_internal', false);
  }
  
  const { data } = await query;
  
  return (data || []).map(row => ({
    id: row.id,
    ticketId: row.ticket_id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    content: row.content,
    attachments: row.attachments,
    isInternal: row.is_internal,
    createdAt: row.created_at,
  }));
}

/**
 * Get Customer Tickets
 */
export async function getCustomerTickets(
  customerId: string,
  status?: TicketStatus[]
): Promise<Ticket[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('support_tickets')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  
  if (status && status.length > 0) {
    query = query.in('status', status);
  }
  
  const { data } = await query;
  
  return (data || []).map(row => ({
    id: row.id,
    ticketNumber: row.ticket_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    category: row.category,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    attachments: row.attachments,
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    rating: row.rating,
    feedback: row.feedback,
  }));
}

/**
 * Get All Tickets (Admin)
 */
export async function getAllTickets(options: {
  status?: TicketStatus[];
  priority?: TicketPriority[];
  category?: TicketCategory[];
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ tickets: Ticket[]; total: number }> {
  const supabase = await createClient();
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('support_tickets')
    .select('*', { count: 'exact' });
  
  if (options.status && options.status.length > 0) {
    query = query.in('status', options.status);
  }
  
  if (options.priority && options.priority.length > 0) {
    query = query.in('priority', options.priority);
  }
  
  if (options.category && options.category.length > 0) {
    query = query.in('category', options.category);
  }
  
  if (options.assignedTo) {
    query = query.eq('assigned_to', options.assignedTo);
  }
  
  if (options.search) {
    query = query.or(`subject.ilike.%${options.search}%,ticket_number.ilike.%${options.search}%,customer_name.ilike.%${options.search}%`);
  }
  
  const { data, count } = await query
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  return {
    tickets: (data || []).map(row => ({
      id: row.id,
      ticketNumber: row.ticket_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      category: row.category,
      subject: row.subject,
      description: row.description,
      priority: row.priority,
      status: row.status,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      attachments: row.attachments,
      tags: row.tags,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      closedAt: row.closed_at,
      rating: row.rating,
      feedback: row.feedback,
    })),
    total: count || 0,
  };
}

/**
 * Resolve Ticket
 */
export async function resolveTicket(
  ticketId: string,
  adminId: string,
  resolutionNote?: string
): Promise<boolean> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'resolved',
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', ticketId);
  
  if (error) return false;
  
  if (resolutionNote) {
    await addTicketReply({
      ticketId,
      userId: adminId,
      userName: 'Admin',
      userRole: 'admin',
      content: `Ticket resolved: ${resolutionNote}`,
      isInternal: true,
    });
  }
  
  await logAuditEvent({
    userId: adminId,
    action: 'ticket_resolved',
    targetType: 'ticket',
    targetId: ticketId,
    details: { resolutionNote },
  });
  
  return true;
}

/**
 * Close Ticket
 */
export async function closeTicket(
  ticketId: string,
  rating?: number,
  feedback?: string
): Promise<boolean> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'closed',
      closed_at: now,
      rating,
      feedback,
      updated_at: now,
    })
    .eq('id', ticketId);
  
  return !error;
}

/**
 * Reopen Ticket
 */
export async function reopenTicket(ticketId: string, reason: string): Promise<boolean> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('support_tickets')
    .update({
      status: 'open',
      resolved_at: null,
      closed_at: null,
      updated_at: now,
    })
    .eq('id', ticketId);
  
  if (error) return false;
  
  await addTicketReply({
    ticketId,
    userId: 'system',
    userName: 'System',
    userRole: 'system',
    content: `Ticket reopened: ${reason}`,
    isInternal: false,
  });
  
  return true;
}

/**
 * Get Ticket Statistics
 */
export async function getTicketStats(): Promise<{
  open: number;
  inProgress: number;
  pendingCustomer: number;
  resolved: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionRate: number;
}> {
  const supabase = await createClient();
  
  const [open, inProgress, pendingCustomer, resolved] = await Promise.all([
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'pending_customer'),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
  ]);
  
  // Calculate average resolution time (last 100 resolved tickets)
  const { data: resolvedTickets } = await supabase
    .from('support_tickets')
    .select('created_at, resolved_at')
    .eq('status', 'resolved')
    .not('resolved_at', 'is', null)
    .order('resolved_at', { ascending: false })
    .limit(100);
  
  let avgResolutionTime = 0;
  if (resolvedTickets && resolvedTickets.length > 0) {
    const totalTime = resolvedTickets.reduce((sum, t) => {
      const created = new Date(t.created_at).getTime();
      const resolved = new Date(t.resolved_at!).getTime();
      return sum + (resolved - created);
    }, 0);
    avgResolutionTime = Math.round(totalTime / resolvedTickets.length / 60000); // in minutes
  }
  
  // Calculate satisfaction rate
  const { data: ratedTickets } = await supabase
    .from('support_tickets')
    .select('rating')
    .not('rating', 'is', null);
  
  let satisfactionRate = 0;
  if (ratedTickets && ratedTickets.length > 0) {
    const goodRatings = ratedTickets.filter(t => t.rating >= 4).length;
    satisfactionRate = Math.round((goodRatings / ratedTickets.length) * 100);
  }
  
  return {
    open: open.count || 0,
    inProgress: inProgress.count || 0,
    pendingCustomer: pendingCustomer.count || 0,
    resolved: resolved.count || 0,
    avgResponseTime: 15, // TODO: Calculate from first reply time
    avgResolutionTime,
    satisfactionRate,
  };
}

/**
 * Get Overdue Tickets
 */
export async function getOverdueTickets(): Promise<Ticket[]> {
  const supabase = await createClient();
  const now = new Date();
  
  const { data: openTickets } = await supabase
    .from('support_tickets')
    .select('*')
    .in('status', ['open', 'in_progress'])
    .order('priority', { ascending: true });
  
  const overdueTickets = (openTickets || []).filter(ticket => {
    const createdAt = new Date(ticket.created_at);
    const slaHours = PRIORITY_SLA[ticket.priority as TicketPriority];
    const dueTime = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
    return now > dueTime;
  });
  
  return overdueTickets.map(row => ({
    id: row.id,
    ticketNumber: row.ticket_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    category: row.category,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name,
    attachments: row.attachments,
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    rating: row.rating,
    feedback: row.feedback,
  }));
}

// Export category labels
export { CATEGORY_LABELS };
