import { createClient } from '@/lib/supabase/server';

/**
 * Centralized Audit System
 * 
 * Production-ready logging system for tracking all financial and system changes
 * - Financial transactions (deposits, withdrawals, bets, payouts)
 * - System changes (settings, limits, blocked numbers)
 * - User actions (logins, permission changes)
 * - Security events (failed logins, suspicious activity)
 */

export type AuditCategory = 
  | 'financial'    // Money movements
  | 'betting'      // Bet-related actions
  | 'risk'         // Risk management actions
  | 'user'         // User account actions
  | 'system'       // System configuration
  | 'security'     // Security-related events
  | 'network';     // Network sync events

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogParams {
  action: string;
  category: AuditCategory;
  description: string;
  metadata?: Record<string, any>;
  user_id?: string;
  customer_id?: string;
  ip_address?: string;
  user_agent?: string;
  severity?: AuditSeverity;
  related_id?: string;
  related_type?: string;
}

export interface AuditLog extends AuditLogParams {
  id: string;
  created_at: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: AuditLogParams): Promise<AuditLog | null> {
  try {
    const supabase = await createClient();
    
    const logEntry = {
      action: params.action,
      category: params.category,
      description: params.description,
      metadata: params.metadata || {},
      user_id: params.user_id,
      customer_id: params.customer_id,
      ip_address: params.ip_address,
      user_agent: params.user_agent,
      severity: params.severity || 'info',
      related_id: params.related_id,
      related_type: params.related_type,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(logEntry)
      .select()
      .single();

    if (error) {
      console.error('Failed to create audit log:', error);
      return null;
    }

    // If critical severity, trigger alert
    if (params.severity === 'critical') {
      await triggerCriticalAlert(supabase, data);
    }

    return data;
  } catch (error) {
    console.error('Audit system error:', error);
    return null;
  }
}

/**
 * Log financial transaction
 */
export async function logFinancialTransaction(params: {
  type: 'deposit' | 'withdraw' | 'payout' | 'adjustment' | 'commission';
  amount: number;
  customer_id: string;
  customer_name?: string;
  before_balance?: number;
  after_balance?: number;
  reference_id?: string;
  performed_by?: string;
  notes?: string;
}): Promise<AuditLog | null> {
  const actionMap = {
    deposit: 'credit_deposit',
    withdraw: 'credit_withdraw',
    payout: 'credit_payout',
    adjustment: 'credit_adjustment',
    commission: 'credit_commission',
  };

  return createAuditLog({
    action: actionMap[params.type],
    category: 'financial',
    description: `${params.type}: ${params.amount.toLocaleString()} THB for ${params.customer_name || params.customer_id}`,
    metadata: {
      amount: params.amount,
      customer_id: params.customer_id,
      customer_name: params.customer_name,
      before_balance: params.before_balance,
      after_balance: params.after_balance,
      reference_id: params.reference_id,
      notes: params.notes,
    },
    customer_id: params.customer_id,
    user_id: params.performed_by,
    severity: params.amount >= 100000 ? 'warning' : 'info',
  });
}

/**
 * Log betting activity
 */
export async function logBettingActivity(params: {
  type: 'bet_placed' | 'bet_won' | 'bet_lost' | 'bet_refunded' | 'bet_blocked';
  customer_id: string;
  lottery_id: string;
  lottery_name?: string;
  numbers?: string[];
  amount?: number;
  payout?: number;
  reason?: string;
}): Promise<AuditLog | null> {
  return createAuditLog({
    action: params.type,
    category: 'betting',
    description: `${params.type}: ${params.lottery_name || params.lottery_id}${params.numbers ? ` [${params.numbers.join(', ')}]` : ''}`,
    metadata: params,
    customer_id: params.customer_id,
    related_id: params.lottery_id,
    related_type: 'lottery',
  });
}

/**
 * Log risk management action
 */
export async function logRiskAction(params: {
  type: 'number_blocked' | 'number_unblocked' | 'rate_reduced' | 'limit_set' | 'limit_removed';
  number?: string;
  bet_type?: string;
  old_value?: any;
  new_value?: any;
  reason?: string;
  performed_by?: string;
  broadcast_to_network?: boolean;
}): Promise<AuditLog | null> {
  return createAuditLog({
    action: params.type,
    category: 'risk',
    description: `${params.type}: ${params.number || 'global'}${params.bet_type ? ` (${params.bet_type})` : ''}`,
    metadata: params,
    user_id: params.performed_by,
    severity: params.type === 'number_blocked' ? 'warning' : 'info',
  });
}

/**
 * Log security event
 */
export async function logSecurityEvent(params: {
  type: 'login_success' | 'login_failed' | 'logout' | 'password_changed' | 
        'permission_changed' | 'suspicious_activity' | 'ip_blocked' | 'session_expired';
  user_id?: string;
  customer_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: string;
  failed_attempts?: number;
}): Promise<AuditLog | null> {
  const severityMap: Record<string, AuditSeverity> = {
    login_failed: 'warning',
    suspicious_activity: 'critical',
    ip_blocked: 'warning',
    permission_changed: 'warning',
  };

  return createAuditLog({
    action: params.type,
    category: 'security',
    description: `${params.type}${params.details ? `: ${params.details}` : ''}`,
    metadata: params,
    user_id: params.user_id,
    customer_id: params.customer_id,
    ip_address: params.ip_address,
    user_agent: params.user_agent,
    severity: severityMap[params.type] || 'info',
  });
}

/**
 * Log system change
 */
export async function logSystemChange(params: {
  type: 'setting_changed' | 'lottery_created' | 'lottery_closed' | 
        'rate_updated' | 'agent_added' | 'agent_removed' | 'maintenance_mode';
  setting_key?: string;
  old_value?: any;
  new_value?: any;
  performed_by?: string;
  reason?: string;
}): Promise<AuditLog | null> {
  return createAuditLog({
    action: params.type,
    category: 'system',
    description: `${params.type}${params.setting_key ? `: ${params.setting_key}` : ''}`,
    metadata: params,
    user_id: params.performed_by,
    severity: params.type === 'maintenance_mode' ? 'warning' : 'info',
  });
}

/**
 * Log network sync event
 */
export async function logNetworkSync(params: {
  type: 'sync_pushed' | 'sync_received' | 'sync_failed';
  sync_type: string;
  target_sites?: number;
  success_count?: number;
  failed_sites?: string[];
  payload_summary?: string;
}): Promise<AuditLog | null> {
  return createAuditLog({
    action: params.type,
    category: 'network',
    description: `${params.type}: ${params.sync_type} to ${params.success_count || 0}/${params.target_sites || 0} sites`,
    metadata: params,
    severity: params.type === 'sync_failed' ? 'warning' : 'info',
  });
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(params: {
  category?: AuditCategory;
  action?: string;
  user_id?: string;
  customer_id?: string;
  severity?: AuditSeverity;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.category) query = query.eq('category', params.category);
    if (params.action) query = query.eq('action', params.action);
    if (params.user_id) query = query.eq('user_id', params.user_id);
    if (params.customer_id) query = query.eq('customer_id', params.customer_id);
    if (params.severity) query = query.eq('severity', params.severity);
    if (params.from_date) query = query.gte('created_at', params.from_date);
    if (params.to_date) query = query.lte('created_at', params.to_date);

    const limit = params.limit || 100;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      logs: data || [],
      total: count || 0,
    };
  } catch (error) {
    console.error('Query audit logs error:', error);
    return { logs: [], total: 0 };
  }
}

/**
 * Get audit summary statistics
 */
export async function getAuditSummary(params: {
  from_date?: string;
  to_date?: string;
}): Promise<{
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  by_action: Record<string, number>;
  total: number;
}> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('audit_logs')
      .select('category, severity, action');

    if (params.from_date) query = query.gte('created_at', params.from_date);
    if (params.to_date) query = query.lte('created_at', params.to_date);

    const { data, error } = await query;

    if (error) throw error;

    const logs = data || [];
    
    const by_category: Record<string, number> = {};
    const by_severity: Record<string, number> = {};
    const by_action: Record<string, number> = {};

    logs.forEach(log => {
      by_category[log.category] = (by_category[log.category] || 0) + 1;
      by_severity[log.severity] = (by_severity[log.severity] || 0) + 1;
      by_action[log.action] = (by_action[log.action] || 0) + 1;
    });

    return {
      by_category,
      by_severity,
      by_action,
      total: logs.length,
    };
  } catch (error) {
    console.error('Get audit summary error:', error);
    return { by_category: {}, by_severity: {}, by_action: {}, total: 0 };
  }
}

/**
 * Trigger critical alert (internal)
 */
async function triggerCriticalAlert(supabase: any, log: AuditLog) {
  try {
    // Insert into alerts table
    await supabase
      .from('system_alerts')
      .insert({
        type: 'critical_audit',
        title: `Critical: ${log.action}`,
        message: log.description,
        metadata: log.metadata,
        audit_log_id: log.id,
        created_at: new Date().toISOString(),
        status: 'unread',
      });

    // In production, also send:
    // - Push notification
    // - Email to admins
    // - SMS for critical security events
    // - Webhook to monitoring system

  } catch (error) {
    console.error('Failed to trigger critical alert:', error);
  }
}

/**
 * Bulk insert audit logs (for batch operations)
 */
export async function bulkCreateAuditLogs(logs: AuditLogParams[]): Promise<number> {
  try {
    const supabase = await createClient();
    
    const entries = logs.map(log => ({
      ...log,
      metadata: log.metadata || {},
      severity: log.severity || 'info',
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(entries)
      .select('id');

    if (error) throw error;

    return data?.length || 0;
  } catch (error) {
    console.error('Bulk audit log error:', error);
    return 0;
  }
}
