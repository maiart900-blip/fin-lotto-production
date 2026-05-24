/**
 * MASTER AUDIT LOG SYSTEM
 * ========================
 * Records all admin/agent actions for fraud prevention
 * Supports risk scoring and suspicious activity detection
 */

import { headers } from 'next/headers';

// =====================================================
// TYPES
// =====================================================

export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.password_change'
  | 'auth.session_expired'
  
  // User Management
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.suspend'
  | 'user.activate'
  | 'user.role_change'
  | 'user.credit_adjust'
  
  // Wallet Operations
  | 'wallet.deposit'
  | 'wallet.withdraw'
  | 'wallet.transfer'
  | 'wallet.adjustment'
  | 'wallet.freeze'
  | 'wallet.unfreeze'
  
  // Betting Operations
  | 'bet.place'
  | 'bet.cancel'
  | 'bet.void'
  | 'bet.settle'
  | 'bet.refund'
  
  // Site Management
  | 'site.create'
  | 'site.update'
  | 'site.suspend'
  | 'site.activate'
  | 'site.delete'
  | 'site.branding_update'
  
  // Lottery Management
  | 'lottery.create'
  | 'lottery.update'
  | 'lottery.rate_change'
  | 'lottery.round_open'
  | 'lottery.round_close'
  | 'lottery.result_input'
  | 'lottery.result_confirm'
  
  // Risk & Limits
  | 'limit.create'
  | 'limit.update'
  | 'limit.delete'
  | 'risk.emergency_stop'
  | 'risk.threshold_breach'
  
  // Settlements
  | 'settlement.create'
  | 'settlement.approve'
  | 'settlement.reject'
  | 'settlement.pay'
  
  // System
  | 'system.config_change'
  | 'system.maintenance_mode'
  | 'system.backup'
  | 'system.export_data';

export type EntityType =
  | 'user'
  | 'wallet'
  | 'bet'
  | 'site'
  | 'lottery'
  | 'round'
  | 'limit'
  | 'settlement'
  | 'system';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogEntry {
  id?: string;
  siteId?: string;
  userId: string;
  action: AuditAction;
  entityType?: EntityType;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  riskLevel?: RiskLevel;
  isSuspicious?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

// =====================================================
// RISK SCORING RULES
// =====================================================

interface RiskRule {
  action: AuditAction | AuditAction[];
  condition?: (entry: AuditLogEntry) => boolean;
  riskLevel: RiskLevel;
  description: string;
}

const RISK_RULES: RiskRule[] = [
  // Critical Actions
  {
    action: 'risk.emergency_stop',
    riskLevel: 'critical',
    description: 'Emergency stop triggered'
  },
  {
    action: 'system.config_change',
    riskLevel: 'high',
    description: 'System configuration changed'
  },
  {
    action: 'user.role_change',
    riskLevel: 'high',
    description: 'User role escalation'
  },
  
  // High Risk - Large amounts
  {
    action: 'wallet.adjustment',
    condition: (entry) => {
      const amount = Math.abs(Number(entry.newValues?.amount) || 0);
      return amount > 100000; // More than 100k
    },
    riskLevel: 'high',
    description: 'Large wallet adjustment'
  },
  {
    action: 'wallet.withdraw',
    condition: (entry) => {
      const amount = Number(entry.newValues?.amount) || 0;
      return amount > 500000; // More than 500k
    },
    riskLevel: 'high',
    description: 'Large withdrawal'
  },
  
  // Medium Risk
  {
    action: ['user.suspend', 'user.delete', 'site.suspend'],
    riskLevel: 'medium',
    description: 'Account/site suspension or deletion'
  },
  {
    action: 'lottery.rate_change',
    riskLevel: 'medium',
    description: 'Payout rate modified'
  },
  {
    action: 'lottery.result_input',
    riskLevel: 'medium',
    description: 'Lottery result entered'
  },
  
  // Suspicious Patterns
  {
    action: 'auth.login_failed',
    condition: (entry) => {
      // Multiple failed logins would be tracked separately
      return true;
    },
    riskLevel: 'medium',
    description: 'Failed login attempt'
  },
];

// =====================================================
// AUDIT LOGGER CLASS
// =====================================================

class AuditLogger {
  private static instance: AuditLogger;
  private buffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;

  private constructor() {
    // Start periodic flush
    if (typeof window === 'undefined') {
      this.startPeriodicFlush();
    }
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  // Main logging method
  async log(entry: AuditLogEntry): Promise<void> {
    // Enrich entry
    const enrichedEntry = await this.enrichEntry(entry);
    
    // Calculate risk
    const { riskLevel, isSuspicious } = this.calculateRisk(enrichedEntry);
    enrichedEntry.riskLevel = riskLevel;
    enrichedEntry.isSuspicious = isSuspicious;
    
    // Add to buffer
    this.buffer.push(enrichedEntry);
    
    // Immediate flush for high-risk entries
    if (riskLevel === 'critical' || riskLevel === 'high') {
      await this.flush();
    } else if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  // Convenience methods for common actions
  async logAuth(
    userId: string,
    action: 'login' | 'logout' | 'login_failed' | 'password_change',
    siteId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      siteId,
      action: `auth.${action}` as AuditAction,
      entityType: 'user',
      entityId: userId,
      metadata
    });
  }

  async logWallet(
    userId: string,
    action: 'deposit' | 'withdraw' | 'transfer' | 'adjustment' | 'freeze' | 'unfreeze',
    walletId: string,
    amount: number,
    balanceBefore: number,
    balanceAfter: number,
    siteId?: string,
    performedBy?: string,
    reason?: string
  ): Promise<void> {
    await this.log({
      userId,
      siteId,
      action: `wallet.${action}` as AuditAction,
      entityType: 'wallet',
      entityId: walletId,
      oldValues: { balance: balanceBefore },
      newValues: { 
        balance: balanceAfter, 
        amount,
        performedBy,
        reason
      }
    });
  }

  async logBet(
    userId: string,
    action: 'place' | 'cancel' | 'void' | 'settle' | 'refund',
    betId: string,
    siteId: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      siteId,
      action: `bet.${action}` as AuditAction,
      entityType: 'bet',
      entityId: betId,
      newValues: details
    });
  }

  async logSite(
    userId: string,
    action: 'create' | 'update' | 'suspend' | 'activate' | 'delete' | 'branding_update',
    siteId: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action: `site.${action}` as AuditAction,
      entityType: 'site',
      entityId: siteId,
      oldValues,
      newValues
    });
  }

  async logLottery(
    userId: string,
    action: 'create' | 'update' | 'rate_change' | 'round_open' | 'round_close' | 'result_input' | 'result_confirm',
    lotteryId: string,
    siteId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      siteId,
      action: `lottery.${action}` as AuditAction,
      entityType: 'lottery',
      entityId: lotteryId,
      newValues: details
    });
  }

  async logRisk(
    userId: string,
    action: 'emergency_stop' | 'threshold_breach',
    siteId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      siteId,
      action: `risk.${action}` as AuditAction,
      entityType: 'system',
      newValues: details
    });
  }

  async logSystem(
    userId: string,
    action: 'config_change' | 'maintenance_mode' | 'backup' | 'export_data',
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId,
      action: `system.${action}` as AuditAction,
      entityType: 'system',
      newValues: details
    });
  }

  // Enrich entry with request context
  private async enrichEntry(entry: AuditLogEntry): Promise<AuditLogEntry> {
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    try {
      const headersList = await headers();
      ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || 
                  headersList.get('x-real-ip') || 
                  undefined;
      userAgent = headersList.get('user-agent') || undefined;
    } catch {
      // Headers not available (client-side or test)
    }

    return {
      ...entry,
      id: crypto.randomUUID(),
      ipAddress: entry.ipAddress || ipAddress,
      userAgent: entry.userAgent || userAgent,
      createdAt: new Date(),
      riskLevel: entry.riskLevel || 'low',
      isSuspicious: entry.isSuspicious || false
    };
  }

  // Calculate risk level based on rules
  private calculateRisk(entry: AuditLogEntry): { riskLevel: RiskLevel; isSuspicious: boolean } {
    let maxRiskLevel: RiskLevel = 'low';
    let isSuspicious = false;

    for (const rule of RISK_RULES) {
      const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
      
      if (actions.includes(entry.action)) {
        // Check condition if exists
        if (!rule.condition || rule.condition(entry)) {
          // Update max risk level
          const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
          if (riskOrder.indexOf(rule.riskLevel) > riskOrder.indexOf(maxRiskLevel)) {
            maxRiskLevel = rule.riskLevel;
          }
          
          // Mark suspicious if high or critical
          if (rule.riskLevel === 'high' || rule.riskLevel === 'critical') {
            isSuspicious = true;
          }
        }
      }
    }

    return { riskLevel: maxRiskLevel, isSuspicious };
  }

  // Flush buffer to database
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // In production, this would insert into database
      // For now, we'll use the API endpoint
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries })
      });
    } catch (error) {
      console.error('[AuditLogger] Failed to flush logs:', error);
      // Re-add failed entries to buffer
      this.buffer = [...entries, ...this.buffer];
    }
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  // Cleanup
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const auditLogger = AuditLogger.getInstance();

// Helper function for server components/actions
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  return auditLogger.log(entry);
}

// Decorator for auditing class methods
export function Audited(action: AuditAction, entityType?: EntityType) {
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
        // Log the action
        await auditLogger.log({
          userId: (this as { userId?: string }).userId || 'system',
          action,
          entityType,
          metadata: {
            args: args.length > 0 ? args : undefined,
            duration: Date.now() - startTime,
            success: !error,
            error: error?.message
          }
        });
      }

      return result;
    };

    return descriptor;
  };
}
