/**
 * Master Settlement Center
 * Handles settlement cycles, transactions, and automated reconciliation
 */

import { createClient } from '@/lib/supabase/server'
import { RevenueShareEngine } from './revenue-share-engine'

export interface SettlementCycle {
  id: string
  cycle_number: string
  cycle_type: 'daily' | 'weekly' | 'monthly' | 'manual'
  period_start: string
  period_end: string
  total_turnover: number
  total_wins: number
  total_gross_profit: number
  total_tenant_share: number
  total_platform_share: number
  total_provider_share: number
  total_adjustments: number
  total_net_profit: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'disputed'
  processed_at?: string
  approved_by?: string
  approved_at?: string
  tenants_processed: number
  transactions_count: number
  errors: Array<{ tenant_id: string; error: string }>
  created_at: string
}

export interface SettlementTransaction {
  id: string
  cycle_id: string
  tenant_id: string
  provider_id?: string
  transaction_type: 'tenant_share' | 'platform_share' | 'provider_share' | 'adjustment' | 'bonus' | 'fee'
  game_type?: string
  gross_amount: number
  share_percent: number
  calculated_amount: number
  adjustments: number
  net_amount: number
  reference_period_start?: string
  reference_period_end?: string
  entry_count: number
  status: 'pending' | 'approved' | 'paid' | 'disputed' | 'cancelled'
  paid_at?: string
  payment_reference?: string
  notes?: string
}

export interface TenantRevenueReport {
  id: string
  tenant_id: string
  report_date: string
  report_type: 'daily' | 'weekly' | 'monthly'
  // By game type
  lottery_turnover: number
  lottery_wins: number
  lottery_gross_profit: number
  lottery_share: number
  casino_turnover: number
  casino_wins: number
  casino_gross_profit: number
  casino_share: number
  slots_turnover: number
  slots_wins: number
  slots_gross_profit: number
  slots_share: number
  sports_turnover: number
  sports_wins: number
  sports_gross_profit: number
  sports_share: number
  // Totals
  total_turnover: number
  total_wins: number
  total_gross_profit: number
  total_tenant_share: number
  total_platform_share: number
  settlement_status: 'pending' | 'settled' | 'disputed'
  settled_at?: string
  cycle_id?: string
}

export class MasterSettlementCenter {
  
  /**
   * Generate cycle number
   */
  private static generateCycleNumber(type: string, date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const prefix = type.charAt(0).toUpperCase()
    return `${prefix}${year}${month}${day}-${Date.now().toString(36).toUpperCase()}`
  }
  
  /**
   * Create a new settlement cycle
   */
  static async createSettlementCycle(
    cycleType: 'daily' | 'weekly' | 'monthly' | 'manual',
    periodStart: Date,
    periodEnd: Date
  ): Promise<SettlementCycle> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('settlement_cycles')
      .insert({
        cycle_number: this.generateCycleNumber(cycleType, periodStart),
        cycle_type: cycleType,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        status: 'pending'
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }
  
  /**
   * Process daily settlement for all tenants
   */
  static async processDailySettlement(date?: Date): Promise<SettlementCycle> {
    const supabase = await createClient()
    const targetDate = date || new Date()
    targetDate.setHours(0, 0, 0, 0)
    
    const periodStart = new Date(targetDate)
    const periodEnd = new Date(targetDate)
    periodEnd.setHours(23, 59, 59, 999)
    
    // Create settlement cycle
    const cycle = await this.createSettlementCycle('daily', periodStart, periodEnd)
    
    try {
      // Update cycle to processing
      await supabase
        .from('settlement_cycles')
        .update({ status: 'processing' })
        .eq('id', cycle.id)
      
      // Get all active tenants
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('is_active', true)
      
      if (!tenants || tenants.length === 0) {
        throw new Error('No active tenants found')
      }
      
      let totalTurnover = 0
      let totalWins = 0
      let totalGrossProfit = 0
      let totalTenantShare = 0
      let totalPlatformShare = 0
      let totalProviderShare = 0
      let transactionsCount = 0
      const errors: Array<{ tenant_id: string; error: string }> = []
      
      // Process each tenant
      for (const tenant of tenants) {
        try {
          const report = await this.generateTenantRevenueReport(
            tenant.id,
            targetDate,
            'daily'
          )
          
          // Create settlement transactions
          if (report.total_gross_profit > 0) {
            // Tenant share transaction
            await supabase
              .from('settlement_transactions')
              .insert({
                cycle_id: cycle.id,
                tenant_id: tenant.id,
                transaction_type: 'tenant_share',
                gross_amount: report.total_gross_profit,
                share_percent: (report.total_tenant_share / report.total_gross_profit) * 100,
                calculated_amount: report.total_tenant_share,
                adjustments: 0,
                net_amount: report.total_tenant_share,
                reference_period_start: targetDate.toISOString().split('T')[0],
                reference_period_end: targetDate.toISOString().split('T')[0],
                status: 'pending'
              })
            
            // Platform share transaction
            await supabase
              .from('settlement_transactions')
              .insert({
                cycle_id: cycle.id,
                tenant_id: tenant.id,
                transaction_type: 'platform_share',
                gross_amount: report.total_gross_profit,
                share_percent: (report.total_platform_share / report.total_gross_profit) * 100,
                calculated_amount: report.total_platform_share,
                adjustments: 0,
                net_amount: report.total_platform_share,
                reference_period_start: targetDate.toISOString().split('T')[0],
                reference_period_end: targetDate.toISOString().split('T')[0],
                status: 'pending'
              })
            
            transactionsCount += 2
          }
          
          // Update tenant report with cycle reference
          await supabase
            .from('tenant_revenue_reports')
            .update({ cycle_id: cycle.id })
            .eq('id', report.id)
          
          // Accumulate totals
          totalTurnover += report.total_turnover
          totalWins += report.total_wins
          totalGrossProfit += report.total_gross_profit
          totalTenantShare += report.total_tenant_share
          totalPlatformShare += report.total_platform_share
          
        } catch (err) {
          errors.push({
            tenant_id: tenant.id,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }
      
      // Update cycle with totals
      const { data: updatedCycle, error: updateError } = await supabase
        .from('settlement_cycles')
        .update({
          total_turnover: totalTurnover,
          total_wins: totalWins,
          total_gross_profit: totalGrossProfit,
          total_tenant_share: totalTenantShare,
          total_platform_share: totalPlatformShare,
          total_provider_share: totalProviderShare,
          total_net_profit: totalPlatformShare - totalProviderShare,
          status: errors.length > 0 ? 'completed' : 'completed',
          processed_at: new Date().toISOString(),
          tenants_processed: tenants.length - errors.length,
          transactions_count: transactionsCount,
          errors: errors
        })
        .eq('id', cycle.id)
        .select()
        .single()
      
      if (updateError) throw updateError
      
      // Generate owner profit report
      await this.generateOwnerProfitReport(targetDate, 'daily')
      
      return updatedCycle
      
    } catch (err) {
      // Mark cycle as failed
      await supabase
        .from('settlement_cycles')
        .update({
          status: 'failed',
          errors: [{ tenant_id: 'system', error: err instanceof Error ? err.message : 'Unknown error' }]
        })
        .eq('id', cycle.id)
      
      throw err
    }
  }
  
  /**
   * Generate tenant revenue report
   */
  static async generateTenantRevenueReport(
    tenantId: string,
    date: Date,
    reportType: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<TenantRevenueReport> {
    const supabase = await createClient()
    const reportDate = date.toISOString().split('T')[0]
    
    // Get lottery data from entries
    const { data: lotteryData } = await supabase
      .from('entries')
      .select('total_amount, total_payout, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', `${reportDate}T00:00:00`)
      .lte('created_at', `${reportDate}T23:59:59`)
    
    const lotteryTurnover = lotteryData?.reduce((sum, e) => sum + Number(e.total_amount || 0), 0) || 0
    const lotteryWins = lotteryData?.reduce((sum, e) => sum + Number(e.total_payout || 0), 0) || 0
    const lotteryGrossProfit = lotteryTurnover - lotteryWins
    
    // Calculate revenue shares
    const lotteryCalc = await RevenueShareEngine.calculateRevenue(tenantId, lotteryGrossProfit, 'lottery')
    
    // For now, other game types are 0 (can be expanded)
    const totalTurnover = lotteryTurnover
    const totalWins = lotteryWins
    const totalGrossProfit = lotteryGrossProfit
    const totalTenantShare = lotteryCalc.tenant_share
    const totalPlatformShare = lotteryCalc.platform_share
    
    // Upsert the report
    const { data, error } = await supabase
      .from('tenant_revenue_reports')
      .upsert({
        tenant_id: tenantId,
        report_date: reportDate,
        report_type: reportType,
        lottery_turnover: lotteryTurnover,
        lottery_wins: lotteryWins,
        lottery_gross_profit: lotteryGrossProfit,
        lottery_share: lotteryCalc.tenant_share,
        casino_turnover: 0,
        casino_wins: 0,
        casino_gross_profit: 0,
        casino_share: 0,
        slots_turnover: 0,
        slots_wins: 0,
        slots_gross_profit: 0,
        slots_share: 0,
        sports_turnover: 0,
        sports_wins: 0,
        sports_gross_profit: 0,
        sports_share: 0,
        total_turnover: totalTurnover,
        total_wins: totalWins,
        total_gross_profit: totalGrossProfit,
        total_tenant_share: totalTenantShare,
        total_platform_share: totalPlatformShare,
        settlement_status: 'pending'
      }, {
        onConflict: 'tenant_id,report_date,report_type'
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  }
  
  /**
   * Generate owner profit report
   */
  static async generateOwnerProfitReport(
    date: Date,
    reportType: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily'
  ): Promise<void> {
    const supabase = await createClient()
    const reportDate = date.toISOString().split('T')[0]
    
    // Aggregate all tenant reports
    const { data: tenantReports } = await supabase
      .from('tenant_revenue_reports')
      .select('*')
      .eq('report_date', reportDate)
      .eq('report_type', reportType)
    
    const totalTenantTurnover = tenantReports?.reduce((sum, r) => sum + Number(r.total_turnover || 0), 0) || 0
    const totalTenantWins = tenantReports?.reduce((sum, r) => sum + Number(r.total_wins || 0), 0) || 0
    const totalTenantGrossProfit = tenantReports?.reduce((sum, r) => sum + Number(r.total_gross_profit || 0), 0) || 0
    const totalPlatformShare = tenantReports?.reduce((sum, r) => sum + Number(r.total_platform_share || 0), 0) || 0
    
    // Get subscription revenue
    const { data: subscriptions } = await supabase
      .from('tenant_subscriptions')
      .select('price_override, packages(price_monthly)')
      .eq('status', 'active')
    
    const subscriptionRevenue = subscriptions?.reduce((sum, s) => {
      const price = s.price_override || (s.packages as { price_monthly: number })?.price_monthly || 0
      return sum + Number(price)
    }, 0) || 0
    
    // Calculate net profit
    const grossProfit = totalPlatformShare + subscriptionRevenue
    const netProfit = grossProfit // Minus operational costs if tracked
    const profitMargin = totalTenantTurnover > 0 ? (netProfit / totalTenantTurnover) * 100 : 0
    
    // Get top tenants
    const topTenants = (tenantReports || [])
      .sort((a, b) => Number(b.total_turnover || 0) - Number(a.total_turnover || 0))
      .slice(0, 5)
      .map(t => ({
        tenant_id: t.tenant_id,
        turnover: t.total_turnover,
        profit: t.total_gross_profit,
        platform_share: t.total_platform_share
      }))
    
    // Upsert owner profit report
    await supabase
      .from('owner_profit_reports')
      .upsert({
        report_date: reportDate,
        report_type: reportType,
        total_tenant_turnover: totalTenantTurnover,
        total_tenant_wins: totalTenantWins,
        total_tenant_gross_profit: totalTenantGrossProfit,
        total_platform_share: totalPlatformShare,
        total_provider_costs: 0,
        subscription_revenue: subscriptionRevenue,
        operational_costs: 0,
        gross_profit: grossProfit,
        net_profit: netProfit,
        profit_margin_percent: profitMargin,
        active_tenants: tenantReports?.length || 0,
        top_tenants: topTenants
      }, {
        onConflict: 'report_date,report_type'
      })
  }
  
  /**
   * Get settlement cycle by ID
   */
  static async getCycle(cycleId: string): Promise<SettlementCycle | null> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('settlement_cycles')
      .select('*')
      .eq('id', cycleId)
      .single()
    return data
  }
  
  /**
   * Get settlement cycles with filters
   */
  static async getCycles(filters?: {
    status?: string
    cycleType?: string
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<SettlementCycle[]> {
    const supabase = await createClient()
    
    let query = supabase
      .from('settlement_cycles')
      .select('*')
      .order('period_start', { ascending: false })
    
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.cycleType) {
      query = query.eq('cycle_type', filters.cycleType)
    }
    if (filters?.startDate) {
      query = query.gte('period_start', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('period_end', filters.endDate)
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  }
  
  /**
   * Get transactions for a cycle
   */
  static async getCycleTransactions(cycleId: string): Promise<SettlementTransaction[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('settlement_transactions')
      .select('*, tenants(name)')
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }
  
  /**
   * Approve a settlement cycle
   */
  static async approveCycle(cycleId: string, approvedBy: string): Promise<SettlementCycle> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('settlement_cycles')
      .update({
        status: 'completed',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', cycleId)
      .select()
      .single()
    
    if (error) throw error
    
    // Mark all transactions as approved
    await supabase
      .from('settlement_transactions')
      .update({ status: 'approved' })
      .eq('cycle_id', cycleId)
      .eq('status', 'pending')
    
    return data
  }
  
  /**
   * Get owner profit reports
   */
  static async getOwnerProfitReports(filters?: {
    reportType?: string
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<Array<{
    report_date: string
    report_type: string
    total_tenant_turnover: number
    total_platform_share: number
    subscription_revenue: number
    gross_profit: number
    net_profit: number
    profit_margin_percent: number
    active_tenants: number
    top_tenants: Array<{ tenant_id: string; turnover: number; profit: number }>
  }>> {
    const supabase = await createClient()
    
    let query = supabase
      .from('owner_profit_reports')
      .select('*')
      .order('report_date', { ascending: false })
    
    if (filters?.reportType) {
      query = query.eq('report_type', filters.reportType)
    }
    if (filters?.startDate) {
      query = query.gte('report_date', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('report_date', filters.endDate)
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  }
  
  /**
   * Create a revenue adjustment
   */
  static async createAdjustment(params: {
    tenantId?: string
    providerId?: string
    cycleId?: string
    adjustmentType: 'bonus' | 'penalty' | 'correction' | 'refund' | 'fee' | 'promotion' | 'manual'
    amount: number
    isCredit: boolean
    reason: string
    createdBy?: string
  }): Promise<{ id: string }> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('revenue_adjustments')
      .insert({
        tenant_id: params.tenantId,
        provider_id: params.providerId,
        cycle_id: params.cycleId,
        adjustment_type: params.adjustmentType,
        amount: params.amount,
        is_credit: params.isCredit,
        reason: params.reason,
        created_by: params.createdBy,
        status: 'pending'
      })
      .select('id')
      .single()
    
    if (error) throw error
    return data
  }
  
  /**
   * Approve revenue adjustment
   */
  static async approveAdjustment(adjustmentId: string, approvedBy: string): Promise<void> {
    const supabase = await createClient()
    
    await supabase
      .from('revenue_adjustments')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', adjustmentId)
  }
}

export default MasterSettlementCenter
