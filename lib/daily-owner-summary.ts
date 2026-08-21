/**
 * Daily Owner Summary Alert System (ข้อ 72)
 * ระบบแจ้งเตือนเจ้าของเว็บแบบสรุปทุกวัน
 * - กำไรวันนี้
 * - ยอดฝาก
 * - ยอดถอน
 * - ยอดแทง
 * - หวยที่เสี่ยงสุด
 * - เอเย่นที่ทำยอดสูงสุด
 */

import { createClient } from '@/lib/supabase/server';
import { sendDailySummaryReport, sendLineNotify } from '@/lib/notifications/line-notify';
import { auditLogger } from '@/lib/audit-logger';
import { getBusinessDay } from '@/lib/daily-reset';

// =============================================
// TYPES
// =============================================

export interface DailyOwnerSummary {
  date: string;
  
  // Financial Summary
  profit: {
    gross: number;
    net: number;
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
  };
  
  // Deposits
  deposits: {
    total: number;
    count: number;
    avgAmount: number;
    largestDeposit: number;
    methodBreakdown: Record<string, number>;
  };
  
  // Withdrawals
  withdrawals: {
    total: number;
    count: number;
    avgAmount: number;
    largestWithdrawal: number;
    pendingCount: number;
    pendingAmount: number;
  };
  
  // Bets
  bets: {
    total: number;
    count: number;
    avgBetSize: number;
    uniqueCustomers: number;
  };
  
  // Payouts (Winnings)
  payouts: {
    total: number;
    count: number;
    pendingAmount: number;
  };
  
  // Risk Analysis
  riskAnalysis: {
    highestRiskLottery: {
      name: string;
      exposure: number;
      topNumbers: { number: string; amount: number }[];
    } | null;
    totalExposure: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  
  // Top Performers
  topAgents: {
    agentId: string;
    agentName: string;
    totalSales: number;
    commission: number;
    newCustomers: number;
  }[];
  
  // Customer Metrics
  customers: {
    total: number;
    newToday: number;
    activeToday: number;
    topCustomer: {
      phone: string;
      name: string;
      totalBets: number;
    } | null;
  };
  
  // Alerts
  alerts: {
    type: 'info' | 'warning' | 'critical';
    message: string;
  }[];
}

// =============================================
// DAILY SUMMARY SERVICE
// =============================================

export class DailyOwnerSummaryService {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  /**
   * สร้างรายงานสรุปประจำวัน
   */
  async generateDailySummary(date?: string): Promise<DailyOwnerSummary> {
    const supabase = await this.getClient();
    const targetDate = date || getBusinessDay();
    const startOfDay = `${targetDate}T00:00:00+07:00`;
    const endOfDay = `${targetDate}T23:59:59+07:00`;

    // Parallel fetch all data
    const [
      profitData,
      depositData,
      withdrawalData,
      betData,
      payoutData,
      riskData,
      agentData,
      customerData,
    ] = await Promise.all([
      this.getProfitSummary(supabase, startOfDay, endOfDay, targetDate),
      this.getDepositSummary(supabase, startOfDay, endOfDay),
      this.getWithdrawalSummary(supabase, startOfDay, endOfDay),
      this.getBetSummary(supabase, startOfDay, endOfDay),
      this.getPayoutSummary(supabase, startOfDay, endOfDay),
      this.getRiskAnalysis(supabase, startOfDay, endOfDay),
      this.getTopAgents(supabase, startOfDay, endOfDay),
      this.getCustomerMetrics(supabase, startOfDay, endOfDay),
    ]);

    // Generate alerts based on data
    const alerts = this.generateAlerts({
      profit: profitData,
      withdrawals: withdrawalData,
      risk: riskData,
    });

    const summary: DailyOwnerSummary = {
      date: targetDate,
      profit: profitData,
      deposits: depositData,
      withdrawals: withdrawalData,
      bets: betData,
      payouts: payoutData,
      riskAnalysis: riskData,
      topAgents: agentData,
      customers: customerData,
      alerts,
    };

    // Save summary to database
    await this.saveSummary(summary);

    return summary;
  }

  /**
   * Profit Summary
   */
  private async getProfitSummary(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string,
    targetDate: string
  ) {
    // Get today's revenue
    const { data: todayStats } = await supabase
      .from('daily_closings')
      .select('gross_profit, net_profit')
      .eq('closing_date', targetDate)
      .single();

    // Get yesterday's for comparison
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdayStats } = await supabase
      .from('daily_closings')
      .select('net_profit')
      .eq('closing_date', yesterdayStr)
      .single();

    const gross = todayStats?.gross_profit || 0;
    const net = todayStats?.net_profit || 0;
    const yesterdayNet = yesterdayStats?.net_profit || 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    let changePercent = 0;

    if (yesterdayNet !== 0) {
      changePercent = ((net - yesterdayNet) / Math.abs(yesterdayNet)) * 100;
      if (changePercent > 5) trend = 'up';
      else if (changePercent < -5) trend = 'down';
    }

    return { gross, net, trend, changePercent };
  }

  /**
   * Deposit Summary
   */
  private async getDepositSummary(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: deposits } = await supabase
      .from('topup_requests')
      .select('amount, deposit_method')
      .eq('status', 'approved')
      .gte('approved_at', startOfDay)
      .lte('approved_at', endOfDay);

    const amounts = deposits?.map(d => d.amount) || [];
    const total = amounts.reduce((sum, a) => sum + a, 0);
    const count = amounts.length;
    const avgAmount = count > 0 ? total / count : 0;
    const largestDeposit = amounts.length > 0 ? Math.max(...amounts) : 0;

    // Method breakdown
    const methodBreakdown: Record<string, number> = {};
    deposits?.forEach(d => {
      const method = d.deposit_method || 'unknown';
      methodBreakdown[method] = (methodBreakdown[method] || 0) + d.amount;
    });

    return { total, count, avgAmount, largestDeposit, methodBreakdown };
  }

  /**
   * Withdrawal Summary
   */
  private async getWithdrawalSummary(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: withdrawals } = await supabase
      .from('withdraw_requests')
      .select('amount, status')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const approved = withdrawals?.filter(w => w.status === 'approved') || [];
    const pending = withdrawals?.filter(w => w.status === 'pending') || [];

    const amounts = approved.map(w => w.amount);
    const total = amounts.reduce((sum, a) => sum + a, 0);
    const count = amounts.length;
    const avgAmount = count > 0 ? total / count : 0;
    const largestWithdrawal = amounts.length > 0 ? Math.max(...amounts) : 0;

    const pendingAmount = pending.reduce((sum, w) => sum + w.amount, 0);

    return {
      total,
      count,
      avgAmount,
      largestWithdrawal,
      pendingCount: pending.length,
      pendingAmount,
    };
  }

  /**
   * Bet Summary
   */
  private async getBetSummary(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: bets } = await supabase
      .from('bets')
      .select('total_amount, customer_id')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const amounts = bets?.map(b => b.total_amount) || [];
    const total = amounts.reduce((sum, a) => sum + a, 0);
    const count = amounts.length;
    const avgBetSize = count > 0 ? total / count : 0;
    const uniqueCustomers = new Set(bets?.map(b => b.customer_id)).size;

    return { total, count, avgBetSize, uniqueCustomers };
  }

  /**
   * Payout Summary
   */
  private async getPayoutSummary(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: payouts } = await supabase
      .from('prize_payouts')
      .select('amount, status')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const paid = payouts?.filter(p => p.status === 'paid') || [];
    const pending = payouts?.filter(p => p.status === 'pending') || [];

    const total = paid.reduce((sum, p) => sum + p.amount, 0);
    const count = paid.length;
    const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);

    return { total, count, pendingAmount };
  }

  /**
   * Risk Analysis
   */
  private async getRiskAnalysis(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    // Get lottery exposure
    const { data: lotteryBets } = await supabase
      .from('bets')
      .select('lottery_id, total_amount, bet_items')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const lotteryExposure: Record<string, number> = {};
    const numberExposure: Record<string, Record<string, number>> = {};

    lotteryBets?.forEach(bet => {
      const lotteryId = bet.lottery_id || 'unknown';
      lotteryExposure[lotteryId] = (lotteryExposure[lotteryId] || 0) + bet.total_amount;

      // Track number exposure
      if (!numberExposure[lotteryId]) numberExposure[lotteryId] = {};
      if (Array.isArray(bet.bet_items)) {
        bet.bet_items.forEach((item: { number?: string; amount?: number }) => {
          if (item.number) {
            numberExposure[lotteryId][item.number] = 
              (numberExposure[lotteryId][item.number] || 0) + (item.amount || 0);
          }
        });
      }
    });

    // Find highest risk lottery
    let highestRiskLottery = null;
    let maxExposure = 0;

    Object.entries(lotteryExposure).forEach(([lotteryId, exposure]) => {
      if (exposure > maxExposure) {
        maxExposure = exposure;
        const topNumbers = Object.entries(numberExposure[lotteryId] || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([number, amount]) => ({ number, amount }));

        highestRiskLottery = {
          name: lotteryId,
          exposure,
          topNumbers,
        };
      }
    });

    const totalExposure = Object.values(lotteryExposure).reduce((sum, e) => sum + e, 0);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (totalExposure > 1000000) riskLevel = 'critical';
    else if (totalExposure > 500000) riskLevel = 'high';
    else if (totalExposure > 100000) riskLevel = 'medium';

    return { highestRiskLottery, totalExposure, riskLevel };
  }

  /**
   * Top Agents
   */
  private async getTopAgents(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: agentSales } = await supabase
      .from('bets')
      .select(`
        agent_id,
        total_amount,
        agents!inner(name, commission_rate)
      `)
      .not('agent_id', 'is', null)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const agentStats: Record<string, { sales: number; name: string; rate: number }> = {};

    agentSales?.forEach(sale => {
      const agentRelation = sale.agents as unknown as { name: string; commission_rate: number } | { name: string; commission_rate: number }[] | null;
      const agent = Array.isArray(agentRelation) ? agentRelation[0] : agentRelation;
      if (!agentStats[sale.agent_id]) {
        agentStats[sale.agent_id] = {
          sales: 0,
          name: agent?.name || 'Unknown',
          rate: agent?.commission_rate || 0,
        };
      }
      agentStats[sale.agent_id].sales += sale.total_amount;
    });

    return Object.entries(agentStats)
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 5)
      .map(([agentId, stats]) => ({
        agentId,
        agentName: stats.name,
        totalSales: stats.sales,
        commission: stats.sales * stats.rate,
        newCustomers: 0, // Would need separate query
      }));
  }

  /**
   * Customer Metrics
   */
  private async getCustomerMetrics(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { count: total } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const { count: newToday } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const { data: activeBets } = await supabase
      .from('bets')
      .select('customer_id')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const activeToday = new Set(activeBets?.map(b => b.customer_id)).size;

    // Top customer
    const customerBets: Record<string, number> = {};
    activeBets?.forEach(b => {
      customerBets[b.customer_id] = (customerBets[b.customer_id] || 0) + 1;
    });

    let topCustomer = null;
    const topCustomerId = Object.entries(customerBets)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    if (topCustomerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('phone, name')
        .eq('id', topCustomerId)
        .single();

      if (customer) {
        topCustomer = {
          phone: customer.phone,
          name: customer.name,
          totalBets: customerBets[topCustomerId],
        };
      }
    }

    return {
      total: total || 0,
      newToday: newToday || 0,
      activeToday,
      topCustomer,
    };
  }

  /**
   * Generate Alerts
   */
  private generateAlerts(data: {
    profit: { net: number; changePercent: number };
    withdrawals: { pendingAmount: number };
    risk: { riskLevel: string; totalExposure: number };
  }) {
    const alerts: { type: 'info' | 'warning' | 'critical'; message: string }[] = [];

    // Profit alerts
    if (data.profit.net < 0) {
      alerts.push({
        type: 'warning',
        message: `ขาดทุนวันนี้ ${Math.abs(data.profit.net).toLocaleString()} บาท`,
      });
    }

    if (data.profit.changePercent < -20) {
      alerts.push({
        type: 'critical',
        message: `กำไรลดลง ${Math.abs(data.profit.changePercent).toFixed(1)}% จากเมื่อวาน`,
      });
    }

    // Withdrawal alerts
    if (data.withdrawals.pendingAmount > 100000) {
      alerts.push({
        type: 'warning',
        message: `มียอดถอนรออนุมัติ ${data.withdrawals.pendingAmount.toLocaleString()} บาท`,
      });
    }

    // Risk alerts
    if (data.risk.riskLevel === 'critical') {
      alerts.push({
        type: 'critical',
        message: `ความเสี่ยงสูงมาก: Exposure ${data.risk.totalExposure.toLocaleString()} บาท`,
      });
    } else if (data.risk.riskLevel === 'high') {
      alerts.push({
        type: 'warning',
        message: `ความเสี่ยงสูง: Exposure ${data.risk.totalExposure.toLocaleString()} บาท`,
      });
    }

    return alerts;
  }

  /**
   * Save Summary to Database
   */
  private async saveSummary(summary: DailyOwnerSummary): Promise<void> {
    const supabase = await this.getClient();

    await supabase.from('daily_owner_summaries').upsert({
      summary_date: summary.date,
      summary_data: summary,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'summary_date',
    });

    await auditLogger.log({
      action: 'DAILY_SUMMARY_GENERATED',
      resource: 'daily_owner_summary',
      resourceId: summary.date,
      metadata: {
        net_profit: summary.profit.net,
        total_bets: summary.bets.total,
        alert_count: summary.alerts.length,
      },
    });
  }

  /**
   * Send Summary to Owner via LINE
   */
  async sendToOwner(summary: DailyOwnerSummary): Promise<void> {
    await sendDailySummaryReport(summary.date, {
      deposits: {
        count: summary.deposits.count,
        total: summary.deposits.total,
      },
      withdrawals: {
        count: summary.withdrawals.count,
        total: summary.withdrawals.total,
      },
      bets: {
        count: summary.bets.count,
        total: summary.bets.total,
      },
      wins: {
        count: summary.payouts.count,
        total: summary.payouts.total,
      },
      newMembers: summary.customers.newToday,
      activeMembers: summary.customers.activeToday,
      netProfit: summary.profit.net,
      topAgent: summary.topAgents[0] ? {
        name: summary.topAgents[0].agentName,
        sales: summary.topAgents[0].totalSales,
      } : undefined,
      topNumber: summary.riskAnalysis.highestRiskLottery?.topNumbers[0] ? {
        number: summary.riskAnalysis.highestRiskLottery.topNumbers[0].number,
        amount: summary.riskAnalysis.highestRiskLottery.topNumbers[0].amount,
      } : undefined,
    });
  }

  /**
   * Get Historical Summaries
   */
  async getHistoricalSummaries(
    fromDate: string,
    toDate: string
  ): Promise<DailyOwnerSummary[]> {
    const supabase = await this.getClient();

    const { data } = await supabase
      .from('daily_owner_summaries')
      .select('summary_data')
      .gte('summary_date', fromDate)
      .lte('summary_date', toDate)
      .order('summary_date', { ascending: false });

    return data?.map(d => d.summary_data as DailyOwnerSummary) || [];
  }
}

// Export singleton
export const dailyOwnerSummary = new DailyOwnerSummaryService();


