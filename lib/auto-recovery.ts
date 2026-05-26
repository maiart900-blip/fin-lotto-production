/**
 * Auto-Recovery and Self-Healing System
 * Production resilience with automatic failure detection and recovery
 */

import { createClient } from '@/lib/supabase/server'

// ============= TYPES =============

export type RecoveryEventType = 
  | 'worker_restart'
  | 'lock_release'
  | 'queue_recovery'
  | 'payout_retry'
  | 'health_degraded'
  | 'emergency_mode'
  | 'db_reconnect'
  | 'redis_reconnect'

export type SystemMode = 'normal' | 'degraded' | 'emergency' | 'maintenance'

export interface RecoveryEvent {
  id?: string
  event_type: RecoveryEventType
  description: string
  affected_component: string
  recovery_action: string
  success: boolean
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface HealthStatus {
  component: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency_ms?: number
  last_check: string
  error?: string
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  mode: SystemMode
  components: HealthStatus[]
  alerts: string[]
  last_updated: string
}

// ============= CONFIGURATION =============

const RECOVERY_CONFIG = {
  // Worker recovery
  worker_stuck_threshold_ms: 900000, // 15 minutes
  worker_heartbeat_interval_ms: 60000, // 1 minute
  max_worker_restarts_per_hour: 5,
  
  // Payout retry
  payout_retry_max_attempts: 5,
  payout_retry_base_delay_ms: 5000,
  payout_retry_max_delay_ms: 300000, // 5 minutes
  
  // Health monitoring
  health_check_interval_ms: 30000, // 30 seconds
  db_timeout_ms: 5000,
  redis_timeout_ms: 3000,
  api_latency_warning_ms: 1000,
  api_latency_critical_ms: 5000,
  
  // Degraded mode thresholds
  degraded_mode_error_rate: 0.1, // 10% error rate
  emergency_mode_error_rate: 0.3, // 30% error rate
  
  // Memory thresholds (if available)
  memory_warning_percent: 80,
  memory_critical_percent: 95,
}

// ============= AUTO-RECOVERY CLASS =============

export class AutoRecovery {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null
  private currentMode: SystemMode = 'normal'
  
  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  // ===== WORKER RECOVERY =====

  async detectStuckWorkers(): Promise<{ worker_type: string; locked_at: string; duration_ms: number }[]> {
    const supabase = await this.getSupabase()
    const threshold = new Date(Date.now() - RECOVERY_CONFIG.worker_stuck_threshold_ms).toISOString()
    
    const { data, error } = await supabase
      .from('worker_locks')
      .select('*')
      .lt('locked_at', threshold)
    
    if (error) {
      console.error('[AutoRecovery] Failed to check stuck workers:', error)
      return []
    }
    
    return (data || []).map(lock => ({
      worker_type: lock.worker_type,
      locked_at: lock.locked_at,
      duration_ms: Date.now() - new Date(lock.locked_at).getTime()
    }))
  }

  async releaseExpiredLocks(): Promise<{ released: number; workers: string[] }> {
    const supabase = await this.getSupabase()
    const now = new Date().toISOString()
    
    // Get expired locks first
    const { data: expiredLocks } = await supabase
      .from('worker_locks')
      .select('worker_type')
      .lt('expires_at', now)
    
    if (!expiredLocks || expiredLocks.length === 0) {
      return { released: 0, workers: [] }
    }
    
    // Delete expired locks
    const { error } = await supabase
      .from('worker_locks')
      .delete()
      .lt('expires_at', now)
    
    if (error) {
      console.error('[AutoRecovery] Failed to release locks:', error)
      return { released: 0, workers: [] }
    }
    
    const workers = expiredLocks.map(l => l.worker_type)
    
    // Log recovery event
    await this.logRecoveryEvent({
      event_type: 'lock_release',
      description: `Auto-released ${workers.length} expired worker locks`,
      affected_component: 'worker_locks',
      recovery_action: 'delete_expired',
      success: true,
      metadata: { workers }
    })
    
    return { released: workers.length, workers }
  }

  async restartStuckWorker(workerType: string): Promise<boolean> {
    const supabase = await this.getSupabase()
    
    // Check restart count in last hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { count } = await supabase
      .from('recovery_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'worker_restart')
      .eq('affected_component', workerType)
      .gte('created_at', oneHourAgo)
    
    if ((count || 0) >= RECOVERY_CONFIG.max_worker_restarts_per_hour) {
      console.warn(`[AutoRecovery] Max restarts reached for ${workerType}`)
      await this.triggerAlert('excessive_restarts', `Worker ${workerType} has been restarted too many times`)
      return false
    }
    
    // Release the lock
    const { error } = await supabase
      .from('worker_locks')
      .delete()
      .eq('worker_type', workerType)
    
    if (error) {
      console.error(`[AutoRecovery] Failed to restart worker ${workerType}:`, error)
      return false
    }
    
    // Log recovery event
    await this.logRecoveryEvent({
      event_type: 'worker_restart',
      description: `Auto-restarted stuck worker: ${workerType}`,
      affected_component: workerType,
      recovery_action: 'release_lock_and_restart',
      success: true,
    })
    
    return true
  }

  // ===== PAYOUT RETRY =====

  async retryFailedPayouts(): Promise<{ retried: number; succeeded: number; failed: number }> {
    const supabase = await this.getSupabase()
    
    // Find failed payouts eligible for retry
    const { data: failedPayouts, error } = await supabase
      .from('entries')
      .select('id, customer_id, payout_amount, payout_retry_count')
      .eq('status', 'won')
      .eq('payout_status', 'failed')
      .or(`payout_retry_count.is.null,payout_retry_count.lt.${RECOVERY_CONFIG.payout_retry_max_attempts}`)
      .limit(20)
    
    if (error || !failedPayouts?.length) {
      return { retried: 0, succeeded: 0, failed: 0 }
    }
    
    let succeeded = 0
    let failed = 0
    
    for (const entry of failedPayouts) {
      const retryCount = (entry.payout_retry_count || 0) + 1
      const delay = Math.min(
        RECOVERY_CONFIG.payout_retry_base_delay_ms * Math.pow(2, retryCount - 1),
        RECOVERY_CONFIG.payout_retry_max_delay_ms
      )
      
      // Check idempotency - has this payout already been processed?
      const { data: existingCredit } = await supabase
        .from('ledger_entries')
        .select('id')
        .eq('reference_type', 'payout')
        .eq('reference_id', entry.id)
        .maybeSingle()
      
      if (existingCredit) {
        // Already paid - just update status
        await supabase
          .from('entries')
          .update({ payout_status: 'completed', payout_processed_at: new Date().toISOString() })
          .eq('id', entry.id)
        succeeded++
        continue
      }
      
      // Apply delay with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, 1000))) // Cap at 1s for batch
      
      // Attempt payout
      const { error: payoutError } = await supabase.rpc('safe_payout_with_ledger', {
        p_entry_id: entry.id,
        p_customer_id: entry.customer_id,
        p_amount: entry.payout_amount
      })
      
      if (payoutError) {
        // Update retry count
        await supabase
          .from('entries')
          .update({ 
            payout_retry_count: retryCount,
            payout_last_error: payoutError.message 
          })
          .eq('id', entry.id)
        
        // Move to dead letter if max retries reached
        if (retryCount >= RECOVERY_CONFIG.payout_retry_max_attempts) {
          await supabase
            .from('entries')
            .update({ payout_status: 'dead_letter' })
            .eq('id', entry.id)
          
          await this.triggerAlert('payout_dead_letter', `Entry ${entry.id} moved to dead letter after ${retryCount} retries`)
        }
        
        failed++
      } else {
        await supabase
          .from('entries')
          .update({ 
            payout_status: 'completed',
            payout_processed_at: new Date().toISOString()
          })
          .eq('id', entry.id)
        succeeded++
      }
    }
    
    if (failedPayouts.length > 0) {
      await this.logRecoveryEvent({
        event_type: 'payout_retry',
        description: `Retried ${failedPayouts.length} failed payouts`,
        affected_component: 'payout_system',
        recovery_action: 'exponential_backoff_retry',
        success: succeeded > 0,
        metadata: { total: failedPayouts.length, succeeded, failed }
      })
    }
    
    return { retried: failedPayouts.length, succeeded, failed }
  }

  // ===== HEALTH MONITORING =====

  async checkSystemHealth(): Promise<SystemHealth> {
    const components: HealthStatus[] = []
    const alerts: string[] = []
    
    // Check DB connectivity
    const dbHealth = await this.checkDbHealth()
    components.push(dbHealth)
    if (dbHealth.status !== 'healthy') alerts.push(`Database: ${dbHealth.error}`)
    
    // Check Redis connectivity
    const redisHealth = await this.checkRedisHealth()
    components.push(redisHealth)
    if (redisHealth.status !== 'healthy') alerts.push(`Redis: ${redisHealth.error}`)
    
    // Check worker health
    const workerHealth = await this.checkWorkerHealth()
    components.push(workerHealth)
    if (workerHealth.status !== 'healthy') alerts.push(`Workers: ${workerHealth.error}`)
    
    // Check queue health
    const queueHealth = await this.checkQueueHealth()
    components.push(queueHealth)
    if (queueHealth.status !== 'healthy') alerts.push(`Queue: ${queueHealth.error}`)
    
    // Determine overall status
    const unhealthyCount = components.filter(c => c.status === 'unhealthy').length
    const degradedCount = components.filter(c => c.status === 'degraded').length
    
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let mode: SystemMode = 'normal'
    
    if (unhealthyCount >= 2 || components.find(c => c.component === 'database' && c.status === 'unhealthy')) {
      overall = 'unhealthy'
      mode = 'emergency'
    } else if (unhealthyCount >= 1 || degradedCount >= 2) {
      overall = 'degraded'
      mode = 'degraded'
    }
    
    // Update system mode if changed
    if (mode !== this.currentMode) {
      await this.setSystemMode(mode)
    }
    
    return {
      overall,
      mode,
      components,
      alerts,
      last_updated: new Date().toISOString()
    }
  }

  private async checkDbHealth(): Promise<HealthStatus> {
    const start = Date.now()
    try {
      const supabase = await this.getSupabase()
      const { error } = await supabase.from('system_settings').select('key').limit(1)
      const latency = Date.now() - start
      
      if (error) throw error
      
      return {
        component: 'database',
        status: latency > RECOVERY_CONFIG.api_latency_critical_ms ? 'degraded' : 'healthy',
        latency_ms: latency,
        last_check: new Date().toISOString()
      }
    } catch (e) {
      return {
        component: 'database',
        status: 'unhealthy',
        latency_ms: Date.now() - start,
        last_check: new Date().toISOString(),
        error: e instanceof Error ? e.message : 'Unknown error'
      }
    }
  }

  private async checkRedisHealth(): Promise<HealthStatus> {
    const start = Date.now()
    try {
      const { Redis } = await import('@upstash/redis')
      const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
      const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
      
      if (!url || !token) {
        return {
          component: 'redis',
          status: 'healthy', // Not configured = skip
          last_check: new Date().toISOString(),
          error: 'Not configured'
        }
      }
      
      const redis = new Redis({ url, token })
      await redis.ping()
      const latency = Date.now() - start
      
      return {
        component: 'redis',
        status: latency > RECOVERY_CONFIG.api_latency_critical_ms ? 'degraded' : 'healthy',
        latency_ms: latency,
        last_check: new Date().toISOString()
      }
    } catch (e) {
      return {
        component: 'redis',
        status: 'degraded', // Redis failure is degraded, not unhealthy
        latency_ms: Date.now() - start,
        last_check: new Date().toISOString(),
        error: e instanceof Error ? e.message : 'Unknown error'
      }
    }
  }

  private async checkWorkerHealth(): Promise<HealthStatus> {
    try {
      const stuckWorkers = await this.detectStuckWorkers()
      
      if (stuckWorkers.length >= 3) {
        return {
          component: 'workers',
          status: 'unhealthy',
          last_check: new Date().toISOString(),
          error: `${stuckWorkers.length} stuck workers detected`
        }
      } else if (stuckWorkers.length >= 1) {
        return {
          component: 'workers',
          status: 'degraded',
          last_check: new Date().toISOString(),
          error: `${stuckWorkers.length} stuck worker(s)`
        }
      }
      
      return {
        component: 'workers',
        status: 'healthy',
        last_check: new Date().toISOString()
      }
    } catch (e) {
      return {
        component: 'workers',
        status: 'degraded',
        last_check: new Date().toISOString(),
        error: e instanceof Error ? e.message : 'Unknown error'
      }
    }
  }

  private async checkQueueHealth(): Promise<HealthStatus> {
    try {
      const supabase = await this.getSupabase()
      
      // Check for blocked jobs (pending for too long)
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
      const { count } = await supabase
        .from('background_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('created_at', oneHourAgo)
      
      if ((count || 0) > 50) {
        return {
          component: 'queue',
          status: 'unhealthy',
          last_check: new Date().toISOString(),
          error: `${count} jobs stuck in queue`
        }
      } else if ((count || 0) > 10) {
        return {
          component: 'queue',
          status: 'degraded',
          last_check: new Date().toISOString(),
          error: `${count} jobs pending for >1 hour`
        }
      }
      
      return {
        component: 'queue',
        status: 'healthy',
        last_check: new Date().toISOString()
      }
    } catch {
      return {
        component: 'queue',
        status: 'healthy', // Table may not exist
        last_check: new Date().toISOString()
      }
    }
  }

  // ===== DEGRADED MODE =====

  async setSystemMode(mode: SystemMode): Promise<void> {
    const supabase = await this.getSupabase()
    this.currentMode = mode
    
    // Update system_settings
    await supabase
      .from('system_settings')
      .upsert({ key: 'system_mode', value: mode, updated_at: new Date().toISOString() })
    
    // Log mode change
    await this.logRecoveryEvent({
      event_type: mode === 'emergency' ? 'emergency_mode' : 'health_degraded',
      description: `System mode changed to: ${mode}`,
      affected_component: 'system',
      recovery_action: 'mode_change',
      success: true,
      metadata: { new_mode: mode }
    })
    
    // Trigger alert for non-normal modes
    if (mode !== 'normal') {
      await this.triggerAlert('system_mode', `System entered ${mode} mode`)
    }
  }

  async getSystemMode(): Promise<SystemMode> {
    const supabase = await this.getSupabase()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'system_mode')
      .maybeSingle()
    
    return (data?.value as SystemMode) || 'normal'
  }

  getDegradedModeConfig(): { 
    dashboardRefreshMs: number
    disablePolling: boolean
    throttleReports: boolean
    priorityEndpoints: string[]
  } {
    const mode = this.currentMode
    
    if (mode === 'emergency') {
      return {
        dashboardRefreshMs: 60000, // 1 minute
        disablePolling: true,
        throttleReports: true,
        priorityEndpoints: ['/api/entries', '/api/results/process', '/api/customer/buy']
      }
    } else if (mode === 'degraded') {
      return {
        dashboardRefreshMs: 30000, // 30 seconds
        disablePolling: false,
        throttleReports: true,
        priorityEndpoints: ['/api/entries', '/api/results/process']
      }
    }
    
    return {
      dashboardRefreshMs: 10000, // 10 seconds
      disablePolling: false,
      throttleReports: false,
      priorityEndpoints: []
    }
  }

  // ===== ALERTS =====

  async triggerAlert(alertType: string, message: string, severity: 'info' | 'warning' | 'critical' = 'warning'): Promise<void> {
    const supabase = await this.getSupabase()
    
    await supabase.from('operational_alerts').insert({
      alert_type: alertType,
      severity,
      title: alertType.replace(/_/g, ' ').toUpperCase(),
      message,
      data: { timestamp: new Date().toISOString() }
    })
  }

  // ===== RECOVERY EVENTS =====

  async logRecoveryEvent(event: RecoveryEvent): Promise<void> {
    const supabase = await this.getSupabase()
    
    await supabase.from('recovery_events').insert({
      event_type: event.event_type,
      description: event.description,
      affected_component: event.affected_component,
      recovery_action: event.recovery_action,
      success: event.success,
      metadata: event.metadata || {}
    })
  }

  async getRecoveryHistory(limit: number = 50): Promise<RecoveryEvent[]> {
    const supabase = await this.getSupabase()
    
    const { data } = await supabase
      .from('recovery_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    return data || []
  }

  // ===== AUTO-RECOVERY RUNNER =====

  async runAutoRecovery(): Promise<{
    locks_released: number
    workers_restarted: number
    payouts_retried: number
    health: SystemHealth
  }> {
    // 1. Release expired locks
    const { released: locksReleased } = await this.releaseExpiredLocks()
    
    // 2. Restart stuck workers
    const stuckWorkers = await this.detectStuckWorkers()
    let workersRestarted = 0
    for (const worker of stuckWorkers) {
      const success = await this.restartStuckWorker(worker.worker_type)
      if (success) workersRestarted++
    }
    
    // 3. Retry failed payouts (only in normal mode)
    let payoutsRetried = 0
    const currentMode = await this.getSystemMode()
    if (currentMode === 'normal') {
      const { retried } = await this.retryFailedPayouts()
      payoutsRetried = retried
    }
    
    // 4. Check system health
    const health = await this.checkSystemHealth()
    
    return {
      locks_released: locksReleased,
      workers_restarted: workersRestarted,
      payouts_retried: payoutsRetried,
      health
    }
  }
}

// Singleton instance
let autoRecoveryInstance: AutoRecovery | null = null

export function getAutoRecovery(): AutoRecovery {
  if (!autoRecoveryInstance) {
    autoRecoveryInstance = new AutoRecovery()
  }
  return autoRecoveryInstance
}
