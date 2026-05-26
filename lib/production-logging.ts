/**
 * PRODUCTION LOGGING SYSTEM
 * =========================
 * Tracks critical production metrics:
 * - Failed API requests
 * - Slow API requests (>2s)
 * - Settlement/Payout duration
 * - Login failures
 * - Betting spikes
 * - Worker failures
 */

import { createClient } from '@supabase/supabase-js';

// Service client for logging (outside request scope)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('[ProductionLog] Missing Supabase credentials');
    return null;
  }
  
  return createClient(supabaseUrl, serviceKey);
}

// =====================================================
// TYPES
// =====================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogCategory = 
  | 'api'
  | 'auth' 
  | 'settlement'
  | 'payout'
  | 'worker'
  | 'betting'
  | 'performance'
  | 'security';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  user_id?: string;
  request_id?: string;
  endpoint?: string;
  error?: string;
}

// =====================================================
// THRESHOLDS
// =====================================================

const THRESHOLDS = {
  SLOW_API_MS: 2000,           // 2 seconds
  SLOW_SETTLEMENT_MS: 30000,   // 30 seconds
  SLOW_PAYOUT_MS: 5000,        // 5 seconds
  BETTING_SPIKE_PER_MIN: 50,   // 50 bets per minute = spike
  LOGIN_FAILURE_THRESHOLD: 5,  // 5 failures in 5 min = alert
};

// =====================================================
// PRODUCTION LOGGER CLASS
// =====================================================

class ProductionLogger {
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 10000; // 10 seconds

  constructor() {
    // Auto-flush buffer periodically
    if (typeof setInterval !== 'undefined') {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, this.FLUSH_INTERVAL_MS);
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;
    
    const entries = [...this.buffer];
    this.buffer = [];
    
    try {
      const supabase = getServiceClient();
      if (!supabase) return;
      
      await supabase.from('production_logs').insert(
        entries.map(e => ({
          level: e.level,
          category: e.category,
          message: e.message,
          duration_ms: e.duration_ms,
          metadata: e.metadata,
          user_id: e.user_id,
          request_id: e.request_id,
          endpoint: e.endpoint,
          error_message: e.error,
          created_at: new Date().toISOString(),
        }))
      );
    } catch (err) {
      // Silently fail - don't crash app for logging issues
      console.error('[ProductionLog] Flush failed:', err);
    }
  }

  private log(entry: LogEntry) {
    // Always log to console in production for observability
    const prefix = `[${entry.category.toUpperCase()}]`;
    const msg = `${prefix} ${entry.message}`;
    
    switch (entry.level) {
      case 'critical':
      case 'error':
        console.error(msg, entry.metadata || '');
        break;
      case 'warn':
        console.warn(msg, entry.metadata || '');
        break;
      default:
        console.log(msg, entry.metadata || '');
    }

    // Buffer for DB persistence
    this.buffer.push(entry);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.BUFFER_SIZE) {
      this.flush();
    }
  }

  // ===== API LOGGING =====
  
  logApiRequest(endpoint: string, duration_ms: number, status: number, userId?: string) {
    const isError = status >= 400;
    const isSlow = duration_ms > THRESHOLDS.SLOW_API_MS;
    
    if (isError || isSlow) {
      this.log({
        level: isError ? 'error' : 'warn',
        category: 'api',
        message: isError 
          ? `API error: ${endpoint} returned ${status}` 
          : `Slow API: ${endpoint} took ${duration_ms}ms`,
        duration_ms,
        endpoint,
        user_id: userId,
        metadata: { status },
      });
    }
  }

  logApiError(endpoint: string, error: Error | string, userId?: string) {
    this.log({
      level: 'error',
      category: 'api',
      message: `API error: ${endpoint}`,
      endpoint,
      user_id: userId,
      error: error instanceof Error ? error.message : error,
      metadata: { stack: error instanceof Error ? error.stack : undefined },
    });
  }

  // ===== AUTH LOGGING =====
  
  logLoginFailure(username: string, reason: string, ip?: string) {
    this.log({
      level: 'warn',
      category: 'auth',
      message: `Login failed for ${username}: ${reason}`,
      metadata: { username, reason, ip },
    });
  }

  logLoginSuccess(userId: string, username: string) {
    this.log({
      level: 'info',
      category: 'auth',
      message: `Login success: ${username}`,
      user_id: userId,
      metadata: { username },
    });
  }

  // ===== SETTLEMENT LOGGING =====
  
  logSettlementStart(resultId: string, lotteryName: string) {
    this.log({
      level: 'info',
      category: 'settlement',
      message: `Settlement started: ${lotteryName}`,
      metadata: { result_id: resultId, lottery_name: lotteryName },
    });
  }

  logSettlementComplete(resultId: string, duration_ms: number, winners: number, totalPayout: number) {
    const isSlow = duration_ms > THRESHOLDS.SLOW_SETTLEMENT_MS;
    
    this.log({
      level: isSlow ? 'warn' : 'info',
      category: 'settlement',
      message: isSlow 
        ? `Slow settlement: ${duration_ms}ms for ${winners} winners`
        : `Settlement complete: ${winners} winners, ${totalPayout} THB`,
      duration_ms,
      metadata: { result_id: resultId, winners, total_payout: totalPayout },
    });
  }

  logSettlementError(resultId: string, error: Error | string) {
    this.log({
      level: 'critical',
      category: 'settlement',
      message: `Settlement FAILED: ${resultId}`,
      error: error instanceof Error ? error.message : error,
      metadata: { result_id: resultId },
    });
  }

  // ===== PAYOUT LOGGING =====
  
  logPayoutStart(entryId: string, customerId: string, amount: number) {
    this.log({
      level: 'info',
      category: 'payout',
      message: `Payout started: ${amount} THB to customer`,
      user_id: customerId,
      metadata: { entry_id: entryId, amount },
    });
  }

  logPayoutComplete(entryId: string, duration_ms: number) {
    const isSlow = duration_ms > THRESHOLDS.SLOW_PAYOUT_MS;
    
    this.log({
      level: isSlow ? 'warn' : 'info',
      category: 'payout',
      message: isSlow ? `Slow payout: ${duration_ms}ms` : `Payout complete`,
      duration_ms,
      metadata: { entry_id: entryId },
    });
  }

  logPayoutError(entryId: string, error: Error | string) {
    this.log({
      level: 'critical',
      category: 'payout',
      message: `Payout FAILED: ${entryId}`,
      error: error instanceof Error ? error.message : error,
      metadata: { entry_id: entryId },
    });
  }

  // ===== WORKER LOGGING =====
  
  logWorkerStart(workerType: string) {
    this.log({
      level: 'info',
      category: 'worker',
      message: `Worker started: ${workerType}`,
      metadata: { worker_type: workerType },
    });
  }

  logWorkerComplete(workerType: string, duration_ms: number, itemsProcessed: number) {
    this.log({
      level: 'info',
      category: 'worker',
      message: `Worker complete: ${workerType} processed ${itemsProcessed} items`,
      duration_ms,
      metadata: { worker_type: workerType, items_processed: itemsProcessed },
    });
  }

  logWorkerError(workerType: string, error: Error | string) {
    this.log({
      level: 'critical',
      category: 'worker',
      message: `Worker FAILED: ${workerType}`,
      error: error instanceof Error ? error.message : error,
      metadata: { worker_type: workerType },
    });
  }

  // ===== BETTING LOGGING =====
  
  logBettingSpike(customerId: string, betsPerMin: number) {
    if (betsPerMin > THRESHOLDS.BETTING_SPIKE_PER_MIN) {
      this.log({
        level: 'warn',
        category: 'betting',
        message: `Betting spike detected: ${betsPerMin} bets/min`,
        user_id: customerId,
        metadata: { bets_per_min: betsPerMin },
      });
    }
  }

  // ===== SECURITY LOGGING =====
  
  logSecurityEvent(event: string, details: Record<string, unknown>, userId?: string) {
    this.log({
      level: 'critical',
      category: 'security',
      message: `Security event: ${event}`,
      user_id: userId,
      metadata: details,
    });
  }

  // ===== PERFORMANCE LOGGING =====
  
  logSlowQuery(query: string, duration_ms: number) {
    if (duration_ms > THRESHOLDS.SLOW_API_MS) {
      this.log({
        level: 'warn',
        category: 'performance',
        message: `Slow query: ${duration_ms}ms`,
        duration_ms,
        metadata: { query: query.substring(0, 200) },
      });
    }
  }
}

// Singleton instance
export const productionLog = new ProductionLogger();

// =====================================================
// MIDDLEWARE HELPER
// =====================================================

export function withProductionLogging<T>(
  endpoint: string,
  handler: () => Promise<T>,
  userId?: string
): Promise<T> {
  const startTime = Date.now();
  
  return handler()
    .then((result) => {
      const duration = Date.now() - startTime;
      productionLog.logApiRequest(endpoint, duration, 200, userId);
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      productionLog.logApiRequest(endpoint, duration, 500, userId);
      productionLog.logApiError(endpoint, error, userId);
      throw error;
    });
}

// =====================================================
// TIMING HELPER
// =====================================================

export function measureDuration(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
