/**
 * Worker Processor System
 * Real background job processing with monitoring, retries, and dead letter queue
 * Production Ready - Cron-triggered via Vercel or external scheduler
 */

import { createClient } from '@/lib/supabase/server'
import { getPayoutOrchestrator } from '@/lib/payout-orchestrator'
import { getSettlementEngine } from '@/lib/settlement-engine'

// Types
export type WorkerType = 'settlement' | 'payout' | 'reconciliation' | 'notification' | 'cleanup' | 'retry'

export interface WorkerConfig {
  batchSize: number
  timeoutMs: number
  maxRetries: number
  retryDelayMs: number
  lockDurationMs: number
}

export interface WorkerResult {
  runId: string
  workerType: WorkerType
  status: 'completed' | 'failed' | 'timeout' | 'cancelled'
  jobsProcessed: number
  jobsSucceeded: number
  jobsFailed: number
  durationMs: number
  errors: string[]
}

interface WorkerRun {
  id: string
  run_id: string
  worker_type: WorkerType
  status: string
  started_at: string
  jobs_processed: number
  jobs_succeeded: number
  jobs_failed: number
}

// Default configurations per worker type
const WORKER_CONFIGS: Record<WorkerType, WorkerConfig> = {
  settlement: {
    batchSize: 100,
    timeoutMs: 300000, // 5 minutes
    maxRetries: 3,
    retryDelayMs: 5000,
    lockDurationMs: 600000, // 10 minutes
  },
  payout: {
    batchSize: 50,
    timeoutMs: 180000, // 3 minutes
    maxRetries: 5,
    retryDelayMs: 10000,
    lockDurationMs: 300000, // 5 minutes
  },
  reconciliation: {
    batchSize: 1000,
    timeoutMs: 600000, // 10 minutes
    maxRetries: 2,
    retryDelayMs: 30000,
    lockDurationMs: 900000, // 15 minutes
  },
  notification: {
    batchSize: 200,
    timeoutMs: 60000, // 1 minute
    maxRetries: 3,
    retryDelayMs: 2000,
    lockDurationMs: 120000, // 2 minutes
  },
  cleanup: {
    batchSize: 500,
    timeoutMs: 300000, // 5 minutes
    maxRetries: 1,
    retryDelayMs: 0,
    lockDurationMs: 600000, // 10 minutes
  },
  retry: {
    batchSize: 20,
    timeoutMs: 120000, // 2 minutes
    maxRetries: 1,
    retryDelayMs: 5000,
    lockDurationMs: 180000, // 3 minutes
  },
}

/**
 * Worker Processor Class
 */
class WorkerProcessor {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Generate unique run ID
   */
  private generateRunId(workerType: WorkerType): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${workerType}-${timestamp}-${random}`
  }

  /**
   * Acquire worker lock (prevent concurrent runs)
   */
  async acquireWorkerLock(workerType: WorkerType, config: WorkerConfig): Promise<string | null> {
    const supabase = await this.getSupabase()
    const lockId = this.generateRunId(workerType)
    const expiresAt = new Date(Date.now() + config.lockDurationMs).toISOString()

    // Clean up expired locks first
    await supabase
      .from('worker_locks')
      .delete()
      .lt('expires_at', new Date().toISOString())

    // Try to acquire lock
    const { error } = await supabase
      .from('worker_locks')
      .insert({
        worker_type: workerType,
        locked_by: lockId,
        expires_at: expiresAt,
      })

    if (error) {
      // Lock already exists
      console.log(`[WorkerProcessor] Failed to acquire lock for ${workerType}: ${error.message}`)
      return null
    }

    return lockId
  }

  /**
   * Release worker lock
   */
  async releaseWorkerLock(workerType: WorkerType, lockId: string): Promise<void> {
    const supabase = await this.getSupabase()
    await supabase
      .from('worker_locks')
      .delete()
      .eq('worker_type', workerType)
      .eq('locked_by', lockId)
  }

  /**
   * Start a worker run
   */
  async startRun(workerType: WorkerType, runId: string): Promise<string> {
    const supabase = await this.getSupabase()
    
    const { data, error } = await supabase
      .from('worker_runs')
      .insert({
        worker_type: workerType,
        run_id: runId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw new Error(`Failed to start worker run: ${error.message}`)
    return data.id
  }

  /**
   * Complete a worker run
   */
  async completeRun(
    runId: string,
    result: Partial<WorkerResult>
  ): Promise<void> {
    const supabase = await this.getSupabase()
    
    await supabase
      .from('worker_runs')
      .update({
        status: result.status || 'completed',
        completed_at: new Date().toISOString(),
        jobs_processed: result.jobsProcessed || 0,
        jobs_succeeded: result.jobsSucceeded || 0,
        jobs_failed: result.jobsFailed || 0,
        duration_ms: result.durationMs || 0,
        error_message: result.errors?.join('; '),
      })
      .eq('run_id', runId)
  }

  /**
   * Record metric
   */
  async recordMetric(
    workerType: WorkerType,
    metricName: string,
    value: number,
    unit?: string
  ): Promise<void> {
    const supabase = await this.getSupabase()
    
    await supabase
      .from('worker_metrics')
      .insert({
        worker_type: workerType,
        metric_name: metricName,
        metric_value: value,
        metric_unit: unit,
      })
  }

  /**
   * Move job to dead letter queue
   */
  async moveToDeadLetter(
    jobId: string,
    jobType: string,
    jobData: Record<string, unknown>,
    failureReason: string,
    maxRetriesReached: boolean = false
  ): Promise<void> {
    const supabase = await this.getSupabase()

    // Check if already exists
    const { data: existing } = await supabase
      .from('dead_letter_jobs')
      .select('id, failure_count')
      .eq('original_job_id', jobId)
      .single()

    if (existing) {
      // Update existing
      await supabase
        .from('dead_letter_jobs')
        .update({
          failure_count: existing.failure_count + 1,
          last_failed_at: new Date().toISOString(),
          failure_reason: failureReason,
          max_retries_reached: maxRetriesReached,
        })
        .eq('id', existing.id)
    } else {
      // Insert new
      await supabase
        .from('dead_letter_jobs')
        .insert({
          original_job_id: jobId,
          job_type: jobType,
          job_data: jobData,
          failure_reason: failureReason,
          first_failed_at: new Date().toISOString(),
          max_retries_reached: maxRetriesReached,
        })
    }
  }

  /**
   * Process Settlement Worker
   * Processes pending settlement batches
   */
  async processSettlementWorker(): Promise<WorkerResult> {
    const workerType: WorkerType = 'settlement'
    const config = WORKER_CONFIGS[workerType]
    const runId = this.generateRunId(workerType)
    const startTime = Date.now()
    const errors: string[] = []
    let jobsProcessed = 0
    let jobsSucceeded = 0
    let jobsFailed = 0

    // Try to acquire lock
    const lockId = await this.acquireWorkerLock(workerType, config)
    if (!lockId) {
      return {
        runId,
        workerType,
        status: 'cancelled',
        jobsProcessed: 0,
        jobsSucceeded: 0,
        jobsFailed: 0,
        durationMs: Date.now() - startTime,
        errors: ['Could not acquire worker lock - another instance may be running'],
      }
    }

    try {
      await this.startRun(workerType, runId)
      const supabase = await this.getSupabase()
      const engine = getSettlementEngine()

      // Get pending batches
      const { data: batches } = await supabase
        .from('settlement_batches')
        .select('id')
        .in('status', ['pending', 'calculating'])
        .limit(config.batchSize)

      if (batches && batches.length > 0) {
        for (const batch of batches) {
          jobsProcessed++
          try {
            await engine.processBatch(batch.id)
            jobsSucceeded++
          } catch (err) {
            jobsFailed++
            const error = err instanceof Error ? err.message : 'Unknown error'
            errors.push(`Batch ${batch.id}: ${error}`)
            
            // Move to dead letter after max retries
            await this.moveToDeadLetter(
              batch.id,
              'settlement_batch',
              { batchId: batch.id },
              error
            )
          }
        }
      }

      const durationMs = Date.now() - startTime
      await this.completeRun(runId, {
        status: errors.length > 0 && jobsSucceeded === 0 ? 'failed' : 'completed',
        jobsProcessed,
        jobsSucceeded,
        jobsFailed,
        durationMs,
        errors,
      })

      // Record metrics
      await this.recordMetric(workerType, 'jobs_processed', jobsProcessed)
      await this.recordMetric(workerType, 'jobs_succeeded', jobsSucceeded)
      await this.recordMetric(workerType, 'duration_ms', durationMs, 'ms')

      return {
        runId,
        workerType,
        status: errors.length > 0 && jobsSucceeded === 0 ? 'failed' : 'completed',
        jobsProcessed,
        jobsSucceeded,
        jobsFailed,
        durationMs,
        errors,
      }
    } finally {
      await this.releaseWorkerLock(workerType, lockId)
    }
  }

  /**
   * Process Payout Worker
   * Processes queued payout jobs
   */
  async processPayoutWorker(): Promise<WorkerResult> {
    const workerType: WorkerType = 'payout'
    const config = WORKER_CONFIGS[workerType]
    const runId = this.generateRunId(workerType)
    const startTime = Date.now()
    const errors: string[] = []
    let jobsProcessed = 0
    let jobsSucceeded = 0
    let jobsFailed = 0

    const lockId = await this.acquireWorkerLock(workerType, config)
    if (!lockId) {
      return {
        runId,
        workerType,
        status: 'cancelled',
        jobsProcessed: 0,
        jobsSucceeded: 0,
        jobsFailed: 0,
        durationMs: Date.now() - startTime,
        errors: ['Could not acquire worker lock'],
      }
    }

    try {
      await this.startRun(workerType, runId)
      const orchestrator = getPayoutOrchestrator()

      // Process queue
      const result = await orchestrator.processQueue(config.batchSize)
      
      jobsProcessed = result.processed
      jobsSucceeded = result.succeeded
      jobsFailed = result.failed

      if (result.errors && result.errors.length > 0) {
        errors.push(...result.errors.map((e: { jobId: string; error: string }) => `Job ${e.jobId}: ${e.error}`))
      }

      const durationMs = Date.now() - startTime
      await this.completeRun(runId, {
        status: jobsFailed > 0 && jobsSucceeded === 0 ? 'failed' : 'completed',
        jobsProcessed,
        jobsSucceeded,
        jobsFailed,
        durationMs,
        errors,
      })

      await this.recordMetric(workerType, 'jobs_processed', jobsProcessed)
      await this.recordMetric(workerType, 'jobs_succeeded', jobsSucceeded)
      await this.recordMetric(workerType, 'total_amount', result.totalAmount || 0, 'THB')
      await this.recordMetric(workerType, 'duration_ms', durationMs, 'ms')

      return {
        runId,
        workerType,
        status: jobsFailed > 0 && jobsSucceeded === 0 ? 'failed' : 'completed',
        jobsProcessed,
        jobsSucceeded,
        jobsFailed,
        durationMs,
        errors,
      }
    } finally {
      await this.releaseWorkerLock(workerType, lockId)
    }
  }

  /**
   * Process Retry Worker
   * Retries failed jobs from dead letter queue
   */
  async processRetryWorker(): Promise<WorkerResult> {
    const workerType: WorkerType = 'retry'
    const config = WORKER_CONFIGS[workerType]
    const runId = this.generateRunId(workerType)
    const startTime = Date.now()
    const errors: string[] = []
    let jobsProcessed = 0
    let jobsSucceeded = 0
    let jobsFailed = 0

    const lockId = await this.acquireWorkerLock(workerType, config)
    if (!lockId) {
      return {
        runId,
        workerType,
        status: 'cancelled',
        jobsProcessed: 0,
        jobsSucceeded: 0,
        jobsFailed: 0,
        durationMs: Date.now() - startTime,
        errors: ['Could not acquire worker lock'],
      }
    }

    try {
      await this.startRun(workerType, runId)
      const supabase = await this.getSupabase()

      // Get retryable jobs
      const { data: deadLetterJobs } = await supabase
        .from('dead_letter_jobs')
        .select('*')
        .eq('status', 'pending')
        .eq('max_retries_reached', false)
        .limit(config.batchSize)

      if (deadLetterJobs && deadLetterJobs.length > 0) {
        for (const dlJob of deadLetterJobs) {
          jobsProcessed++
          
          try {
            // Mark as retrying
            await supabase
              .from('dead_letter_jobs')
              .update({ status: 'retrying', retry_count: dlJob.retry_count + 1 })
              .eq('id', dlJob.id)

            // Retry based on job type
            if (dlJob.job_type === 'payout_job') {
              const orchestrator = getPayoutOrchestrator()
              await orchestrator.retryJob(dlJob.original_job_id)
            } else if (dlJob.job_type === 'settlement_batch') {
              const engine = getSettlementEngine()
              await engine.processBatch(dlJob.original_job_id)
            }

            // Mark as resolved
            await supabase
              .from('dead_letter_jobs')
              .update({ status: 'resolved', resolved_at: new Date().toISOString() })
              .eq('id', dlJob.id)

            jobsSucceeded++
          } catch (err) {
            jobsFailed++
            const error = err instanceof Error ? err.message : 'Unknown error'
            errors.push(`DLJob ${dlJob.id}: ${error}`)

            // Update failure count
            const newRetryCount = dlJob.retry_count + 1
            const maxRetriesReached = newRetryCount >= config.maxRetries

            await supabase
              .from('dead_letter_jobs')
              .update({
                status: maxRetriesReached ? 'abandoned' : 'pending',
                max_retries_reached: maxRetriesReached,
                last_failed_at: new Date().toISOString(),
                failure_reason: error,
              })
              .eq('id', dlJob.id)
          }
        }
      }

      const durationMs = Date.now() - startTime
      await this.completeRun(runId, {
        status: 'completed',
        jobsProcessed,
        jobsSucceeded,
        jobsFailed,
        durationMs,
        errors,
      })

      return {
        runId,
        workerType,
        status: 'completed',
        jobsProcessed,
        jobsSucceeded,
        jobsFailed,
        durationMs,
        errors,
      }
    } finally {
      await this.releaseWorkerLock(workerType, lockId)
    }
  }

  /**
   * Process Cleanup Worker
   * Cleans up old data, expired locks, etc.
   */
  async processCleanupWorker(): Promise<WorkerResult> {
    const workerType: WorkerType = 'cleanup'
    const config = WORKER_CONFIGS[workerType]
    const runId = this.generateRunId(workerType)
    const startTime = Date.now()
    const errors: string[] = []
    let jobsProcessed = 0
    let jobsSucceeded = 0

    const lockId = await this.acquireWorkerLock(workerType, config)
    if (!lockId) {
      return {
        runId,
        workerType,
        status: 'cancelled',
        jobsProcessed: 0,
        jobsSucceeded: 0,
        jobsFailed: 0,
        durationMs: Date.now() - startTime,
        errors: ['Could not acquire worker lock'],
      }
    }

    try {
      await this.startRun(workerType, runId)
      const supabase = await this.getSupabase()

      // 1. Clean expired worker locks
      const { count: locksDeleted } = await supabase
        .from('worker_locks')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('*', { count: 'exact', head: true })
      jobsProcessed++
      jobsSucceeded++
      
      // 2. Clean expired payout locks
      const { count: payoutLocksDeleted } = await supabase
        .from('payout_locks')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('*', { count: 'exact', head: true })
      jobsProcessed++
      jobsSucceeded++

      // 3. Clean old worker metrics (keep 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { count: metricsDeleted } = await supabase
        .from('worker_metrics')
        .delete()
        .lt('recorded_at', thirtyDaysAgo)
        .select('*', { count: 'exact', head: true })
      jobsProcessed++
      jobsSucceeded++

      // 4. Clean old worker runs (keep 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count: runsDeleted } = await supabase
        .from('worker_runs')
        .delete()
        .lt('created_at', sevenDaysAgo)
        .select('*', { count: 'exact', head: true })
      jobsProcessed++
      jobsSucceeded++

      const durationMs = Date.now() - startTime
      await this.completeRun(runId, {
        status: 'completed',
        jobsProcessed,
        jobsSucceeded,
        jobsFailed: 0,
        durationMs,
        errors,
      })

      await this.recordMetric(workerType, 'locks_cleaned', (locksDeleted || 0) + (payoutLocksDeleted || 0))
      await this.recordMetric(workerType, 'metrics_cleaned', metricsDeleted || 0)
      await this.recordMetric(workerType, 'runs_cleaned', runsDeleted || 0)

      return {
        runId,
        workerType,
        status: 'completed',
        jobsProcessed,
        jobsSucceeded,
        jobsFailed: 0,
        durationMs,
        errors,
      }
    } finally {
      await this.releaseWorkerLock(workerType, lockId)
    }
  }

  /**
   * Get worker status
   */
  async getWorkerStatus(workerType?: WorkerType): Promise<WorkerRun[]> {
    const supabase = await this.getSupabase()
    
    let query = supabase
      .from('worker_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50)

    if (workerType) {
      query = query.eq('worker_type', workerType)
    }

    const { data } = await query
    return data || []
  }

  /**
   * Get worker metrics
   */
  async getWorkerMetrics(
    workerType: WorkerType,
    metricName?: string,
    hoursBack: number = 24
  ): Promise<{ recorded_at: string; metric_value: number }[]> {
    const supabase = await this.getSupabase()
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('worker_metrics')
      .select('recorded_at, metric_value')
      .eq('worker_type', workerType)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })

    if (metricName) {
      query = query.eq('metric_name', metricName)
    }

    const { data } = await query
    return data || []
  }

  /**
   * Get dead letter jobs
   */
  async getDeadLetterJobs(status?: string, limit: number = 50): Promise<unknown[]> {
    const supabase = await this.getSupabase()

    let query = supabase
      .from('dead_letter_jobs')
      .select('*')
      .order('last_failed_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data } = await query
    return data || []
  }

  /**
   * Resolve dead letter job manually
   */
  async resolveDeadLetterJob(
    jobId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<void> {
    const supabase = await this.getSupabase()

    await supabase
      .from('dead_letter_jobs')
      .update({
        status: 'resolved',
        resolved_by: resolvedBy,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }
}

// Singleton instance
let workerProcessor: WorkerProcessor | null = null

export function getWorkerProcessor(): WorkerProcessor {
  if (!workerProcessor) {
    workerProcessor = new WorkerProcessor()
  }
  return workerProcessor
}

export { WorkerProcessor }
