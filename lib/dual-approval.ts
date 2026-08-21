/**
 * Dual Approval System (ข้อ 78)
 * ระบบสิทธิ์อนุมัติ 2 ชั้น
 * - ถอนยอดใหญ่ต้องให้ Super Admin อนุมัติ
 * - แก้ยอดต้องยืนยัน 2 คน
 */

import { createClient } from '@/lib/supabase/server';
import { auditLogger } from '@/lib/audit-logger';
import { sendLineAlert } from '@/lib/notifications/line-notify';

// =============================================
// TYPES
// =============================================

export type ApprovalType = 
  | 'large_withdrawal'      // ถอนยอดใหญ่
  | 'balance_adjustment'    // แก้ไขยอดเงิน
  | 'rate_modification'     // แก้ไขอัตราจ่าย
  | 'customer_deletion'     // ลบลูกค้า
  | 'agent_commission'      // แก้ค่าคอมเอเย่นต์
  | 'system_config'         // แก้ไขระบบ
  | 'data_export'           // Export ข้อมูลสำคัญ
  | 'emergency_action';     // การกระทำฉุกเฉิน

export type ApprovalStatus = 'pending' | 'first_approved' | 'approved' | 'rejected' | 'expired';

export interface ApprovalRequest {
  id?: string;
  type: ApprovalType;
  title: string;
  description: string;
  resource_type: string;
  resource_id: string;
  action_data: Record<string, unknown>;
  
  // Request info
  requested_by: string;
  requested_by_name?: string;
  requested_at: string;
  reason: string;
  
  // Amount (if applicable)
  amount?: number;
  
  // Status
  status: ApprovalStatus;
  
  // First approval
  first_approved_by?: string;
  first_approved_by_name?: string;
  first_approved_at?: string;
  first_approval_notes?: string;
  
  // Final approval
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  approval_notes?: string;
  
  // Rejection
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  rejection_reason?: string;
  
  // Expiry
  expires_at: string;
  
  // Metadata
  ip_address?: string;
  user_agent?: string;
}

export interface ApprovalConfig {
  type: ApprovalType;
  name: string;
  description: string;
  requires_dual: boolean;
  min_amount_for_dual?: number;
  allowed_first_approvers: string[];  // roles
  allowed_final_approvers: string[];  // roles
  expiry_hours: number;
  notify_on_request: boolean;
  notify_on_approval: boolean;
}

// =============================================
// APPROVAL CONFIGURATIONS
// =============================================

const DEFAULT_CONFIGS: ApprovalConfig[] = [
  {
    type: 'large_withdrawal',
    name: 'ถอนเงินยอดใหญ่',
    description: 'การถอนเงินที่เกินกำหนด',
    requires_dual: true,
    min_amount_for_dual: 50000, // 50,000 บาท
    allowed_first_approvers: ['admin', 'manager'],
    allowed_final_approvers: ['super_admin'],
    expiry_hours: 24,
    notify_on_request: true,
    notify_on_approval: true,
  },
  {
    type: 'balance_adjustment',
    name: 'แก้ไขยอดเงิน',
    description: 'การปรับแก้ยอดเงินลูกค้า',
    requires_dual: true,
    min_amount_for_dual: 1000, // 1,000 บาท
    allowed_first_approvers: ['admin', 'manager'],
    allowed_final_approvers: ['super_admin', 'admin'],
    expiry_hours: 12,
    notify_on_request: true,
    notify_on_approval: true,
  },
  {
    type: 'rate_modification',
    name: 'แก้ไขอัตราจ่าย',
    description: 'การแก้ไขอัตราจ่ายหลังปิดรับ',
    requires_dual: true,
    allowed_first_approvers: ['admin'],
    allowed_final_approvers: ['super_admin'],
    expiry_hours: 6,
    notify_on_request: true,
    notify_on_approval: true,
  },
  {
    type: 'customer_deletion',
    name: 'ลบลูกค้า',
    description: 'การลบข้อมูลลูกค้า',
    requires_dual: true,
    allowed_first_approvers: ['admin', 'manager'],
    allowed_final_approvers: ['super_admin'],
    expiry_hours: 48,
    notify_on_request: true,
    notify_on_approval: true,
  },
  {
    type: 'agent_commission',
    name: 'แก้ค่าคอมเอเย่นต์',
    description: 'การปรับค่าคอมมิชชั่นเอเย่นต์',
    requires_dual: true,
    min_amount_for_dual: 10000,
    allowed_first_approvers: ['admin'],
    allowed_final_approvers: ['super_admin'],
    expiry_hours: 24,
    notify_on_request: true,
    notify_on_approval: false,
  },
  {
    type: 'system_config',
    name: 'แก้ไขระบบ',
    description: 'การแก้ไขการตั้งค่าระบบสำคัญ',
    requires_dual: true,
    allowed_first_approvers: ['super_admin'],
    allowed_final_approvers: ['super_admin'],
    expiry_hours: 2,
    notify_on_request: true,
    notify_on_approval: true,
  },
  {
    type: 'data_export',
    name: 'Export ข้อมูล',
    description: 'การ Export ข้อมูลสำคัญ',
    requires_dual: false,
    allowed_first_approvers: ['admin', 'manager'],
    allowed_final_approvers: ['super_admin'],
    expiry_hours: 1,
    notify_on_request: false,
    notify_on_approval: false,
  },
  {
    type: 'emergency_action',
    name: 'การกระทำฉุกเฉิน',
    description: 'การดำเนินการในสถานการณ์ฉุกเฉิน',
    requires_dual: true,
    allowed_first_approvers: ['super_admin'],
    allowed_final_approvers: ['super_admin'],
    expiry_hours: 1,
    notify_on_request: true,
    notify_on_approval: true,
  },
];

// =============================================
// DUAL APPROVAL SERVICE
// =============================================

export class DualApprovalService {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  private configs: Map<ApprovalType, ApprovalConfig> = new Map();

  constructor() {
    // Load default configs
    DEFAULT_CONFIGS.forEach(config => {
      this.configs.set(config.type, config);
    });
  }

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  /**
   * ตรวจสอบว่าต้องใช้ Dual Approval หรือไม่
   */
  requiresDualApproval(type: ApprovalType, amount?: number): boolean {
    const config = this.configs.get(type);
    if (!config) return false;

    if (!config.requires_dual) return false;

    if (config.min_amount_for_dual && amount) {
      return amount >= config.min_amount_for_dual;
    }

    return config.requires_dual;
  }

  /**
   * สร้างคำขออนุมัติ
   */
  async createRequest(
    type: ApprovalType,
    data: {
      title: string;
      description: string;
      resourceType: string;
      resourceId: string;
      actionData: Record<string, unknown>;
      requestedBy: string;
      requestedByName: string;
      reason: string;
      amount?: number;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<{ success: boolean; requestId?: string; message: string }> {
    const supabase = await this.getClient();
    const config = this.configs.get(type);

    if (!config) {
      return { success: false, message: 'ไม่พบการตั้งค่าสำหรับประเภทนี้' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.expiry_hours * 60 * 60 * 1000);

    const request: ApprovalRequest = {
      type,
      title: data.title,
      description: data.description,
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      action_data: data.actionData,
      requested_by: data.requestedBy,
      requested_by_name: data.requestedByName,
      requested_at: now.toISOString(),
      reason: data.reason,
      amount: data.amount,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
    };

    const { data: saved, error } = await supabase
      .from('approval_requests')
      .insert(request)
      .select()
      .single();

    if (error || !saved) {
      return { success: false, message: 'ไม่สามารถสร้างคำขอได้' };
    }

    // Log
    await auditLogger.log({
      action: 'APPROVAL_REQUEST_CREATED',
      targetType: 'approval_request',
      targetId: saved.id,
      userId: data.requestedBy,
      metadata: {
        type,
        amount: data.amount,
        resource_type: data.resourceType,
        resource_id: data.resourceId,
      },
    });

    // Notify
    if (config.notify_on_request) {
      await sendLineAlert('system_alert', `คำขออนุมัติใหม่: ${config.name}`, {
        'รายการ': data.title,
        'จำนวน': data.amount ? `${data.amount.toLocaleString()} บาท` : '-',
        'ผู้ขอ': data.requestedByName,
        'เหตุผล': data.reason,
        'หมดอายุ': expiresAt.toLocaleString('th-TH'),
      });
    }

    return {
      success: true,
      requestId: saved.id,
      message: config.requires_dual 
        ? 'สร้างคำขอสำเร็จ รออนุมัติ 2 ชั้น'
        : 'สร้างคำขอสำเร็จ รออนุมัติ',
    };
  }

  /**
   * อนุมัติครั้งแรก (First Approval)
   */
  async firstApprove(
    requestId: string,
    approvedBy: string,
    approverName: string,
    approverRole: string,
    notes?: string
  ): Promise<{ success: boolean; message: string; nextStep?: string }> {
    const supabase = await this.getClient();

    // Get request
    const { data: request } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (!request) {
      return { success: false, message: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' };
    }

    // Check expiry
    if (new Date(request.expires_at) < new Date()) {
      await this.markExpired(requestId);
      return { success: false, message: 'คำขอหมดอายุแล้ว' };
    }

    // Check permission
    const config = this.configs.get(request.type as ApprovalType);
    if (!config?.allowed_first_approvers.includes(approverRole)) {
      return { success: false, message: 'คุณไม่มีสิทธิ์อนุมัติขั้นแรก' };
    }

    // Cannot approve own request
    if (request.requested_by === approvedBy) {
      return { success: false, message: 'ไม่สามารถอนุมัติคำขอของตนเองได้' };
    }

    const now = new Date().toISOString();

    // If dual approval required
    if (config?.requires_dual) {
      await supabase
        .from('approval_requests')
        .update({
          status: 'first_approved',
          first_approved_by: approvedBy,
          first_approved_by_name: approverName,
          first_approved_at: now,
          first_approval_notes: notes,
        })
        .eq('id', requestId);

      await auditLogger.log({
        action: 'APPROVAL_FIRST_APPROVED',
        targetType: 'approval_request',
        targetId: requestId,
        userId: approvedBy,
        metadata: { notes },
      });

      return {
        success: true,
        message: 'อนุมัติขั้นแรกสำเร็จ รออนุมัติขั้นสุดท้าย',
        nextStep: 'รอ Super Admin อนุมัติ',
      };
    }

    // Single approval - complete immediately
    return await this.finalApprove(requestId, approvedBy, approverName, approverRole, notes);
  }

  /**
   * อนุมัติขั้นสุดท้าย (Final Approval)
   */
  async finalApprove(
    requestId: string,
    approvedBy: string,
    approverName: string,
    approverRole: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    const supabase = await this.getClient();

    // Get request
    const { data: request } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', requestId)
      .in('status', ['pending', 'first_approved'])
      .single();

    if (!request) {
      return { success: false, message: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' };
    }

    // Check expiry
    if (new Date(request.expires_at) < new Date()) {
      await this.markExpired(requestId);
      return { success: false, message: 'คำขอหมดอายุแล้ว' };
    }

    // Check permission
    const config = this.configs.get(request.type as ApprovalType);
    if (!config?.allowed_final_approvers.includes(approverRole)) {
      return { success: false, message: 'คุณไม่มีสิทธิ์อนุมัติขั้นสุดท้าย' };
    }

    // Cannot be same as first approver
    if (config?.requires_dual && request.first_approved_by === approvedBy) {
      return { success: false, message: 'ผู้อนุมัติขั้นสุดท้ายต้องเป็นคนละคนกับขั้นแรก' };
    }

    // Cannot approve own request
    if (request.requested_by === approvedBy) {
      return { success: false, message: 'ไม่สามารถอนุมัติคำขอของตนเองได้' };
    }

    const now = new Date().toISOString();

    await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_by_name: approverName,
        approved_at: now,
        approval_notes: notes,
      })
      .eq('id', requestId);

    await auditLogger.log({
      action: 'APPROVAL_COMPLETED',
      targetType: 'approval_request',
      targetId: requestId,
      userId: approvedBy,
      metadata: {
        type: request.type,
        resource_type: request.resource_type,
        resource_id: request.resource_id,
        amount: request.amount,
        notes,
      },
    });

    // Notify
    if (config?.notify_on_approval) {
      await sendLineAlert('system_alert', `คำขออนุมัติสำเร็จ: ${config.name}`, {
        'รายการ': request.title,
        'จำนวน': request.amount ? `${request.amount.toLocaleString()} บาท` : '-',
        'ผู้ขอ': request.requested_by_name,
        'อนุมัติโดย': approverName,
      });
    }

    return { success: true, message: 'อนุมัติสำเร็จ' };
  }

  /**
   * ปฏิเสธคำขอ
   */
  async reject(
    requestId: string,
    rejectedBy: string,
    rejectorName: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const supabase = await this.getClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        rejected_by: rejectedBy,
        rejected_by_name: rejectorName,
        rejected_at: now,
        rejection_reason: reason,
      })
      .eq('id', requestId)
      .in('status', ['pending', 'first_approved']);

    if (!error) {
      await auditLogger.log({
        action: 'APPROVAL_REJECTED',
        targetType: 'approval_request',
        targetId: requestId,
        userId: rejectedBy,
        metadata: { reason },
      });

      return { success: true, message: 'ปฏิเสธคำขอสำเร็จ' };
    }

    return { success: false, message: 'ไม่สามารถปฏิเสธคำขอได้' };
  }

  /**
   * Mark request as expired
   */
  private async markExpired(requestId: string): Promise<void> {
    const supabase = await this.getClient();

    await supabase
      .from('approval_requests')
      .update({ status: 'expired' })
      .eq('id', requestId);

    await auditLogger.log({
      action: 'APPROVAL_EXPIRED',
      targetType: 'approval_request',
      targetId: requestId,
    });
  }

  /**
   * ดึงคำขอที่รออนุมัติ
   */
  async getPendingRequests(approverRole?: string): Promise<ApprovalRequest[]> {
    const supabase = await this.getClient();

    let query = supabase
      .from('approval_requests')
      .select('*')
      .in('status', ['pending', 'first_approved'])
      .gt('expires_at', new Date().toISOString())
      .order('requested_at', { ascending: false });

    const { data } = await query;

    // Filter by role if provided
    if (approverRole && data) {
      return data.filter(req => {
        const config = this.configs.get(req.type as ApprovalType);
        if (!config) return false;

        if (req.status === 'pending') {
          return config.allowed_first_approvers.includes(approverRole);
        } else if (req.status === 'first_approved') {
          return config.allowed_final_approvers.includes(approverRole);
        }
        return false;
      });
    }

    return data || [];
  }

  /**
   * ดึงประวัติคำขอ
   */
  async getRequestHistory(
    filters?: {
      type?: ApprovalType;
      status?: ApprovalStatus;
      requestedBy?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<ApprovalRequest[]> {
    const supabase = await this.getClient();

    let query = supabase
      .from('approval_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.requestedBy) query = query.eq('requested_by', filters.requestedBy);
    if (filters?.fromDate) query = query.gte('requested_at', filters.fromDate);
    if (filters?.toDate) query = query.lte('requested_at', filters.toDate);

    const { data } = await query.limit(100);

    return data || [];
  }

  /**
   * ตรวจสอบสถานะคำขอ
   */
  async getRequestStatus(requestId: string): Promise<ApprovalRequest | null> {
    const supabase = await this.getClient();

    const { data } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    return data;
  }

  /**
   * ดึง config ของประเภทการอนุมัติ
   */
  getConfig(type: ApprovalType): ApprovalConfig | undefined {
    return this.configs.get(type);
  }

  /**
   * อัปเดต config
   */
  async updateConfig(type: ApprovalType, updates: Partial<ApprovalConfig>): Promise<void> {
    const existing = this.configs.get(type);
    if (existing) {
      this.configs.set(type, { ...existing, ...updates });
    }
  }
}

// Export singleton
export const dualApproval = new DualApprovalService();