/**
 * Settlement Engine
 * Handles batch settlement processing for lottery draws and bet results
 * Integrates with the financial ledger for proper double-entry accounting
 */

import { createClient } from '@/lib/supabase/server'
import { FinancialLedger } from '@/lib/financial-ledger'
import { acquireLock, releaseLock } from '@/lib/transaction-queue'

// Types
export type BatchType = 'daily' | 'hourly' | 'manual' | 'lottery_draw'
export type BatchStatus = 'pending' | 'calculating' | 'validating' | 'processing' | 'settled' | 'partially_failed' | 'reversed' | 'cancelled'
export type SettlementResult = 'win' | 'lose' | 'void' | 'push' | 'partial'
export type ItemStatus = 'pending' | 'calculated' | 'validated' | 'settled' | 'failed' | 'reversed'

export interface SettlementBatch {
  id: string
  batch_number: string
  batch_type: BatchType
  status: BatchStatus
  reference_type?: string
  reference_id?: string
  reference_date?: string
  total_bets: number
  total_bet_amount: number
  total_winnings: number
  total_commission: number
  total_rebates: number
  total_payouts: number
  net_revenue: number
  processed_count: number
  failed_count: number
  started_at?: string
  completed_at?: string
  error_message?: string
  created_at: string
}

export interface SettlementItem {
  id: string
  batch_id: string
  bet_id: string
  bet_type?: string
  user_id: string
  agent_id?: string
  bet_amount: number
  odds?: number
  result?: SettlementResult
  winning_amount: number
  commission_amount: number
  rebate_amount: number
  net_amount: number
  status: ItemStatus
  ledger_transaction_id?: string
  error_message?: string
  settled_at?: string
}

export interface BetToSettle {
  bet_id: string
  bet_type?: string
  user_id: string
  agent_id?: string
  tenant_id?: string
  bet_amount: number
  odds?: number
  result: SettlementResult
  winning_amount?: number // If pre-calculated
}

export interface SettlementConfig {
  commission_rate?: number // Default commission rate (e.g., 0.05 for 5%)
  rebate_rate?: number // Default rebate rate
  max_batch_size?: number // Max items per batch
  parallel_processing?: number // Number of parallel workers
}

const DEFAULT_CONFIG: SettlementConfig = {
  commission_rate: 0.05,
  rebate_rate: 0.01,
  max_batch_size: 1000,
  parallel_processing: 5,
}

/**
 * Settlement Engine class
 */
export class SettlementEngine {
  private config: SettlementConfig
  private ledger: FinancialLedger

  constructor(config: Partial<SettlementConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.ledger = new FinancialLedger()
  }

  /**
   * Create a new settlement batch
   */
  async createBatch(params: {
    batchType: BatchType
    referenceType?: string
    referenceId?: string
    referenceDate?: string
    createdBy?: string
    tenantId?: string
  }): Promise<SettlementBatch> {
    const supabase = await createClient()

    // Generate batch number
    const { data: batchNumber } = await supabase.rpc('generate_settlement_batch_number')

    const { data, error } = await supabase
      .from('settlement_batches')
      .insert({
        batch_number: batchNumber,
        batch_type: params.batchType,
        status: 'pending',
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        reference_date: params.referenceDate,
        created_by: params.createdBy,
        tenant_id: params.tenantId,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create batch: ${error.message}`)
    return data
  }

  /**
   * Add bets to a settlement batch
   */
  async addBetsToSettlement(batchId: string, bets: BetToSettle[]): Promise<SettlementItem[]> {
    const supabase = await createClient()

    const items = bets.map(bet => ({
      batch_id: batchId,
      bet_id: bet.bet_id,
      bet_type: bet.bet_type,
      user_id: bet.user_id,
      agent_id: bet.agent_id,
      tenant_id: bet.tenant_id,
      bet_amount: bet.bet_amount,
      odds: bet.odds,
      result: bet.result,
      winning_amount: bet.winning_amount || 0,
      status: 'pending' as ItemStatus,
    }))

    const { data, error } = await supabase
      .from('settlement_items')
      .insert(items)
      .select()

    if (error) throw new Error(`Failed to add bets: ${error.message}`)

    // Update batch totals
    const totalBets = items.length
    const totalBetAmount = items.reduce((sum, i) => sum + i.bet_amount, 0)

    await supabase
      .from('settlement_batches')
      .update({
        total_bets: totalBets,
        total_bet_amount: totalBetAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchId)

    return data
  }

  /**
   * Process a settlement batch
   */
  async processBatch(batchId: string): Promise<{
    success: boolean
    batch: SettlementBatch
    processed: number
    failed: number
    errors: Array<{ itemId: string; error: string }>
  }> {
    const lockKey = `settlement:batch:${batchId}`
    const lockAcquired = await acquireLock(lockKey, 300000) // 5 min timeout

    if (!lockAcquired) {
      throw new Error('Settlement batch is already being processed')
    }

    const supabase = await createClient()
    const errors: Array<{ itemId: string; error: string }> = []
    let processed = 0
    let failed = 0

    try {
      // Update batch status to calculating
      await this.updateBatchStatus(batchId, 'calculating')

      // Get all pending items
      const { data: items, error: fetchError } = await supabase
        .from('settlement_items')
        .select('*')
        .eq('batch_id', batchId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (fetchError) throw new Error(`Failed to fetch items: ${fetchError.message}`)
      if (!items || items.length === 0) {
        await this.updateBatchStatus(batchId, 'settled')
        const batch = await this.getBatch(batchId)
        return { success: true, batch: batch!, processed: 0, failed: 0, errors: [] }
      }

      // Calculate settlements
      await this.updateBatchStatus(batchId, 'validating')
      const calculatedItems = await this.calculateSettlements(items)

      // Process settlements
      await this.updateBatchStatus(batchId, 'processing')

      let totalWinnings = 0
      let totalCommission = 0
      let totalRebates = 0
      let totalPayouts = 0

      for (const item of calculatedItems) {
        try {
          await this.processSettlementItem(item)
          processed++

          if (item.result === 'win' || item.result === 'partial') {
            totalWinnings += item.winning_amount
            totalPayouts += item.net_amount
          }
          totalCommission += item.commission_amount
          totalRebates += item.rebate_amount

          // Update item status
          await supabase
            .from('settlement_items')
            .update({
              status: 'settled',
              winning_amount: item.winning_amount,
              commission_amount: item.commission_amount,
              rebate_amount: item.rebate_amount,
              net_amount: item.net_amount,
              settled_at: new Date().toISOString(),
            })
            .eq('id', item.id)
        } catch (err) {
          failed++
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          errors.push({ itemId: item.id, error: errorMsg })

          await supabase
            .from('settlement_items')
            .update({
              status: 'failed',
              error_message: errorMsg,
            })
            .eq('id', item.id)
        }
      }

      // Calculate net revenue
      const netRevenue = items.reduce((sum, i) => sum + i.bet_amount, 0) - totalPayouts - totalCommission - totalRebates

      // Update batch with final totals
      const finalStatus: BatchStatus = failed > 0 ? 'partially_failed' : 'settled'
      await supabase
        .from('settlement_batches')
        .update({
          status: finalStatus,
          total_winnings: totalWinnings,
          total_commission: totalCommission,
          total_rebates: totalRebates,
          total_payouts: totalPayouts,
          net_revenue: netRevenue,
          processed_count: processed,
          failed_count: failed,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchId)

      const batch = await this.getBatch(batchId)
      return { success: failed === 0, batch: batch!, processed, failed, errors }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      await supabase
        .from('settlement_batches')
        .update({
          status: 'partially_failed',
          error_message: errorMsg,
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchId)

      throw err
    } finally {
      await releaseLock(lockKey)
    }
  }

  /**
   * Calculate settlement amounts for items
   */
  private async calculateSettlements(items: SettlementItem[]): Promise<SettlementItem[]> {
    return items.map(item => {
      let winningAmount = item.winning_amount
      let commissionAmount = 0
      let rebateAmount = 0
      let netAmount = 0

      switch (item.result) {
        case 'win':
          // If winning amount not pre-calculated, calculate based on odds
          if (!winningAmount && item.odds) {
            winningAmount = item.bet_amount * item.odds
          }
          // Calculate commission (from winnings)
          commissionAmount = winningAmount * (this.config.commission_rate || 0)
          // Calculate rebate (from bet amount)
          rebateAmount = item.bet_amount * (this.config.rebate_rate || 0)
          // Net payout = winnings - commission + rebate
          netAmount = winningAmount - commissionAmount + rebateAmount
          break

        case 'lose':
          // No payout, but may have rebate
          rebateAmount = item.bet_amount * (this.config.rebate_rate || 0)
          netAmount = rebateAmount
          break

        case 'void':
        case 'push':
          // Return original bet amount
          netAmount = item.bet_amount
          break

        case 'partial':
          // Partial win - use pre-calculated winning amount
          commissionAmount = winningAmount * (this.config.commission_rate || 0)
          netAmount = winningAmount - commissionAmount
          break
      }

      return {
        ...item,
        winning_amount: winningAmount,
        commission_amount: commissionAmount,
        rebate_amount: rebateAmount,
        net_amount: netAmount,
      }
    })
  }

  /**
   * Process a single settlement item through the ledger
   */
  private async processSettlementItem(item: SettlementItem): Promise<void> {
    const idempotencyKey = `settlement:${item.batch_id}:${item.id}`

    // Only process payouts for wins or refunds
    if (item.net_amount > 0) {
      const transactionType = item.result === 'void' || item.result === 'push' ? 'refund' : 'payout'

      await this.ledger.recordTransaction({
        transactionType,
        entityType: 'user',
        entityId: item.user_id,
        amount: item.net_amount,
        description: `Settlement: ${item.result} - Bet ${item.bet_id}`,
        referenceType: 'settlement_item',
        referenceId: item.id,
        idempotencyKey,
        metadata: {
          batch_id: item.batch_id,
          bet_id: item.bet_id,
          result: item.result,
          winning_amount: item.winning_amount,
          commission_amount: item.commission_amount,
          rebate_amount: item.rebate_amount,
        },
      })
    }

    // Record commission if applicable
    if (item.commission_amount > 0 && item.agent_id) {
      await this.ledger.recordTransaction({
        transactionType: 'commission',
        entityType: 'agent',
        entityId: item.agent_id,
        amount: item.commission_amount,
        description: `Commission from settlement: Bet ${item.bet_id}`,
        referenceType: 'settlement_item',
        referenceId: item.id,
        idempotencyKey: `${idempotencyKey}:commission`,
      })
    }
  }

  /**
   * Update batch status
   */
  private async updateBatchStatus(batchId: string, status: BatchStatus): Promise<void> {
    const supabase = await createClient()
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'calculating') {
      updates.started_at = new Date().toISOString()
    }

    await supabase
      .from('settlement_batches')
      .update(updates)
      .eq('id', batchId)
  }

  /**
   * Get batch by ID
   */
  async getBatch(batchId: string): Promise<SettlementBatch | null> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('settlement_batches')
      .select('*')
      .eq('id', batchId)
      .single()
    return data
  }

  /**
   * Get batch items
   */
  async getBatchItems(batchId: string, status?: ItemStatus): Promise<SettlementItem[]> {
    const supabase = await createClient()
    let query = supabase
      .from('settlement_items')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })

    if (status) {
      query = query.eq('status', status)
    }

    const { data } = await query
    return data || []
  }

  /**
   * List batches with filters
   */
  async listBatches(params: {
    status?: BatchStatus
    batchType?: BatchType
    referenceDate?: string
    limit?: number
    offset?: number
  }): Promise<{ data: SettlementBatch[]; total: number }> {
    const supabase = await createClient()
    let query = supabase
      .from('settlement_batches')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (params.status) query = query.eq('status', params.status)
    if (params.batchType) query = query.eq('batch_type', params.batchType)
    if (params.referenceDate) query = query.eq('reference_date', params.referenceDate)

    const limit = params.limit || 50
    const offset = params.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, count } = await query
    return { data: data || [], total: count || 0 }
  }

  /**
   * Reverse a settlement batch
   */
  async reverseBatch(batchId: string, reason: string, reversedBy?: string): Promise<void> {
    const lockKey = `settlement:batch:${batchId}`
    const lockAcquired = await acquireLock(lockKey, 300000)

    if (!lockAcquired) {
      throw new Error('Settlement batch is already being processed')
    }

    const supabase = await createClient()

    try {
      const batch = await this.getBatch(batchId)
      if (!batch) throw new Error('Batch not found')
      if (batch.status !== 'settled' && batch.status !== 'partially_failed') {
        throw new Error(`Cannot reverse batch with status: ${batch.status}`)
      }

      // Get all settled items
      const items = await this.getBatchItems(batchId, 'settled')

      // Reverse each item's ledger transaction
      for (const item of items) {
        if (item.ledger_transaction_id) {
          await this.ledger.reverseTransaction(item.ledger_transaction_id, reason, reversedBy)
        }

        await supabase
          .from('settlement_items')
          .update({ status: 'reversed' })
          .eq('id', item.id)
      }

      // Update batch status
      await supabase
        .from('settlement_batches')
        .update({
          status: 'reversed',
          error_message: `Reversed: ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchId)
    } finally {
      await releaseLock(lockKey)
    }
  }
}

// Singleton instance
let settlementEngineInstance: SettlementEngine | null = null

export function getSettlementEngine(config?: Partial<SettlementConfig>): SettlementEngine {
  if (!settlementEngineInstance) {
    settlementEngineInstance = new SettlementEngine(config)
  }
  return settlementEngineInstance
}
