/**
 * Payout Orchestrator
 * Handles payout job processing with state machine, retries, and fraud detection
 * Integrates with the financial ledger for proper accounting
 */

import { createClient } from '@/lib/supabase/server'
import { FinancialLedger } from '@/lib/financial-ledger'
import { acquireLock, releaseLock } from '@/lib/transaction-queue'
import { Redis } from '@upstash/redis'

// Types
export type PayoutType = 'winning' | 'refund' | 'bonus' | 'commission' | 'rebate' | 'withdrawal' | 'adjustment'
export type PayoutStatus = 'queued' | 'validating' | 'processing' | 'awaiting_confirmation' | 'completed' | 'failed' | 'reversed' | 'cancelled'
export type AlertType = 'rapid_payout' | 'high_volume' | 'repeated_failure' | 'duplicate_pattern' | 'unusual_amount' | 'velocity_breach' | 'account_anomaly' | 'manual_flag'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface PayoutJob {
  id: string
  job_number: string
  ledger_transaction_id?: string
  settlement_batch_id?: string
  settlement_item_id?: string
  member_id: string
  member_name?: string
  amount: number
  fee_amount: number
  currency: string
  payout_type: PayoutType
  bank_code?: string
  bank_name?: string
  account_number?: string
  account_name?: string
  payment_method: string
  status: PayoutStatus
  retry_count: number
  max_retries: number
  next_retry_at?: string
  provider_reference?: string
  provider_response?: Record<string, unknown>
  last_error?: string
  error_code?: string
  idempotency_key?: string
  queued_at: string
  started_at?: string
  completed_at?: string
  failed_at?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface CreatePayoutParams {
  memberId: string
  memberName?: string
  amount: number
  feeAmount?: number
  payoutType: PayoutType
  bankCode?: string
  bankName?: string
  accountNumber?: string
  accountName?: string
  paymentMethod?: string
  settlementBatchId?: string
  settlementItemId?: string
  idempotencyKey?: string
  tenantId?: string
  metadata?: Record<string, unknown>
}

export interface PayoutConfig {
  maxRetries: number
  retryDelayMs: number
  velocityLimit: number // Max payouts per member per hour
  highAmountThreshold: number // Amount that triggers manual review
  rapidPayoutWindowMs: number // Window for detecting rapid payouts
  enableFraudDetection: boolean
}

const DEFAULT_CONFIG: PayoutConfig = {
  maxRetries: 3,
  retryDelayMs: 60000, // 1 minute
  velocityLimit: 10, // 10 payouts per member per hour
  highAmountThreshold: 100000, // 100k THB
  rapidPayoutWindowMs: 300000, // 5 minutes
  enableFraudDetection: true,
}

// Payment provider interface
export interface PaymentProvider {
  name: string
  processPayout(job: PayoutJob): Promise<{
    success: boolean
    reference?: string
    error?: string
    errorCode?: string
  }>
  checkStatus(reference: string): Promise<{
    status: 'pending' | 'completed' | 'failed'
    error?: string
  }>
}

// Mock payment provider for development
class MockPaymentProvider implements PaymentProvider {
  name = 'mock'

  async processPayout(job: PayoutJob): Promise<{
    success: boolean
    reference?: string
    error?: string
    errorCode?: string
  }> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100))

    // Simulate 95% success rate
    const success = Math.random() > 0.05

    if (success) {
      return {
        success: true,
        reference: `MOCK-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      }
    } else {
      return {
        success: false,
        error: 'Simulated payment failure',
        errorCode: 'MOCK_ERROR',
      }
    }
  }

  async checkStatus(reference: string): Promise<{
    status: 'pending' | 'completed' | 'failed'
    error?: string
  }> {
    // Mock always returns completed
    return { status: 'completed' }
  }
}

/**
 * Payout Orchestrator class
 */
export class PayoutOrchestrator {
  private config: PayoutConfig
  private ledger: FinancialLedger
  private provider: PaymentProvider
  private redis: Redis | null = null

  constructor(config: Partial<PayoutConfig> = {}, provider?: PaymentProvider) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.ledger = new FinancialLedger()
    this.provider = provider || new MockPaymentProvider()

    // Initialize Redis for velocity tracking
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
  }

  /**
   * Create a new payout job
   */
  async createPayout(params: CreatePayoutParams): Promise<PayoutJob> {
    const supabase = await createClient()

    // Check idempotency
    if (params.idempotencyKey) {
      const { data: existing } = await supabase
        .from('payout_jobs')
        .select('*')
        .eq('idempotency_key', params.idempotencyKey)
        .single()

      if (existing) {
        return existing
      }
    }

    // Generate job number
    const { data: jobNumber } = await supabase.rpc('generate_payout_job_number')

    // Fraud detection checks
    if (this.config.enableFraudDetection) {
      await this.runFraudChecks(params)
    }

    // Create payout job
    const { data, error } = await supabase
      .from('payout_jobs')
      .insert({
        job_number: jobNumber,
        member_id: params.memberId,
        member_name: params.memberName,
        amount: params.amount,
        fee_amount: params.feeAmount || 0,
        payout_type: params.payoutType,
        bank_code: params.bankCode,
        bank_name: params.bankName,
        account_number: params.accountNumber,
        account_name: params.accountName,
        payment_method: params.paymentMethod || 'bank_transfer',
        settlement_batch_id: params.settlementBatchId,
        settlement_item_id: params.settlementItemId,
        idempotency_key: params.idempotencyKey,
        tenant_id: params.tenantId,
        max_retries: this.config.maxRetries,
        metadata: params.metadata || {},
        status: 'queued',
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create payout: ${error.message}`)

    // Track velocity
    await this.trackVelocity(params.memberId)

    return data
  }

  /**
   * Process a payout job
   */
  async processJob(jobId: string): Promise<PayoutJob> {
    const lockKey = `payout:job:${jobId}`
    const lockAcquired = await acquireLock(lockKey, 120000) // 2 min timeout

    if (!lockAcquired) {
      throw new Error('Payout job is already being processed')
    }

    const supabase = await createClient()

    try {
      // Get job
      const { data: job, error } = await supabase
        .from('payout_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (error || !job) throw new Error('Payout job not found')

      // Validate state
      if (!['queued', 'failed'].includes(job.status)) {
        throw new Error(`Cannot process job with status: ${job.status}`)
      }

      // Check retry limit
      if (job.status === 'failed' && job.retry_count >= job.max_retries) {
        throw new Error('Max retries exceeded')
      }

      // Update to validating
      await this.updateJobStatus(jobId, 'validating')

      // Validate payout
      await this.validatePayout(job)

      // Update to processing
      await this.updateJobStatus(jobId, 'processing', {
        started_at: new Date().toISOString(),
      })

      // Create ledger transaction (hold funds)
      const ledgerTxn = await this.ledger.recordTransaction({
        transactionType: 'withdrawal',
        entityType: 'user',
        entityId: job.member_id,
        amount: job.amount,
        feeAmount: job.fee_amount,
        description: `Payout: ${job.payout_type} - ${job.job_number}`,
        referenceType: 'payout_job',
        referenceId: jobId,
        idempotencyKey: `payout:${jobId}`,
        metadata: {
          bank_code: job.bank_code,
          account_number: job.account_number,
        },
      })

      // Update job with ledger transaction
      await supabase
        .from('payout_jobs')
        .update({ ledger_transaction_id: ledgerTxn.id })
        .eq('id', jobId)

      // Process with payment provider
      const result = await this.provider.processPayout(job)

      if (result.success) {
        // Update to completed
        await this.updateJobStatus(jobId, 'completed', {
          provider_reference: result.reference,
          completed_at: new Date().toISOString(),
        })
      } else {
        // Handle failure
        const retryCount = job.retry_count + 1
        const canRetry = retryCount < job.max_retries

        await this.updateJobStatus(jobId, 'failed', {
          last_error: result.error,
          error_code: result.errorCode,
          retry_count: retryCount,
          next_retry_at: canRetry
            ? new Date(Date.now() + this.config.retryDelayMs * retryCount).toISOString()
            : null,
          failed_at: new Date().toISOString(),
        })

        // Reverse ledger transaction on final failure
        if (!canRetry && ledgerTxn) {
          await this.ledger.reverseTransaction(ledgerTxn.id, `Payout failed: ${result.error}`)
        }

        // Create alert for repeated failures
        if (retryCount >= 2) {
          await this.createAlert({
            referenceType: 'payout_job',
            referenceId: jobId,
            alertType: 'repeated_failure',
            severity: retryCount >= job.max_retries ? 'high' : 'medium',
            description: `Payout job ${job.job_number} failed ${retryCount} times`,
            detectionData: { error: result.error, errorCode: result.errorCode },
          })
        }
      }

      // Return updated job
      const { data: updatedJob } = await supabase
        .from('payout_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      return updatedJob!
    } finally {
      await releaseLock(lockKey)
    }
  }

  /**
   * Process all queued payouts
   */
  async processQueue(limit: number = 50): Promise<{
    processed: number
    succeeded: number
    failed: number
    errors: Array<{ jobId: string; error: string }>
  }> {
    const supabase = await createClient()
    const errors: Array<{ jobId: string; error: string }> = []

    // Get queued jobs
    const { data: jobs } = await supabase
      .from('payout_jobs')
      .select('id')
      .eq('status', 'queued')
      .order('queued_at', { ascending: true })
      .limit(limit)

    if (!jobs || jobs.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, errors: [] }
    }

    let succeeded = 0
    let failed = 0

    // Process jobs
    for (const job of jobs) {
      try {
        const result = await this.processJob(job.id)
        if (result.status === 'completed') {
          succeeded++
        } else {
          failed++
        }
      } catch (err) {
        failed++
        errors.push({
          jobId: job.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return {
      processed: jobs.length,
      succeeded,
      failed,
      errors,
    }
  }

  /**
   * Retry failed payouts
   */
  async retryFailed(limit: number = 20): Promise<{
    retried: number
    succeeded: number
    failed: number
  }> {
    const supabase = await createClient()

    // Get retryable jobs
    const { data: jobs } = await supabase
      .from('payout_jobs')
      .select('id')
      .eq('status', 'failed')
      .lt('retry_count', supabase.rpc('max_retries'))
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(limit)

    if (!jobs || jobs.length === 0) {
      return { retried: 0, succeeded: 0, failed: 0 }
    }

    let succeeded = 0
    let failed = 0

    for (const job of jobs) {
      try {
        const result = await this.processJob(job.id)
        if (result.status === 'completed') {
          succeeded++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    return { retried: jobs.length, succeeded, failed }
  }

  /**
   * Validate payout before processing
   */
  private async validatePayout(job: PayoutJob): Promise<void> {
    // Check minimum amount
    if (job.amount <= 0) {
      throw new Error('Payout amount must be positive')
    }

    // Check account balance via ledger
    const account = await this.ledger.getOrCreateEntityAccount('user', job.member_id)
    if (account.available_balance < job.amount + job.fee_amount) {
      throw new Error('Insufficient balance')
    }

    // Check for duplicate pending payout
    const supabase = await createClient()
    const { data: pending } = await supabase
      .from('payout_jobs')
      .select('id')
      .eq('member_id', job.member_id)
      .in('status', ['validating', 'processing', 'awaiting_confirmation'])
      .neq('id', job.id)
      .limit(1)

    if (pending && pending.length > 0) {
      throw new Error('Another payout is already in progress')
    }
  }

  /**
   * Run fraud detection checks
   */
  private async runFraudChecks(params: CreatePayoutParams): Promise<void> {
    const alerts: Array<{
      alertType: AlertType
      severity: AlertSeverity
      description: string
      detectionData: Record<string, unknown>
    }> = []

    // Check high amount
    if (params.amount >= this.config.highAmountThreshold) {
      alerts.push({
        alertType: 'unusual_amount',
        severity: 'high',
        description: `High amount payout: ${params.amount}`,
        detectionData: { amount: params.amount, threshold: this.config.highAmountThreshold },
      })
    }

    // Check velocity
    if (this.redis) {
      const velocityKey = `payout:velocity:${params.memberId}`
      const count = await this.redis.get<number>(velocityKey) || 0

      if (count >= this.config.velocityLimit) {
        alerts.push({
          alertType: 'velocity_breach',
          severity: 'high',
          description: `Velocity limit exceeded: ${count} payouts in last hour`,
          detectionData: { count, limit: this.config.velocityLimit },
        })
      }
    }

    // Check rapid payout pattern
    const supabase = await createClient()
    const windowStart = new Date(Date.now() - this.config.rapidPayoutWindowMs).toISOString()
    const { data: recentPayouts } = await supabase
      .from('payout_jobs')
      .select('id, amount')
      .eq('member_id', params.memberId)
      .gte('created_at', windowStart)

    if (recentPayouts && recentPayouts.length >= 3) {
      alerts.push({
        alertType: 'rapid_payout',
        severity: 'medium',
        description: `Rapid payout pattern: ${recentPayouts.length} payouts in ${this.config.rapidPayoutWindowMs / 60000} minutes`,
        detectionData: { count: recentPayouts.length, windowMs: this.config.rapidPayoutWindowMs },
      })
    }

    // Create alerts (but don't block payout unless critical)
    for (const alert of alerts) {
      await this.createAlert({
        referenceType: 'payout_job',
        referenceId: params.memberId, // Using member_id as reference for pre-creation alerts
        ...alert,
      })

      if (alert.severity === 'critical') {
        throw new Error(`Payout blocked: ${alert.alertType}`)
      }
    }
  }

  /**
   * Track payout velocity
   */
  private async trackVelocity(memberId: string): Promise<void> {
    if (!this.redis) return

    const velocityKey = `payout:velocity:${memberId}`
    await this.redis.incr(velocityKey)
    await this.redis.expire(velocityKey, 3600) // 1 hour expiry
  }

  /**
   * Create a suspicious transaction alert
   */
  private async createAlert(params: {
    referenceType: string
    referenceId: string
    alertType: AlertType
    severity: AlertSeverity
    description: string
    detectionData: Record<string, unknown>
  }): Promise<void> {
    const supabase = await createClient()

    await supabase.from('suspicious_transactions').insert({
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      alert_type: params.alertType,
      severity: params.severity,
      description: params.description,
      detection_data: params.detectionData,
    })
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string,
    status: PayoutStatus,
    additionalFields: Record<string, unknown> = {}
  ): Promise<void> {
    const supabase = await createClient()

    await supabase
      .from('payout_jobs')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...additionalFields,
      })
      .eq('id', jobId)
  }

  /**
   * Get payout job by ID
   */
  async getJob(jobId: string): Promise<PayoutJob | null> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('payout_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    return data
  }

  /**
   * List payout jobs
   */
  async listJobs(params: {
    memberId?: string
    status?: PayoutStatus
    payoutType?: PayoutType
    limit?: number
    offset?: number
  }): Promise<{ data: PayoutJob[]; total: number }> {
    const supabase = await createClient()
    let query = supabase
      .from('payout_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (params.memberId) query = query.eq('member_id', params.memberId)
    if (params.status) query = query.eq('status', params.status)
    if (params.payoutType) query = query.eq('payout_type', params.payoutType)

    const limit = params.limit || 50
    const offset = params.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, count } = await query
    return { data: data || [], total: count || 0 }
  }

  /**
   * Cancel a payout job
   */
  async cancelJob(jobId: string, reason: string): Promise<void> {
    const supabase = await createClient()

    const job = await this.getJob(jobId)
    if (!job) throw new Error('Job not found')
    if (!['queued', 'failed'].includes(job.status)) {
      throw new Error(`Cannot cancel job with status: ${job.status}`)
    }

    await supabase
      .from('payout_jobs')
      .update({
        status: 'cancelled',
        last_error: `Cancelled: ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }

  /**
   * Reverse a completed payout
   */
  async reverseJob(jobId: string, reason: string, reversedBy?: string): Promise<void> {
    const supabase = await createClient()

    const job = await this.getJob(jobId)
    if (!job) throw new Error('Job not found')
    if (job.status !== 'completed') {
      throw new Error(`Cannot reverse job with status: ${job.status}`)
    }

    // Reverse ledger transaction
    if (job.ledger_transaction_id) {
      await this.ledger.reverseTransaction(job.ledger_transaction_id, reason, reversedBy)
    }

    await supabase
      .from('payout_jobs')
      .update({
        status: 'reversed',
        reversed_by: reversedBy,
        reversal_reason: reason,
        reversed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }

  /**
   * Get payout statistics
   */
  async getStats(params: {
    startDate?: string
    endDate?: string
    memberId?: string
  }): Promise<{
    totalPayouts: number
    totalAmount: number
    completedCount: number
    failedCount: number
    pendingCount: number
    byType: Record<PayoutType, { count: number; amount: number }>
  }> {
    const supabase = await createClient()

    let query = supabase.from('payout_jobs').select('status, payout_type, amount')

    if (params.startDate) query = query.gte('created_at', params.startDate)
    if (params.endDate) query = query.lte('created_at', params.endDate)
    if (params.memberId) query = query.eq('member_id', params.memberId)

    const { data: jobs } = await query

    if (!jobs || jobs.length === 0) {
      return {
        totalPayouts: 0,
        totalAmount: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        byType: {} as Record<PayoutType, { count: number; amount: number }>,
      }
    }

    const byType: Record<PayoutType, { count: number; amount: number }> = {} as Record<PayoutType, { count: number; amount: number }>

    let completedCount = 0
    let failedCount = 0
    let pendingCount = 0
    let totalAmount = 0

    for (const job of jobs) {
      totalAmount += Number(job.amount)

      if (job.status === 'completed') completedCount++
      else if (job.status === 'failed') failedCount++
      else if (['queued', 'validating', 'processing', 'awaiting_confirmation'].includes(job.status)) pendingCount++

      if (!byType[job.payout_type as PayoutType]) {
        byType[job.payout_type as PayoutType] = { count: 0, amount: 0 }
      }
      byType[job.payout_type as PayoutType].count++
      byType[job.payout_type as PayoutType].amount += Number(job.amount)
    }

    return {
      totalPayouts: jobs.length,
      totalAmount,
      completedCount,
      failedCount,
      pendingCount,
      byType,
    }
  }
}

// Singleton instance
let payoutOrchestratorInstance: PayoutOrchestrator | null = null

export function getPayoutOrchestrator(config?: Partial<PayoutConfig>): PayoutOrchestrator {
  if (!payoutOrchestratorInstance) {
    payoutOrchestratorInstance = new PayoutOrchestrator(config)
  }
  return payoutOrchestratorInstance
}
