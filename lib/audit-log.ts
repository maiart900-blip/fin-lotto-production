import { createClient } from '@/lib/supabase/server';

export type KnownAuditAction =
  | 'login' | 'logout' | 'register'
  | 'topup_request' | 'topup_approve' | 'topup_reject'
  | 'withdraw_request' | 'withdraw_approve' | 'withdraw_reject'
  | 'bet_place' | 'bet_cancel' | 'bet_win'
  | 'credit_add' | 'credit_subtract' | 'credit_adjust'
  | 'customer_create' | 'customer_update' | 'customer_suspend' | 'customer_activate'
  | 'lottery_create' | 'lottery_update' | 'lottery_delete'
  | 'result_submit' | 'result_process'
  | 'promotion_create' | 'promotion_update' | 'promotion_claim'
  | 'settings_update' | 'admin_create' | 'admin_update' | 'permission_change'
  | 'security_event' | '2fa_enable' | '2fa_disable' | 'ip_block' | 'account_lock';

// Keep autocomplete for known actions, while allowing newer/legacy audit actions
// used by other routes in the system.
export type AuditAction = KnownAuditAction | (string & {});

interface AuditLogParams {
  action: AuditAction;
  userId?: string;
  customerId?: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const supabase = await createClient();

    await supabase.from('audit_logs').insert({
      user_id: params.userId,
      customer_id: params.customerId,
      action: params.action,
      target_id: params.targetId,
      target_type: params.targetType,
      details: params.details,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      old_value: params.oldValue ? JSON.stringify(params.oldValue) : null,
      new_value: params.newValue ? JSON.stringify(params.newValue) : null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw - audit logs shouldn't break the main operation
  }
}

// Helper to extract IP from request headers
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}

// Helper to extract user agent
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}