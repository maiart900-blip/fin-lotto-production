import { createClient } from '@/lib/supabase/server';

// Audit Log Helper
export async function createAuditLog(params: {
  userId: string;
  userRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  tenantId?: string;
}) {
  const supabase = await createClient();
  
  await supabase.from('audit_logs').insert({
    user_id: params.userId,
    user_role: params.userRole,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    old_data: params.oldData,
    new_data: params.newData,
    ip_address: params.ipAddress,
    tenant_id: params.tenantId,
  });
}

// Security Event Helper
export async function logSecurityEvent(params: {
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  tenantId?: string;
}) {
  const supabase = await createClient();
  
  await supabase.from('security_events').insert({
    event_type: params.eventType,
    severity: params.severity,
    description: params.description,
    user_id: params.userId,
    metadata: params.metadata,
    ip_address: params.ipAddress,
    tenant_id: params.tenantId,
  });
}

// Check Self-Approval
export async function checkSelfApproval(
  createdBy: string | null,
  approvedBy: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (createdBy && createdBy === approvedBy) {
    await logSecurityEvent({
      eventType: 'self_approval_attempt',
      severity: 'high',
      description: `User ${approvedBy} attempted to approve their own request`,
      userId: approvedBy,
    });
    
    return {
      allowed: false,
      reason: 'ไม่สามารถอนุมัติรายการที่ตัวเองสร้างได้',
    };
  }
  
  return { allowed: true };
}

// Check Approval Limits
export async function checkApprovalLimits(params: {
  userId: string;
  userRole: string;
  amount: number;
  type: 'topup' | 'withdraw';
  tenantId?: string;
}): Promise<{ allowed: boolean; reason?: string; requires2FA?: boolean; requiresSupervisor?: boolean }> {
  const supabase = await createClient();
  
  // Get approval limits for role
  const { data: limits } = await supabase
    .from('approval_limits')
    .select('*')
    .eq('role', params.userRole)
    .maybeSingle();

  if (!limits) {
    // Default limits if not configured
    const defaultLimits = {
      max_single_topup: 100000,
      max_single_withdraw: 50000,
      max_daily_topup: 1000000,
      max_daily_withdraw: 500000,
      requires_2fa_above: 50000,
      requires_supervisor_above: 100000,
    };
    
    const maxSingle = params.type === 'topup' 
      ? defaultLimits.max_single_topup 
      : defaultLimits.max_single_withdraw;
      
    if (params.amount > maxSingle) {
      return {
        allowed: false,
        reason: `จำนวนเงิน ${params.amount} เกินวงเงินอนุมัติ ${maxSingle} บาท`,
      };
    }
    
    return {
      allowed: true,
      requires2FA: params.amount > defaultLimits.requires_2fa_above,
      requiresSupervisor: params.amount > defaultLimits.requires_supervisor_above,
    };
  }

  // Check single transaction limit
  const maxSingle = params.type === 'topup' 
    ? limits.max_single_topup 
    : limits.max_single_withdraw;
    
  if (params.amount > maxSingle) {
    await logSecurityEvent({
      eventType: 'amount_manipulation',
      severity: 'medium',
      description: `Amount ${params.amount} exceeds single limit ${maxSingle}`,
      userId: params.userId,
      metadata: { amount: params.amount, limit: maxSingle, type: params.type },
    });
    
    return {
      allowed: false,
      reason: `จำนวนเงิน ${params.amount} เกินวงเงินอนุมัติต่อรายการ ${maxSingle} บาท`,
    };
  }

  // Check daily limit
  const { data: dailyTracking } = await supabase
    .from('daily_limits_tracking')
    .select('*')
    .eq('user_id', params.userId)
    .eq('tracking_date', new Date().toISOString().split('T')[0])
    .maybeSingle();

  const currentDaily = params.type === 'topup'
    ? (dailyTracking?.total_topup_approved || 0)
    : (dailyTracking?.total_withdraw_approved || 0);
    
  const maxDaily = params.type === 'topup'
    ? limits.max_daily_topup
    : limits.max_daily_withdraw;

  if (currentDaily + params.amount > maxDaily) {
    await logSecurityEvent({
      eventType: 'rate_limit_exceeded',
      severity: 'medium',
      description: `Daily limit exceeded: current ${currentDaily} + ${params.amount} > ${maxDaily}`,
      userId: params.userId,
      metadata: { currentDaily, amount: params.amount, maxDaily, type: params.type },
    });
    
    return {
      allowed: false,
      reason: `ยอดรวมรายวัน ${currentDaily + params.amount} เกินวงเงิน ${maxDaily} บาท`,
    };
  }

  return {
    allowed: true,
    requires2FA: params.amount > limits.requires_2fa_above,
    requiresSupervisor: params.amount > limits.requires_supervisor_above,
  };
}

// Update Daily Tracking
export async function updateDailyTracking(params: {
  userId: string;
  amount: number;
  type: 'topup' | 'withdraw';
  tenantId?: string;
}) {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('daily_limits_tracking')
    .select('*')
    .eq('user_id', params.userId)
    .eq('tracking_date', today)
    .maybeSingle();

  if (existing) {
    const updateData = params.type === 'topup'
      ? {
          total_topup_approved: (existing.total_topup_approved || 0) + params.amount,
          topup_count: (existing.topup_count || 0) + 1,
        }
      : {
          total_withdraw_approved: (existing.total_withdraw_approved || 0) + params.amount,
          withdraw_count: (existing.withdraw_count || 0) + 1,
        };

    await supabase
      .from('daily_limits_tracking')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase.from('daily_limits_tracking').insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      tracking_date: today,
      total_topup_approved: params.type === 'topup' ? params.amount : 0,
      total_withdraw_approved: params.type === 'withdraw' ? params.amount : 0,
      topup_count: params.type === 'topup' ? 1 : 0,
      withdraw_count: params.type === 'withdraw' ? 1 : 0,
    });
  }
}

// Log Sensitive Action
export async function logSensitiveAction(params: {
  actorId: string;
  actionType: string;
  targetUserId?: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  reason?: string;
  supervisorApprovedBy?: string;
  ipAddress?: string;
  tenantId?: string;
}) {
  const supabase = await createClient();
  
  await supabase.from('sensitive_actions_log').insert({
    actor_id: params.actorId,
    action_type: params.actionType,
    target_user_id: params.targetUserId,
    before_value: params.beforeValue,
    after_value: params.afterValue,
    reason: params.reason,
    supervisor_approved_by: params.supervisorApprovedBy,
    ip_address: params.ipAddress,
    tenant_id: params.tenantId,
  });
}

// Check for Duplicate Request
export async function checkDuplicateRequest(params: {
  customerId: string;
  amount: number;
  type: 'topup' | 'withdraw';
  withinMinutes?: number;
}): Promise<{ isDuplicate: boolean; existingId?: string }> {
  const supabase = await createClient();
  const table = params.type === 'topup' ? 'topup_requests' : 'withdraw_requests';
  const minutes = params.withinMinutes || 5;
  
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('customer_id', params.customerId)
    .eq('amount', params.amount)
    .gte('created_at', cutoffTime)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await logSecurityEvent({
      eventType: 'duplicate_request',
      severity: 'medium',
      description: `Duplicate ${params.type} request detected: ${params.amount} for customer ${params.customerId}`,
      metadata: { customerId: params.customerId, amount: params.amount, existingId: existing.id },
    });
    
    return { isDuplicate: true, existingId: existing.id };
  }

  return { isDuplicate: false };
}

// Validate Balance Change
export async function validateBalanceChange(params: {
  customerId: string;
  currentBalance: number;
  newBalance: number;
  changeAmount: number;
  actorId: string;
}): Promise<{ valid: boolean; reason?: string }> {
  const expectedBalance = params.currentBalance + params.changeAmount;
  
  if (Math.abs(expectedBalance - params.newBalance) > 0.01) {
    await logSecurityEvent({
      eventType: 'balance_mismatch',
      severity: 'critical',
      description: `Balance mismatch: expected ${expectedBalance}, got ${params.newBalance}`,
      userId: params.actorId,
      metadata: {
        customerId: params.customerId,
        currentBalance: params.currentBalance,
        changeAmount: params.changeAmount,
        expectedBalance,
        actualNewBalance: params.newBalance,
      },
    });
    
    return {
      valid: false,
      reason: 'ยอดเงินไม่ตรงกับที่คาดหวัง กรุณาตรวจสอบ',
    };
  }

  return { valid: true };
}
