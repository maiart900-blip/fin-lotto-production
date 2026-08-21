/**
 * Today's Payout Summary System (ข้อ 80)
 * ระบบสรุป "วันนี้ต้องจ่ายเท่าไหร่"
 * - ยอดถูกรางวัลรวม
 * - ยอดถอนค้าง
 * - ยอดค้างจ่ายเอเย่น
 * - เงินที่ต้องเตรียมจ่ายจริง
 */

import { createClient } from '@/lib/supabase/server';
import { redis, REDIS_KEYS } from '@/lib/redis';
import { auditLogger } from '@/lib/audit-logger';

// =============================================
// TYPES
// =============================================

export interface TodayPayoutSummary {
  date: string;
  calculatedAt: string;
  
  // Prize payouts (ยอดถูกรางวัล)
  prizePayouts: {
    total: number;
    count: number;
    pending: number;
    pendingCount: number;
    paid: number;
    paidCount: number;
    byLottery: {
      lotteryId: string;
      lotteryName: string;
      total: number;
      count: number;
    }[];
  };
  
  // Withdrawal requests (ยอดถอนค้าง)
  withdrawals: {
    total: number;
    count: number;
    pending: number;
    pendingCount: number;
    approved: number;
    approvedCount: number;
    processing: number;
    processingCount: number;
  };
  
  // Agent commissions (ค่าคอมเอเย่น)
  agentCommissions: {
    total: number;
    count: number;
    pending: number;
    pendingCount: number;
    paid: number;
    paidCount: number;
    byAgent: {
      agentId: string;
      agentName: string;
      commission: number;
      status: 'pending' | 'paid';
    }[];
  };
  
  // Bonuses & Promotions
  bonuses: {
    total: number;
    count: number;
    pending: number;
    pendingCount: number;
  };
  
  // Refunds
  refunds: {
    total: number;
    count: number;
  };
  
  // Summary totals
  summary: {
    totalMustPay: number;           // ยอดต้องจ่ายทั้งหมด
    pendingPayouts: number;         // ค้างจ่ายรวม
    alreadyPaid: number;            // จ่ายไปแล้ว
    readyToPay: number;             // พร้อมจ่าย (approved)
    estimatedRemaining: number;     // คาดว่าต้องจ่ายเพิ่ม
  };
  
  // Available funds check
  fundsCheck: {
    bankBalance: number;            // ยอดเงินในบัญชี
    internalReserve: number;        // สำรองภายใน
    totalAvailable: number;         // รวมเงินที่มี
    shortfall: number;              // ขาด (ถ้ามี)
    isSufficient: boolean;          // เงินพอหรือไม่
  };
  
  // Warnings
  warnings: {
    type: 'info' | 'warning' | 'critical';
    message: string;
  }[];
}

export interface PayoutBreakdown {
  category: string;
  label: string;
  pending: number;
  approved: number;
  paid: number;
  total: number;
}

// =============================================
// TODAY PAYOUT SUMMARY SERVICE
// =============================================

export class TodayPayoutSummaryService {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  /**
   * คำนวณสรุปยอดต้องจ่ายวันนี้
   */
  async calculateTodaySummary(): Promise<TodayPayoutSummary> {
    const supabase = await this.getClient();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startOfDay = `${todayStr}T00:00:00+07:00`;
    const endOfDay = `${todayStr}T23:59:59+07:00`;
    const calculatedAt = today.toISOString();

    // Parallel fetch all data
    const [
      prizePayouts,
      withdrawals,
      agentCommissions,
      bonuses,
      refunds,
      fundsInfo,
    ] = await Promise.all([
      this.getPrizePayouts(supabase, startOfDay, endOfDay),
      this.getWithdrawals(supabase),
      this.getAgentCommissions(supabase, startOfDay, endOfDay),
      this.getBonuses(supabase, startOfDay, endOfDay),
      this.getRefunds(supabase, startOfDay, endOfDay),
      this.getFundsInfo(supabase),
    ]);

    // Calculate summary
    const totalMustPay = 
      prizePayouts.total + 
      withdrawals.pending + 
      agentCommissions.pending + 
      bonuses.pending +
      refunds.total;

    const pendingPayouts = 
      prizePayouts.pending + 
      withdrawals.pending + 
      agentCommissions.pending + 
      bonuses.pending;

    const alreadyPaid = 
      prizePayouts.paid + 
      withdrawals.approved +
      agentCommissions.paid +
      (bonuses.total - bonuses.pending);

    const summary = {
      totalMustPay,
      pendingPayouts,
      alreadyPaid,
      readyToPay: withdrawals.pending, // Approved but not yet transferred
      estimatedRemaining: pendingPayouts,
    };

    // Check funds
    const shortfall = Math.max(0, pendingPayouts - fundsInfo.totalAvailable);
    const fundsCheck = {
      ...fundsInfo,
      shortfall,
      isSufficient: shortfall === 0,
    };

    // Generate warnings
    const warnings = this.generateWarnings(summary, fundsCheck, prizePayouts, withdrawals);

    const result: TodayPayoutSummary = {
      date: todayStr,
      calculatedAt,
      prizePayouts,
      withdrawals,
      agentCommissions,
      bonuses,
      refunds,
      summary,
      fundsCheck,
      warnings,
    };

    // Cache result
    await redis?.set(
      `${REDIS_KEYS.DAILY_SUMMARY}:payout:${todayStr}`,
      JSON.stringify(result),
      { ex: 300 } // 5 minutes cache
    );

    return result;
  }

  /**
   * ดึงยอดถูกรางวัล
   */
  private async getPrizePayouts(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: payouts } = await supabase
      .from('prize_payouts')
      .select(`
        id, amount, status, lottery_id,
        lotteries(name)
      `)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const pending = payouts?.filter(p => p.status === 'pending') || [];
    const paid = payouts?.filter(p => p.status === 'paid') || [];

    // Group by lottery
    const byLotteryMap: Record<string, { lotteryName: string; total: number; count: number }> = {};
    payouts?.forEach(p => {
      const lotteryRelation = p.lotteries as unknown as { name: string } | { name: string }[] | null;
      const lottery = Array.isArray(lotteryRelation) ? lotteryRelation[0] : lotteryRelation;
      const lotteryId = p.lottery_id || 'unknown';
      if (!byLotteryMap[lotteryId]) {
        byLotteryMap[lotteryId] = {
          lotteryName: lottery?.name || 'Unknown',
          total: 0,
          count: 0,
        };
      }
      byLotteryMap[lotteryId].total += p.amount;
      byLotteryMap[lotteryId].count++;
    });

    const byLottery = Object.entries(byLotteryMap).map(([lotteryId, data]) => ({
      lotteryId,
      lotteryName: data.lotteryName,
      total: data.total,
      count: data.count,
    }));

    return {
      total: payouts?.reduce((sum, p) => sum + p.amount, 0) || 0,
      count: payouts?.length || 0,
      pending: pending.reduce((sum, p) => sum + p.amount, 0),
      pendingCount: pending.length,
      paid: paid.reduce((sum, p) => sum + p.amount, 0),
      paidCount: paid.length,
      byLottery,
    };
  }

  /**
   * ดึงยอดถอนค้าง
   */
  private async getWithdrawals(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: withdrawals } = await supabase
      .from('withdraw_requests')
      .select('id, amount, status')
      .in('status', ['pending', 'approved', 'processing']);

    const pending = withdrawals?.filter(w => w.status === 'pending') || [];
    const approved = withdrawals?.filter(w => w.status === 'approved') || [];
    const processing = withdrawals?.filter(w => w.status === 'processing') || [];

    return {
      total: withdrawals?.reduce((sum, w) => sum + w.amount, 0) || 0,
      count: withdrawals?.length || 0,
      pending: pending.reduce((sum, w) => sum + w.amount, 0),
      pendingCount: pending.length,
      approved: approved.reduce((sum, w) => sum + w.amount, 0),
      approvedCount: approved.length,
      processing: processing.reduce((sum, w) => sum + w.amount, 0),
      processingCount: processing.length,
    };
  }

  /**
   * ดึงค่าคอมเอเย่น
   */
  private async getAgentCommissions(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: commissions } = await supabase
      .from('agent_commissions')
      .select(`
        id, amount, status, agent_id,
        agents(name)
      `)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const pending = commissions?.filter(c => c.status === 'pending') || [];
    const paid = commissions?.filter(c => c.status === 'paid') || [];

    // Group by agent
    const byAgent = commissions?.map(c => {
      const agentRelation = c.agents as unknown as { name: string } | { name: string }[] | null;
      const agent = Array.isArray(agentRelation) ? agentRelation[0] : agentRelation;
      return {
        agentId: c.agent_id,
        agentName: agent?.name || 'Unknown',
        commission: c.amount,
        status: c.status as 'pending' | 'paid',
      };
    }) || [];

    return {
      total: commissions?.reduce((sum, c) => sum + c.amount, 0) || 0,
      count: commissions?.length || 0,
      pending: pending.reduce((sum, c) => sum + c.amount, 0),
      pendingCount: pending.length,
      paid: paid.reduce((sum, c) => sum + c.amount, 0),
      paidCount: paid.length,
      byAgent,
    };
  }

  /**
   * ดึงโบนัส
   */
  private async getBonuses(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: bonuses } = await supabase
      .from('bonus_payouts')
      .select('id, amount, status')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const pending = bonuses?.filter(b => b.status === 'pending') || [];

    return {
      total: bonuses?.reduce((sum, b) => sum + b.amount, 0) || 0,
      count: bonuses?.length || 0,
      pending: pending.reduce((sum, b) => sum + b.amount, 0),
      pendingCount: pending.length,
    };
  }

  /**
   * ดึง Refunds
   */
  private async getRefunds(
    supabase: Awaited<ReturnType<typeof createClient>>,
    startOfDay: string,
    endOfDay: string
  ) {
    const { data: refunds } = await supabase
      .from('refunds')
      .select('id, amount')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    return {
      total: refunds?.reduce((sum, r) => sum + r.amount, 0) || 0,
      count: refunds?.length || 0,
    };
  }

  /**
   * ดึงข้อมูลเงินทุน
   */
  private async getFundsInfo(supabase: Awaited<ReturnType<typeof createClient>>) {
    // Get bank balance from settings or bank_accounts table
    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('balance')
      .eq('is_active', true);

    const bankBalance = bankAccounts?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;

    // Get internal reserve from settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'internal_reserve')
      .single();

    const internalReserve = settings?.value ? parseFloat(settings.value) : 0;

    return {
      bankBalance,
      internalReserve,
      totalAvailable: bankBalance + internalReserve,
    };
  }

  /**
   * สร้างคำเตือน
   */
  private generateWarnings(
    summary: TodayPayoutSummary['summary'],
    fundsCheck: TodayPayoutSummary['fundsCheck'],
    prizePayouts: TodayPayoutSummary['prizePayouts'],
    withdrawals: TodayPayoutSummary['withdrawals']
  ) {
    const warnings: TodayPayoutSummary['warnings'] = [];

    // Funds shortage
    if (!fundsCheck.isSufficient) {
      warnings.push({
        type: 'critical',
        message: `เงินไม่พอจ่าย! ขาด ${fundsCheck.shortfall.toLocaleString()} บาท`,
      });
    } else if (fundsCheck.totalAvailable < summary.pendingPayouts * 1.2) {
      warnings.push({
        type: 'warning',
        message: `เงินเหลือน้อย ควรเตรียมเพิ่ม`,
      });
    }

    // High pending withdrawals
    if (withdrawals.pendingCount > 20) {
      warnings.push({
        type: 'warning',
        message: `มีรายการถอนรอดำเนินการ ${withdrawals.pendingCount} รายการ`,
      });
    }

    // Large prize payouts
    if (prizePayouts.pending > 500000) {
      warnings.push({
        type: 'warning',
        message: `ยอดรางวัลค้างจ่ายสูง ${prizePayouts.pending.toLocaleString()} บาท`,
      });
    }

    // High total payout
    if (summary.totalMustPay > 1000000) {
      warnings.push({
        type: 'info',
        message: `ยอดต้องจ่ายวันนี้รวม ${summary.totalMustPay.toLocaleString()} บาท`,
      });
    }

    return warnings;
  }

  /**
   * ดึง Payout Breakdown สำหรับ Dashboard
   */
  async getPayoutBreakdown(): Promise<PayoutBreakdown[]> {
    const summary = await this.calculateTodaySummary();

    return [
      {
        category: 'prizes',
        label: 'ยอดถูกรางวัล',
        pending: summary.prizePayouts.pending,
        approved: 0,
        paid: summary.prizePayouts.paid,
        total: summary.prizePayouts.total,
      },
      {
        category: 'withdrawals',
        label: 'ยอดถอน',
        pending: summary.withdrawals.pending,
        approved: summary.withdrawals.approved,
        paid: 0,
        total: summary.withdrawals.total,
      },
      {
        category: 'commissions',
        label: 'ค่าคอมเอเย่น',
        pending: summary.agentCommissions.pending,
        approved: 0,
        paid: summary.agentCommissions.paid,
        total: summary.agentCommissions.total,
      },
      {
        category: 'bonuses',
        label: 'โบนัส/โปรโมชั่น',
        pending: summary.bonuses.pending,
        approved: 0,
        paid: summary.bonuses.total - summary.bonuses.pending,
        total: summary.bonuses.total,
      },
      {
        category: 'refunds',
        label: 'คืนเงิน',
        pending: summary.refunds.total,
        approved: 0,
        paid: 0,
        total: summary.refunds.total,
      },
    ];
  }

  /**
   * ดึงสรุปย่อสำหรับแสดงหน้า Dashboard
   */
  async getQuickSummary(): Promise<{
    totalMustPay: number;
    pendingPayouts: number;
    isFundsSufficient: boolean;
    criticalWarnings: number;
  }> {
    // Try cache first
    const cached = await redis?.get<string>(`${REDIS_KEYS.DAILY_SUMMARY}:payout:quick`);
    if (cached) {
      return JSON.parse(cached);
    }

    const summary = await this.calculateTodaySummary();

    const result = {
      totalMustPay: summary.summary.totalMustPay,
      pendingPayouts: summary.summary.pendingPayouts,
      isFundsSufficient: summary.fundsCheck.isSufficient,
      criticalWarnings: summary.warnings.filter(w => w.type === 'critical').length,
    };

    // Cache for 1 minute
    await redis?.set(
      `${REDIS_KEYS.DAILY_SUMMARY}:payout:quick`,
      JSON.stringify(result),
      { ex: 60 }
    );

    return result;
  }

  /**
   * Log payout summary access
   */
  async logAccess(userId: string): Promise<void> {
    await auditLogger.log({
      action: 'PAYOUT_SUMMARY_VIEWED',
      resource: 'payout_summary',
      userId,
    });
  }
}

// Export singleton
export const todayPayoutSummary = new TodayPayoutSummaryService();




