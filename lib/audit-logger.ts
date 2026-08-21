/**
 * MASTER AUDIT LOG SYSTEM - Enhanced
 * ====================================
 * Records all admin/agent actions for fraud prevention
 * Supports risk scoring, categorization, and suspicious activity detection
 * 
 * PR 1.2: Comprehensive Audit Trail
 */

import { headers } from 'next/headers';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// Service client for background operations (outside request scope)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, serviceKey);
}

// =====================================================
// TYPES
// =====================================================

export type AuditCategory = 
  | 'auth'       // Authentication events
  | 'data'       // Data changes (CRUD)
  | 'admin'      // Administrative actions
  | 'financial'  // Money-related operations
  | 'system'     // System configuration
  | 'security';  // Security events

export type AuditSeverity = 
  | 'debug'    // Development only
  | 'info'     // Normal operations
  | 'warning'  // Unusual but not critical
  | 'high'     // Legacy compatibility: high severity
  | 'error'    // Errors that need attention
  | 'critical'; // Immediate attention required

export type KnownAuditAction =
  // Authentication
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | 'session_expired'
  | 'token_refresh'

  // User Management
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'user_suspend'
  | 'user_activate'
  | 'role_change'
  | 'credit_adjust'
  | 'permission_change'

  // Wallet Operations
  | 'wallet_deposit'
  | 'wallet_withdraw'
  | 'wallet_transfer'
  | 'wallet_adjustment'
  | 'wallet_freeze'
  | 'wallet_unfreeze'

  // Betting Operations
  | 'bet_place'
  | 'bet_cancel'
  | 'bet_void'
  | 'bet_settle'
  | 'bet_refund'

  // Lottery Management
  | 'lottery_create'
  | 'lottery_update'
  | 'rate_change'
  | 'round_open'
  | 'round_close'
  | 'result_input'
  | 'result_confirm'

  // Risk & Limits
  | 'limit_create'
  | 'limit_update'
  | 'limit_delete'
  | 'emergency_stop'
  | 'threshold_breach'

  // Security
  | 'rate_limited'
  | 'access_denied'
  | 'suspicious_activity'
  | 'ip_blocked'

  // System
  | 'config_change'
  | 'maintenance_mode'
  | 'backup'
  | 'export_data'
  | 'migration_run';

// Keep known values for autocomplete, but allow legacy/new route actions
// such as admin_withdraw_request, freeze_balance, workflow_approve,
// bet_hold, bet_unhold, clear_all_data, backup_restore, agent_credit_xxx, etc.
export type AuditAction = KnownAuditAction | (string & {});

export type ActorType = 'user' | 'agent' | 'system' | 'api' | 'customer' | 'admin' | (string & {});

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogEntry {
  // Core fields
  userId?: string;
  action: AuditAction;

  // Compatibility aliases used by some API routes
  actor_id?: string;
  actor_type?: ActorType;
  
  // Context
  actorType?: ActorType;
  category?: AuditCategory;
  severity?: AuditSeverity;
  
  // Target
  tableName?: string;
  recordId?: string;
  targetId?: string;
  target_id?: string;
  targetType?: string;
  target_type?: string;

  // Legacy compatibility aliases used by older services/routes
  resource?: string;
  resourceId?: string;
  resourceType?: string;
  entityType?: string;
  entityId?: string;
  
  // Change tracking
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  
  // Request context
  ipAddress?: string;
  ip_address?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  
  // Multi-tenant
  tenantId?: string;
  branchId?: string;
  customerId?: string;
  
  // Risk assessment
  riskLevel?: RiskLevel;
  isSuspicious?: boolean;
  
  // Performance
  durationMs?: number;
  
  // Additional data
  description?: string;
  details?: Record<string, unknown>;
  oldValues?: unknown;
  newValues?: unknown;
  performedBy?: string;
  performerName?: string;
  performerRole?: string;
  metadata?: Record<string, unknown>;
}

// Action to category/severity mapping
const ACTION_CONFIG: Record<KnownAuditAction, { category: AuditCategory; severity: AuditSeverity }> = {
  // Auth
  login: { category: 'auth', severity: 'info' },
  logout: { category: 'auth', severity: 'info' },
  login_failed: { category: 'auth', severity: 'warning' },
  password_change: { category: 'auth', severity: 'warning' },
  session_expired: { category: 'auth', severity: 'info' },
  token_refresh: { category: 'auth', severity: 'debug' },
  
  // User management
  user_create: { category: 'admin', severity: 'info' },
  user_update: { category: 'admin', severity: 'info' },
  user_delete: { category: 'admin', severity: 'warning' },
  user_suspend: { category: 'admin', severity: 'warning' },
  user_activate: { category: 'admin', severity: 'info' },
  role_change: { category: 'admin', severity: 'warning' },
  credit_adjust: { category: 'financial', severity: 'warning' },
  permission_change: { category: 'admin', severity: 'warning' },
  
  // Wallet
  wallet_deposit: { category: 'financial', severity: 'info' },
  wallet_withdraw: { category: 'financial', severity: 'warning' },
  wallet_transfer: { category: 'financial', severity: 'info' },
  wallet_adjustment: { category: 'financial', severity: 'warning' },
  wallet_freeze: { category: 'financial', severity: 'warning' },
  wallet_unfreeze: { category: 'financial', severity: 'info' },
  
  // Betting
  bet_place: { category: 'data', severity: 'info' },
  bet_cancel: { category: 'data', severity: 'warning' },
  bet_void: { category: 'data', severity: 'warning' },
  bet_settle: { category: 'data', severity: 'info' },
  bet_refund: { category: 'financial', severity: 'warning' },
  
  // Lottery
  lottery_create: { category: 'admin', severity: 'info' },
  lottery_update: { category: 'admin', severity: 'info' },
  rate_change: { category: 'admin', severity: 'warning' },
  round_open: { category: 'data', severity: 'info' },
  round_close: { category: 'data', severity: 'info' },
  result_input: { category: 'data', severity: 'warning' },
  result_confirm: { category: 'data', severity: 'warning' },
  
  // Risk
  limit_create: { category: 'admin', severity: 'info' },
  limit_update: { category: 'admin', severity: 'info' },
  limit_delete: { category: 'admin', severity: 'warning' },
  emergency_stop: { category: 'security', severity: 'critical' },
  threshold_breach: { category: 'security', severity: 'warning' },
  
  // Security
  rate_limited: { category: 'security', severity: 'warning' },
  access_denied: { category: 'security', severity: 'warning' },
  suspicious_activity: { category: 'security', severity: 'error' },
  ip_blocked: { category: 'security', severity: 'warning' },
  
  // System
  config_change: { category: 'system', severity: 'warning' },
  maintenance_mode: { category: 'system', severity: 'warning' },
  backup: { category: 'system', severity: 'info' },
  export_data: { category: 'system', severity: 'warning' },
  migration_run: { category: 'system', severity: 'warning' },
};

// Risk scoring rules
interface RiskRule {
  actions: AuditAction[];
  condition?: (entry: AuditLogEntry) => boolean;
  riskLevel: RiskLevel;
}

const RISK_RULES: RiskRule[] = [
  // Critical
  { actions: ['emergency_stop'], riskLevel: 'critical' },
  { actions: ['suspicious_activity'], riskLevel: 'critical' },
  
  // High
  { actions: ['config_change', 'role_change', 'permission_change'], riskLevel: 'high' },
  { 
    actions: ['wallet_adjustment', 'wallet_withdraw'],
    condition: (e) => Math.abs(Number(e.newData?.amount) || 0) > 100000,
    riskLevel: 'high'
  },
  { 
    actions: ['credit_adjust'],
    condition: (e) => Math.abs(Number(e.newData?.amount) || 0) > 50000,
    riskLevel: 'high'
  },
  
  // Medium
  { actions: ['user_delete', 'user_suspend', 'rate_change', 'result_input'], riskLevel: 'medium' },
  { actions: ['login_failed', 'rate_limited', 'access_denied'], riskLevel: 'medium' },
  { actions: ['bet_void', 'bet_cancel', 'bet_refund'], riskLevel: 'medium' },
];

// =====================================================
// AUDIT LOGGER CLASS
// =====================================================

class AuditLogger {
  private static instance: AuditLogger;
  private buffer: AuditLogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 3000;
  private isServer = typeof window === 'undefined';

  private constructor() {
    if (this.isServer) {
      this.startPeriodicFlush();
    }
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Main logging method - use for custom entries
   */
  async log(entry: AuditLogEntry): Promise<void> {
    const enrichedEntry = await this.enrichEntry({ ...entry, userId: entry.userId || entry.actor_id || entry.performedBy || 'system' });
    const { riskLevel, isSuspicious } = this.calculateRisk(enrichedEntry);
    enrichedEntry.riskLevel = riskLevel;
    enrichedEntry.isSuspicious = isSuspicious;
    
    this.buffer.push(enrichedEntry);
    
    // Immediate flush for critical/high risk
    if (riskLevel === 'critical' || riskLevel === 'high' || enrichedEntry.severity === 'critical') {
      await this.flush();
    } else if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    userId: string,
    action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'session_expired',
    sessionId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      actorType: 'user',
      tableName: 'users',
      recordId: userId,
      sessionId,
      metadata,
    });
  }

  /**
   * Log data changes (CRUD operations)
   */
  async logData(
    userId: string,
    action: AuditAction,
    tableName: string,
    recordId: string,
    oldData?: Record<string, unknown>,
    newData?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      actorType: 'user',
      tableName,
      recordId,
      oldData,
      newData,
      metadata,
    });
  }

  /**
   * Log financial operations
   */
  async logFinancial(
    userId: string,
    action: 'wallet_deposit' | 'wallet_withdraw' | 'wallet_transfer' | 'wallet_adjustment' | 'credit_adjust',
    amount: number,
    walletId: string,
    balanceBefore: number,
    balanceAfter: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      actorType: 'user',
      tableName: 'wallets',
      recordId: walletId,
      oldData: { balance: balanceBefore },
      newData: { balance: balanceAfter, amount },
      metadata,
    });
  }

  /**
   * Log security events
   */
  async logSecurity(
    action: 'rate_limited' | 'access_denied' | 'suspicious_activity' | 'ip_blocked',
    userId: string,
    ipAddress: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      actorType: 'system',
      ipAddress,
      metadata,
    });
  }

  /**
   * Log administrative actions
   */
  async logAdmin(
    userId: string,
    action: AuditAction,
    targetTable: string,
    targetId: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action,
      actorType: 'user',
      tableName: targetTable,
      recordId: targetId,
      description,
      metadata,
    });
  }

  /**
   * Log system events
   */
  async logSystem(
    action: 'config_change' | 'maintenance_mode' | 'backup' | 'export_data' | 'migration_run',
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId: 'system',
      action,
      actorType: 'system',
      description,
      metadata,
    });
  }

  // Enrich entry with context
  private async enrichEntry(entry: AuditLogEntry): Promise<AuditLogEntry> {
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    try {
      const headersList = await headers();
      ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                  headersList.get('x-real-ip') || 
                  undefined;
      userAgent = headersList.get('user-agent') || undefined;
    } catch {
      // Headers not available
    }

    const config = ACTION_CONFIG[entry.action as KnownAuditAction] || { category: 'data', severity: 'info' };

    return {
      ...entry,
      ipAddress: entry.ipAddress || entry.ip_address || ipAddress,
      userAgent: entry.userAgent || userAgent,
      category: entry.category || config.category,
      severity: entry.severity || config.severity,
      actorType: entry.actorType || 'user',
      riskLevel: entry.riskLevel || 'low',
      isSuspicious: entry.isSuspicious || false,
    };
  }

  // Calculate risk level
  private calculateRisk(entry: AuditLogEntry): { riskLevel: RiskLevel; isSuspicious: boolean } {
    let maxRiskLevel: RiskLevel = 'low';
    let isSuspicious = false;
    const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

    for (const rule of RISK_RULES) {
      if (rule.actions.includes(entry.action)) {
        if (!rule.condition || rule.condition(entry)) {
          if (riskOrder.indexOf(rule.riskLevel) > riskOrder.indexOf(maxRiskLevel)) {
            maxRiskLevel = rule.riskLevel;
          }
          if (rule.riskLevel === 'high' || rule.riskLevel === 'critical') {
            isSuspicious = true;
          }
        }
      }
    }

    return { riskLevel: maxRiskLevel, isSuspicious };
  }

  // Flush buffer to database
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // Use service client for background flush (outside request scope)
      const supabase = getServiceClient();
      
      // Map entries to database format
      const dbEntries = entries.map(entry => ({
        user_id: (entry.userId === 'system' ? null : entry.userId) || entry.actor_id || entry.performedBy || null,
        customer_id: entry.customerId || null,
        action: entry.action,
        table_name:
          entry.tableName ||
          entry.targetType ||
          entry.target_type ||
          entry.resourceType ||
          entry.resource ||
          entry.entityType ||
          null,
        record_id:
          entry.recordId ||
          entry.targetId ||
          entry.target_id ||
          entry.resourceId ||
          entry.entityId ||
          null,
        old_data: entry.oldData || (entry.oldValues as Record<string, unknown> | undefined) || null,
        new_data: entry.newData || (entry.newValues as Record<string, unknown> | undefined) || null,
        ip_address: entry.ipAddress || entry.ip_address || null,
        user_agent: entry.userAgent || null,
        description: entry.description || null,
        // New enhanced fields
        actor_type: entry.actorType || entry.actor_type || 'user',
        session_id: entry.sessionId || null,
        tenant_id: entry.tenantId || null,
        branch_id: entry.branchId || null,
        severity: entry.severity === 'high' ? 'warning' : (entry.severity || 'info'),
        category: entry.category || 'general',
        duration_ms: entry.durationMs || null,
        request_id: entry.requestId || null,
        metadata: {
          ...(entry.metadata || {}),
          ...(entry.details ? { details: entry.details } : {}),
          ...(entry.performedBy ? { performed_by: entry.performedBy } : {}),
          ...(entry.performerName ? { performer_name: entry.performerName } : {}),
          ...(entry.performerRole ? { performer_role: entry.performerRole } : {}),
          risk_level: entry.riskLevel,
          is_suspicious: entry.isSuspicious,
        },
      }));

      const { error } = await supabase.from('audit_logs').insert(dbEntries);
      
      if (error) {
        console.error('[AuditLogger] Failed to insert logs:', error.message);
        // Re-add failed entries (up to buffer size)
        if (this.buffer.length < this.BUFFER_SIZE) {
          this.buffer = [...entries.slice(0, this.BUFFER_SIZE - this.buffer.length), ...this.buffer];
        }
      }
    } catch (error) {
      console.error('[AuditLogger] Flush error:', error);
      // Re-add on failure
      if (this.buffer.length < this.BUFFER_SIZE) {
        this.buffer = [...entries.slice(0, this.BUFFER_SIZE - this.buffer.length), ...this.buffer];
      }
    }
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  // Force flush and cleanup
  async destroy(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const auditLogger = AuditLogger.getInstance();

/**
 * Helper function for server components/actions
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  return auditLogger.log(entry);
}

/**
 * Backwards-compatible audit helper used by older modules.
 * Supports either a full AuditLogEntry object or (action, details).
 */
export async function logAuditEvent(
  entryOrAction: AuditLogEntry | string,
  details: Record<string, unknown> = {}
): Promise<void> {
  if (typeof entryOrAction === 'string') {
    await auditLogger.log({
      userId:
        typeof details.userId === 'string'
          ? details.userId
          : typeof details.actor_id === 'string'
            ? details.actor_id
            : 'system',
      action: entryOrAction,
      metadata: details,
    });
    return;
  }

  await auditLogger.log(entryOrAction);
}

/**
 * Decorator for auditing class methods
 */
export function Audited(action: AuditAction) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const startTime = Date.now();
      let result: unknown;
      let error: Error | null = null;

      try {
        result = await originalMethod.apply(this, args);
      } catch (e) {
        error = e as Error;
        throw e;
      } finally {
        await auditLogger.log({
          userId: (this as { userId?: string }).userId || 'system',
          action,
          durationMs: Date.now() - startTime,
          metadata: {
            success: !error,
            error: error?.message,
          },
        });
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Query helpers for audit log analysis
 */
export const auditQueries = {
  // Get recent high-risk events
  async getHighRiskEvents(limit = 50) {
    const supabase = await createServerClient();
    return supabase
      .from('audit_logs')
      .select('*')
      .or('severity.eq.critical,severity.eq.error')
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  // Get events by user
  async getByUser(userId: string, limit = 100) {
    const supabase = await createServerClient();
    return supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  // Get events by category
  async getByCategory(category: AuditCategory, limit = 100) {
    const supabase = await createServerClient();
    return supabase
      .from('audit_logs')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  // Get security events
  async getSecurityEvents(hours = 24) {
    const supabase = await createServerClient();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return supabase
      .from('audit_logs')
      .select('*')
      .eq('category', 'security')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
  },

  // Get failed login attempts by IP
  async getFailedLoginsByIP(ip: string, hours = 1) {
    const supabase = await createServerClient();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    return supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('action', 'login_failed')
      .eq('ip_address', ip)
      .gte('created_at', since);
  },
};