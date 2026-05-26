/**
 * Reconciliation Engine
 * Auto-reconciliation system that compares ledger, settlements, and payouts
 * Detects discrepancies and generates reports
 */

import { createClient } from '@/lib/supabase/server'

// Types
export type ReportType = 'daily' | 'hourly' | 'manual' | 'alert'
export type ReportStatus = 'pending' | 'running' | 'completed' | 'failed' | 'mismatch_found'

export interface ReconciliationReport {
  id: string
  report_number: string
  report_type: ReportType
  report_date: string
  status: ReportStatus
  ledger_total_debits: number
  ledger_total_credits: number
  ledger_balance: number
  settlement_total_bets: number
  settlement_total_payouts: number
  settlement_total_commission: number
  payout_total_queued: number
  payout_total_completed: number
  payout_total_failed: number
  variance_amount: number
  variance_details: VarianceDetail[]
  stuck_jobs_count: number
  duplicate_payouts_count: number
  balance_mismatches_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface VarianceDetail {
  type: 'ledger_settlement' | 'ledger_payout' | 'settlement_payout' | 'balance_mismatch' | 'stuck_job' | 'duplicate'
  description: string
  expectedAmount: number
  actualAmount: number
  variance: number
  references: string[]
}

export interface ReconciliationResult {
  reportId: string
  reportNumber: string
  status: ReportStatus
  hasMismatches: boolean
  totalVariance: number
  issues: ReconciliationIssue[]
}

export interface ReconciliationIssue {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedAmount: number
  references: string[]
}

/**
 * Reconciliation Engine Class
 */
class ReconciliationEngine {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
  }

  /**
   * Generate report number
   */
  private generateReportNumber(): string {
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const time = date.getTime().toString(36).toUpperCase()
    return `REC${dateStr}${time.slice(-6)}`
  }

  /**
   * Create a new reconciliation report
   */
  async createReport(
    reportType: ReportType,
    reportDate: Date = new Date()
  ): Promise<ReconciliationReport> {
    const supabase = await this.getSupabase()
    const reportNumber = this.generateReportNumber()

    const { data, error } = await supabase
      .from('reconciliation_reports')
      .insert({
        report_number: reportNumber,
        report_type: reportType,
        report_date: reportDate.toISOString().slice(0, 10),
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create report: ${error.message}`)
    return data as ReconciliationReport
  }

  /**
   * Run full reconciliation
   */
  async runReconciliation(
    reportType: ReportType = 'daily',
    reportDate: Date = new Date()
  ): Promise<ReconciliationResult> {
    const report = await this.createReport(reportType, reportDate)
    const supabase = await this.getSupabase()
    const issues: ReconciliationIssue[] = []
    const variances: VarianceDetail[] = []

    try {
      // Update status to running
      await supabase
        .from('reconciliation_reports')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', report.id)

      const dateStr = reportDate.toISOString().slice(0, 10)
      const startOfDay = `${dateStr}T00:00:00.000Z`
      const endOfDay = `${dateStr}T23:59:59.999Z`

      // 1. Get Ledger Totals
      const ledgerTotals = await this.getLedgerTotals(startOfDay, endOfDay)

      // 2. Get Settlement Totals
      const settlementTotals = await this.getSettlementTotals(startOfDay, endOfDay)

      // 3. Get Payout Totals
      const payoutTotals = await this.getPayoutTotals(startOfDay, endOfDay)

      // 4. Check for stuck jobs
      const stuckJobs = await this.checkStuckJobs()

      // 5. Check for duplicate payouts
      const duplicates = await this.checkDuplicatePayouts(startOfDay, endOfDay)

      // 6. Check balance mismatches
      const balanceMismatches = await this.checkBalanceMismatches()

      // Calculate variances
      const ledgerSettlementVariance = Math.abs(
        ledgerTotals.totalCredits - settlementTotals.totalPayouts
      )
      if (ledgerSettlementVariance > 0.01) {
        variances.push({
          type: 'ledger_settlement',
          description: 'Variance between ledger credits and settlement payouts',
          expectedAmount: settlementTotals.totalPayouts,
          actualAmount: ledgerTotals.totalCredits,
          variance: ledgerSettlementVariance,
          references: [],
        })
        issues.push({
          type: 'ledger_settlement_variance',
          severity: ledgerSettlementVariance > 10000 ? 'high' : 'medium',
          description: `Ledger credits (${ledgerTotals.totalCredits}) don't match settlement payouts (${settlementTotals.totalPayouts})`,
          affectedAmount: ledgerSettlementVariance,
          references: [],
        })
      }

      const ledgerPayoutVariance = Math.abs(
        ledgerTotals.totalDebits - payoutTotals.totalCompleted
      )
      if (ledgerPayoutVariance > 0.01) {
        variances.push({
          type: 'ledger_payout',
          description: 'Variance between ledger debits and completed payouts',
          expectedAmount: payoutTotals.totalCompleted,
          actualAmount: ledgerTotals.totalDebits,
          variance: ledgerPayoutVariance,
          references: [],
        })
        issues.push({
          type: 'ledger_payout_variance',
          severity: ledgerPayoutVariance > 10000 ? 'high' : 'medium',
          description: `Ledger debits (${ledgerTotals.totalDebits}) don't match completed payouts (${payoutTotals.totalCompleted})`,
          affectedAmount: ledgerPayoutVariance,
          references: [],
        })
      }

      // Add stuck job issues
      if (stuckJobs.count > 0) {
        issues.push({
          type: 'stuck_jobs',
          severity: stuckJobs.count > 10 ? 'high' : 'medium',
          description: `Found ${stuckJobs.count} stuck jobs that haven't progressed`,
          affectedAmount: stuckJobs.totalAmount,
          references: stuckJobs.jobIds,
        })
      }

      // Add duplicate issues
      if (duplicates.count > 0) {
        issues.push({
          type: 'duplicate_payouts',
          severity: 'critical',
          description: `Found ${duplicates.count} potential duplicate payouts`,
          affectedAmount: duplicates.totalAmount,
          references: duplicates.jobIds,
        })
      }

      // Add balance mismatch issues
      if (balanceMismatches.count > 0) {
        issues.push({
          type: 'balance_mismatches',
          severity: 'high',
          description: `Found ${balanceMismatches.count} accounts with balance mismatches`,
          affectedAmount: balanceMismatches.totalVariance,
          references: balanceMismatches.accountIds,
        })
      }

      const totalVariance = variances.reduce((sum, v) => sum + v.variance, 0)
      const hasMismatches = issues.length > 0

      // Update report
      await supabase
        .from('reconciliation_reports')
        .update({
          status: hasMismatches ? 'mismatch_found' : 'completed',
          completed_at: new Date().toISOString(),
          ledger_total_debits: ledgerTotals.totalDebits,
          ledger_total_credits: ledgerTotals.totalCredits,
          ledger_balance: ledgerTotals.balance,
          settlement_total_bets: settlementTotals.totalBets,
          settlement_total_payouts: settlementTotals.totalPayouts,
          settlement_total_commission: settlementTotals.totalCommission,
          payout_total_queued: payoutTotals.totalQueued,
          payout_total_completed: payoutTotals.totalCompleted,
          payout_total_failed: payoutTotals.totalFailed,
          variance_amount: totalVariance,
          variance_details: variances,
          stuck_jobs_count: stuckJobs.count,
          duplicate_payouts_count: duplicates.count,
          balance_mismatches_count: balanceMismatches.count,
        })
        .eq('id', report.id)

      return {
        reportId: report.id,
        reportNumber: report.report_number,
        status: hasMismatches ? 'mismatch_found' : 'completed',
        hasMismatches,
        totalVariance,
        issues,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      
      await supabase
        .from('reconciliation_reports')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', report.id)

      throw new Error(`Reconciliation failed: ${error}`)
    }
  }

  /**
   * Get ledger totals for a date range
   */
  private async getLedgerTotals(startDate: string, endDate: string) {
    const supabase = await this.getSupabase()

    const { data } = await supabase
      .from('financial_transactions')
      .select('amount, entry_type')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'completed')

    let totalDebits = 0
    let totalCredits = 0

    if (data) {
      for (const tx of data) {
        if (tx.entry_type === 'debit') {
          totalDebits += Number(tx.amount)
        } else {
          totalCredits += Number(tx.amount)
        }
      }
    }

    return {
      totalDebits,
      totalCredits,
      balance: totalCredits - totalDebits,
    }
  }

  /**
   * Get settlement totals for a date range
   */
  private async getSettlementTotals(startDate: string, endDate: string) {
    const supabase = await this.getSupabase()

    const { data } = await supabase
      .from('settlement_batches')
      .select('total_bet_amount, total_payouts, total_commission')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'settled')

    let totalBets = 0
    let totalPayouts = 0
    let totalCommission = 0

    if (data) {
      for (const batch of data) {
        totalBets += Number(batch.total_bet_amount || 0)
        totalPayouts += Number(batch.total_payouts || 0)
        totalCommission += Number(batch.total_commission || 0)
      }
    }

    return { totalBets, totalPayouts, totalCommission }
  }

  /**
   * Get payout totals for a date range
   */
  private async getPayoutTotals(startDate: string, endDate: string) {
    const supabase = await this.getSupabase()

    const { data } = await supabase
      .from('payout_jobs')
      .select('amount, status')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    let totalQueued = 0
    let totalCompleted = 0
    let totalFailed = 0

    if (data) {
      for (const job of data) {
        const amount = Number(job.amount)
        if (job.status === 'completed') {
          totalCompleted += amount
        } else if (job.status === 'failed' || job.status === 'reversed') {
          totalFailed += amount
        } else {
          totalQueued += amount
        }
      }
    }

    return { totalQueued, totalCompleted, totalFailed }
  }

  /**
   * Check for stuck jobs (processing for too long)
   */
  private async checkStuckJobs() {
    const supabase = await this.getSupabase()
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes

    // Check stuck payout jobs
    const { data: stuckPayouts } = await supabase
      .from('payout_jobs')
      .select('id, amount')
      .in('status', ['processing', 'validating'])
      .lt('started_at', stuckThreshold)

    // Check stuck settlement batches
    const { data: stuckBatches } = await supabase
      .from('settlement_batches')
      .select('id, total_payouts')
      .in('status', ['processing', 'calculating'])
      .lt('started_at', stuckThreshold)

    const jobIds: string[] = []
    let totalAmount = 0

    if (stuckPayouts) {
      for (const job of stuckPayouts) {
        jobIds.push(job.id)
        totalAmount += Number(job.amount)
      }
    }

    if (stuckBatches) {
      for (const batch of stuckBatches) {
        jobIds.push(batch.id)
        totalAmount += Number(batch.total_payouts || 0)
      }
    }

    return {
      count: jobIds.length,
      totalAmount,
      jobIds,
    }
  }

  /**
   * Check for potential duplicate payouts
   */
  private async checkDuplicatePayouts(startDate: string, endDate: string) {
    const supabase = await this.getSupabase()

    // Find payouts with same member_id and amount within short time window
    const { data } = await supabase
      .from('payout_jobs')
      .select('id, member_id, amount, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'completed')
      .order('member_id')
      .order('created_at')

    const duplicates: { id: string; amount: number }[] = []
    const seen = new Map<string, { id: string; amount: number; timestamp: number }>()

    if (data) {
      for (const job of data) {
        const key = `${job.member_id}-${job.amount}`
        const prev = seen.get(key)
        const timestamp = new Date(job.created_at).getTime()

        if (prev && timestamp - prev.timestamp < 5 * 60 * 1000) { // Within 5 minutes
          duplicates.push({ id: job.id, amount: Number(job.amount) })
          if (!duplicates.find(d => d.id === prev.id)) {
            duplicates.push({ id: prev.id, amount: prev.amount })
          }
        }

        seen.set(key, { id: job.id, amount: Number(job.amount), timestamp })
      }
    }

    return {
      count: duplicates.length,
      totalAmount: duplicates.reduce((sum, d) => sum + d.amount, 0),
      jobIds: duplicates.map(d => d.id),
    }
  }

  /**
   * Check for balance mismatches between calculated and stored balances
   */
  private async checkBalanceMismatches() {
    const supabase = await this.getSupabase()

    // Get wallets with their stored balances
    const { data: wallets } = await supabase
      .from('wallets')
      .select('id, member_id, balance')
      .limit(1000)

    const mismatches: { accountId: string; variance: number }[] = []

    if (wallets) {
      for (const wallet of wallets) {
        // Calculate balance from transactions
        const { data: transactions } = await supabase
          .from('financial_transactions')
          .select('amount, entry_type')
          .eq('wallet_id', wallet.id)
          .eq('status', 'completed')

        if (transactions) {
          let calculatedBalance = 0
          for (const tx of transactions) {
            if (tx.entry_type === 'credit') {
              calculatedBalance += Number(tx.amount)
            } else {
              calculatedBalance -= Number(tx.amount)
            }
          }

          const storedBalance = Number(wallet.balance)
          const variance = Math.abs(calculatedBalance - storedBalance)

          if (variance > 0.01) {
            mismatches.push({ accountId: wallet.id, variance })
          }
        }
      }
    }

    return {
      count: mismatches.length,
      totalVariance: mismatches.reduce((sum, m) => sum + m.variance, 0),
      accountIds: mismatches.map(m => m.accountId),
    }
  }

  /**
   * Get reconciliation reports
   */
  async getReports(
    status?: ReportStatus,
    limit: number = 30
  ): Promise<ReconciliationReport[]> {
    const supabase = await this.getSupabase()

    let query = supabase
      .from('reconciliation_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data } = await query
    return (data || []) as ReconciliationReport[]
  }

  /**
   * Get a single report by ID
   */
  async getReport(reportId: string): Promise<ReconciliationReport | null> {
    const supabase = await this.getSupabase()

    const { data } = await supabase
      .from('reconciliation_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    return data as ReconciliationReport | null
  }

  /**
   * Resolve a reconciliation report
   */
  async resolveReport(
    reportId: string,
    resolvedBy: string,
    notes: string
  ): Promise<void> {
    const supabase = await this.getSupabase()

    await supabase
      .from('reconciliation_reports')
      .update({
        status: 'completed',
        resolved_by: resolvedBy,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reportId)
  }

  /**
   * Get reconciliation stats
   */
  async getStats() {
    const supabase = await this.getSupabase()

    const { data: reports } = await supabase
      .from('reconciliation_reports')
      .select('status, variance_amount')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const stats = {
      totalReports: 0,
      completedWithoutIssues: 0,
      withMismatches: 0,
      failed: 0,
      pending: 0,
      totalVariance: 0,
    }

    if (reports) {
      stats.totalReports = reports.length
      for (const report of reports) {
        stats.totalVariance += Number(report.variance_amount || 0)
        switch (report.status) {
          case 'completed':
            stats.completedWithoutIssues++
            break
          case 'mismatch_found':
            stats.withMismatches++
            break
          case 'failed':
            stats.failed++
            break
          default:
            stats.pending++
        }
      }
    }

    return stats
  }
}

// Singleton instance
let reconciliationEngine: ReconciliationEngine | null = null

export function getReconciliationEngine(): ReconciliationEngine {
  if (!reconciliationEngine) {
    reconciliationEngine = new ReconciliationEngine()
  }
  return reconciliationEngine
}

export { ReconciliationEngine }
