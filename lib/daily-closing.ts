import { createClient } from '@/lib/supabase/server';
import { getBusinessDate } from '@/lib/daily-reset';
import { auditLogger } from '@/lib/audit-logger';

// =====================================================
// TYPES
// =====================================================

export interface DailyClosingData {
  closing_date: string;
  total_deposits: number;
  deposit_count: number;
  total_withdrawals: number;
  withdrawal_count: number;
  total_bets: number;
  bet_count: number;
  total_winnings: number;
  winning_count: number;
  total_payouts: number;
  payout_count: number;
  total_bonuses: number;
  bonus_count: number;
  total_sales: number;
  pending_balance: number;
  pending_withdrawals: number;
  pending_payouts: number;
  gross_profit: number;
  net_profit: number;
  agent_commission: number;
  agent_count: number;
  total_customers: number;
  new_customers: number;
  active_customers: number;
  status: 'open' | 'closed' | 'finalized' | 'locked';
  closing_type?: 'auto' | 'manual';
  is_locked?: boolean;
  has_anomalies?: boolean;
  anomaly_flags?: AnomalyFlag[];
  details?: Record<string, unknown>;
  breakdown?: DailyBreakdown;
}

export interface DailyBreakdown {
  deposits_by_method?: Record<string, number>;
  withdrawals_by_method?: Record<string, number>;
  bets_by_lottery?: Record<string, number>;
  payouts_by_lottery?: Record<string, number>;
  agents_breakdown?: AgentBreakdown[];
}

export interface AgentBreakdown {
  agent_id: string;
  agent_name: string;
  total_sales: number;
  commission: number;
  customers: number;
}

export interface AnomalyFlag {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  amount?: number;
}

export interface DailyClosingSummary {
  id: string;
  closing_date: string;
  closing_time: string;
  total_deposits: number;
  deposit_count: number;
  total_withdrawals: number;
  withdrawal_count: number;
  total_bets: number;
  bet_count: number;
  total_winnings: number;
  winning_count: number;
  total_payouts: number;
  payout_count: number;
  total_bonuses: number;
  bonus_count: number;
  total_sales: number;
  pending_balance: number;
  pending_withdrawals: number;
  pending_payouts: number;
  gross_profit: number;
  net_profit: number;
  agent_commission: number;
  agent_count: number;
  total_customers: number;
  new_customers: number;
  active_customers: number;
  status: string;
  closing_type: string;
  is_locked: boolean;
  has_anomalies: boolean;
  anomaly_flags?: AnomalyFlag[];
  notes?: string;
  breakdown?: DailyBreakdown;
  created_at: string;
}

export interface SearchFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  agentId?: string;
  phone?: string;
  betId?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: string;
  hasAnomalies?: boolean;
}

export interface AuditLogEntry {
  daily_closing_id: string;
  closing_date: string;
  action: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  performed_by: string;
  performer_role: string;
  performer_name: string;
  reason: string;
  ip_address?: string;
}

// =====================================================
// ANOMALY DETECTION
// =====================================================

const ANOMALY_THRESHOLDS = {
  // ยอดฝากผิดปกติ (สูงกว่าค่าเฉลี่ย 3 เท่า)
  DEPOSIT_SPIKE_MULTIPLIER: 3,
  // ยอดถอนผิดปกติ
  WITHDRAWAL_SPIKE_MULTIPLIER: 3,
  // Withdrawal > Deposit ratio
  WITHDRAWAL_DEPOSIT_RATIO: 1.5,
  // ยอดแทงต่อคน สูงผิดปกติ
  BET_PER_USER_THRESHOLD: 50000,
  // Win rate สูงผิดปกติ
  WIN_RATE_THRESHOLD: 0.7,
  // Net loss threshold (ขาดทุนหนัก)
  NET_LOSS_THRESHOLD: -100000,
};

async function detectAnomalies(
  supabase: ReturnType<typeof createClient>,
  data: DailyClosingData,
  previousDays: DailyClosingSummary[]
): Promise<AnomalyFlag[]> {
  const anomalies: AnomalyFlag[] = [];

  // คำนวณค่าเฉลี่ย 7 วันย้อนหลัง
  const avgDeposits = previousDays.length > 0
    ? previousDays.reduce((sum, d) => sum + Number(d.total_deposits), 0) / previousDays.length
    : data.total_deposits;
  
  const avgWithdrawals = previousDays.length > 0
    ? previousDays.reduce((sum, d) => sum + Number(d.total_withdrawals), 0) / previousDays.length
    : data.total_withdrawals;

  // 1. ตรวจสอบยอดฝากสูงผิดปกติ
  if (data.total_deposits > avgDeposits * ANOMALY_THRESHOLDS.DEPOSIT_SPIKE_MULTIPLIER && avgDeposits > 0) {
    anomalies.push({
      type: 'deposit_spike',
      severity: 'warning',
      title: 'ยอดฝากสูงผิดปกติ',
      description: `ยอดฝากวันนี้ (${data.total_deposits.toLocaleString()} บาท) สูงกว่าค่าเฉลี่ย 7 วัน (${avgDeposits.toLocaleString()} บาท) มากกว่า 3 เท่า`,
      amount: data.total_deposits,
    });
  }

  // 2. ตรวจสอบยอดถอนสูงผิดปกติ
  if (data.total_withdrawals > avgWithdrawals * ANOMALY_THRESHOLDS.WITHDRAWAL_SPIKE_MULTIPLIER && avgWithdrawals > 0) {
    anomalies.push({
      type: 'withdrawal_spike',
      severity: 'warning',
      title: 'ยอดถอนสูงผิดปกติ',
      description: `ยอดถอนวันนี้ (${data.total_withdrawals.toLocaleString()} บาท) สูงกว่าค่าเฉลี่ย 7 วัน`,
      amount: data.total_withdrawals,
    });
  }

  // 3. ตรวจสอบ withdrawal > deposit
  if (data.total_deposits > 0 && 
      data.total_withdrawals / data.total_deposits > ANOMALY_THRESHOLDS.WITHDRAWAL_DEPOSIT_RATIO) {
    anomalies.push({
      type: 'withdrawal_exceeds_deposit',
      severity: 'critical',
      title: 'ยอดถอนมากกว่ายอดฝาก',
      description: `ยอดถอน (${data.total_withdrawals.toLocaleString()}) มากกว่ายอดฝาก (${data.total_deposits.toLocaleString()}) เกิน 1.5 เท่า`,
      amount: data.total_withdrawals - data.total_deposits,
    });
  }

  // 4. ตรวจสอบยอดแทงต่อคนสูงผิดปกติ
  if (data.active_customers > 0) {
    const betPerUser = data.total_bets / data.active_customers;
    if (betPerUser > ANOMALY_THRESHOLDS.BET_PER_USER_THRESHOLD) {
      anomalies.push({
        type: 'high_bet_per_user',
        severity: 'warning',
        title: 'ยอดแทงต่อคนสูงผิดปกติ',
        description: `ยอดแทงเฉลี่ยต่อคน (${betPerUser.toLocaleString()} บาท) สูงกว่าเกณฑ์`,
        amount: betPerUser,
      });
    }
  }

  // 5. ตรวจสอบ win rate สูงผิดปกติ
  if (data.bet_count > 0) {
    const winRate = data.winning_count / data.bet_count;
    if (winRate > ANOMALY_THRESHOLDS.WIN_RATE_THRESHOLD) {
      anomalies.push({
        type: 'high_win_rate',
        severity: 'critical',
        title: 'อัตราถูกรางวัลสูงผิดปกติ',
        description: `Win rate ${(winRate * 100).toFixed(1)}% สูงกว่าเกณฑ์ปกติ`,
        amount: data.total_payouts,
      });
    }
  }

  // 6. ตรวจสอบขาดทุนหนัก
  if (data.net_profit < ANOMALY_THRESHOLDS.NET_LOSS_THRESHOLD) {
    anomalies.push({
      type: 'heavy_loss',
      severity: 'critical',
      title: 'ขาดทุนหนัก',
      description: `ขาดทุนสุทธิ ${Math.abs(data.net_profit).toLocaleString()} บาท`,
      amount: data.net_profit,
    });
  }

  // 7. ตรวจสอบรายการที่ยังไม่จ่าย
  if (data.pending_payouts > 0) {
    anomalies.push({
      type: 'pending_payouts',
      severity: 'info',
      title: 'มียอดค้างจ่ายรางวัล',
      description: `ยอดค้างจ่ายรางวัล ${data.pending_payouts.toLocaleString()} บาท`,
      amount: data.pending_payouts,
    });
  }

  return anomalies;
}

// =====================================================
// DATA FETCHING
// =====================================================

// ดึงข้อมูล transactions ของวันที่ระบุ
async function getTransactionsForDate(supabase: ReturnType<typeof createClient>, date: string) {
  const startOfDay = `${date}T00:00:00+07:00`;
  const endOfDay = `${date}T23:59:59+07:00`;

  // ยอดฝาก
  const { data: deposits, count: depositCount } = await supabase
    .from('transactions')
    .select('amount, payment_method', { count: 'exact' })
    .eq('type', 'deposit')
    .eq('status', 'completed')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalDeposits = deposits?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  
  // Breakdown by method
  const depositsByMethod: Record<string, number> = {};
  deposits?.forEach(d => {
    const method = d.payment_method || 'unknown';
    depositsByMethod[method] = (depositsByMethod[method] || 0) + Number(d.amount);
  });

  // ยอดถอน
  const { data: withdrawals, count: withdrawalCount } = await supabase
    .from('transactions')
    .select('amount, payment_method', { count: 'exact' })
    .eq('type', 'withdrawal')
    .eq('status', 'completed')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalWithdrawals = withdrawals?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  
  const withdrawalsByMethod: Record<string, number> = {};
  withdrawals?.forEach(w => {
    const method = w.payment_method || 'unknown';
    withdrawalsByMethod[method] = (withdrawalsByMethod[method] || 0) + Number(w.amount);
  });

  // ยอดถอนค้าง
  const { data: pendingWithdrawals } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'withdrawal')
    .eq('status', 'pending');

  const pendingWithdrawalAmount = pendingWithdrawals?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // ยอดโบนัส
  const { data: bonuses, count: bonusCount } = await supabase
    .from('transactions')
    .select('amount', { count: 'exact' })
    .eq('type', 'bonus')
    .eq('status', 'completed')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalBonuses = bonuses?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  return {
    total_deposits: totalDeposits,
    deposit_count: depositCount || 0,
    total_withdrawals: totalWithdrawals,
    withdrawal_count: withdrawalCount || 0,
    total_bonuses: totalBonuses,
    bonus_count: bonusCount || 0,
    pending_withdrawals: pendingWithdrawalAmount,
    deposits_by_method: depositsByMethod,
    withdrawals_by_method: withdrawalsByMethod,
  };
}

// ดึงข้อมูล bets ของวันที่ระบุ
async function getBetsForDate(supabase: ReturnType<typeof createClient>, date: string) {
  const startOfDay = `${date}T00:00:00+07:00`;
  const endOfDay = `${date}T23:59:59+07:00`;

  // ยอดแทงทั้งหมด
  const { data: bets, count: betCount } = await supabase
    .from('bets')
    .select('amount, status, lottery_id', { count: 'exact' })
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalBets = bets?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
  
  // Breakdown by lottery
  const betsByLottery: Record<string, number> = {};
  bets?.forEach(b => {
    const lottery = b.lottery_id || 'unknown';
    betsByLottery[lottery] = (betsByLottery[lottery] || 0) + Number(b.amount);
  });

  // ยอดถูกรางวัล
  const { data: winningBets, count: winningCount } = await supabase
    .from('bets')
    .select('payout_amount, lottery_id', { count: 'exact' })
    .eq('status', 'won')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalWinnings = winningBets?.reduce((sum, b) => sum + Number(b.payout_amount || 0), 0) || 0;

  // ยอดจ่ายรางวัลจริง (paid)
  const { data: payouts, count: payoutCount } = await supabase
    .from('bets')
    .select('payout_amount, lottery_id', { count: 'exact' })
    .eq('status', 'paid')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalPayouts = payouts?.reduce((sum, p) => sum + Number(p.payout_amount || 0), 0) || 0;

  const payoutsByLottery: Record<string, number> = {};
  payouts?.forEach(p => {
    const lottery = p.lottery_id || 'unknown';
    payoutsByLottery[lottery] = (payoutsByLottery[lottery] || 0) + Number(p.payout_amount);
  });

  // ยอดค้างจ่ายรางวัล
  const { data: pendingPayouts } = await supabase
    .from('bets')
    .select('payout_amount')
    .eq('status', 'won')
    .is('paid_at', null);

  const pendingPayoutAmount = pendingPayouts?.reduce((sum, p) => sum + Number(p.payout_amount || 0), 0) || 0;

  return {
    total_bets: totalBets,
    bet_count: betCount || 0,
    total_winnings: totalWinnings,
    winning_count: winningCount || 0,
    total_payouts: totalPayouts,
    payout_count: payoutCount || 0,
    pending_payouts: pendingPayoutAmount,
    bets_by_lottery: betsByLottery,
    payouts_by_lottery: payoutsByLottery,
  };
}

// ดึงข้อมูล agent commission ของวันที่ระบุ
async function getAgentStatsForDate(supabase: ReturnType<typeof createClient>, date: string) {
  const startOfDay = `${date}T00:00:00+07:00`;
  const endOfDay = `${date}T23:59:59+07:00`;

  const { data: commissions } = await supabase
    .from('agent_commissions')
    .select('amount, agent_id')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalCommission = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
  const uniqueAgents = new Set(commissions?.map(c => c.agent_id) || []);

  // Get agent breakdown
  const agentBreakdown: AgentBreakdown[] = [];
  
  if (commissions && commissions.length > 0) {
    const agentIds = [...uniqueAgents];
    const { data: agents } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', agentIds);

    const agentMap = new Map(agents?.map(a => [a.id, a.full_name]) || []);

    const commissionByAgent: Record<string, number> = {};
    commissions.forEach(c => {
      commissionByAgent[c.agent_id] = (commissionByAgent[c.agent_id] || 0) + Number(c.amount);
    });

    for (const [agentId, commission] of Object.entries(commissionByAgent)) {
      agentBreakdown.push({
        agent_id: agentId,
        agent_name: agentMap.get(agentId) || 'Unknown',
        total_sales: 0, // Would need separate query
        commission,
        customers: 0, // Would need separate query
      });
    }
  }

  return {
    agent_commission: totalCommission,
    agent_count: uniqueAgents.size,
    agents_breakdown: agentBreakdown,
  };
}

// ดึงข้อมูลลูกค้าของวันที่ระบุ
async function getCustomerStatsForDate(supabase: ReturnType<typeof createClient>, date: string) {
  const startOfDay = `${date}T00:00:00+07:00`;
  const endOfDay = `${date}T23:59:59+07:00`;

  // จำนวนลูกค้าทั้งหมด
  const { count: totalCustomers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'customer');

  // ลูกค้าใหม่วันนี้
  const { count: newCustomers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'customer')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  // ลูกค้า active (มี transaction หรือ bet วันนี้)
  const { data: activeBettors } = await supabase
    .from('bets')
    .select('user_id')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const { data: activeDepositors } = await supabase
    .from('transactions')
    .select('user_id')
    .eq('type', 'deposit')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const uniqueActiveUsers = new Set([
    ...(activeBettors?.map(u => u.user_id) || []),
    ...(activeDepositors?.map(u => u.user_id) || []),
  ]);

  return {
    total_customers: totalCustomers || 0,
    new_customers: newCustomers || 0,
    active_customers: uniqueActiveUsers.size,
  };
}

// =====================================================
// MAIN FUNCTIONS
// =====================================================

// สร้าง Daily Closing snapshot
export async function createDailyClosing(date?: string): Promise<DailyClosingData> {
  const supabase = await createClient();
  const closingDate = date || getBusinessDate();

  // ดึงข้อมูลทั้งหมดพร้อมกัน
  const [transactions, bets, agentStats, customers] = await Promise.all([
    getTransactionsForDate(supabase, closingDate),
    getBetsForDate(supabase, closingDate),
    getAgentStatsForDate(supabase, closingDate),
    getCustomerStatsForDate(supabase, closingDate),
  ]);

  // คำนวณกำไร
  const grossProfit = bets.total_bets - bets.total_payouts;
  const netProfit = grossProfit - agentStats.agent_commission - transactions.total_bonuses;

  // คำนวณยอดค้างชำระรวม
  const pendingBalance = transactions.pending_withdrawals + bets.pending_payouts;

  // สร้าง breakdown
  const breakdown: DailyBreakdown = {
    deposits_by_method: transactions.deposits_by_method,
    withdrawals_by_method: transactions.withdrawals_by_method,
    bets_by_lottery: bets.bets_by_lottery,
    payouts_by_lottery: bets.payouts_by_lottery,
    agents_breakdown: agentStats.agents_breakdown,
  };

  const closingData: DailyClosingData = {
    closing_date: closingDate,
    ...transactions,
    total_bets: bets.total_bets,
    bet_count: bets.bet_count,
    total_winnings: bets.total_winnings,
    winning_count: bets.winning_count,
    total_payouts: bets.total_payouts,
    payout_count: bets.payout_count,
    pending_payouts: bets.pending_payouts,
    total_sales: bets.total_bets,
    pending_balance: pendingBalance,
    gross_profit: grossProfit,
    net_profit: netProfit,
    agent_commission: agentStats.agent_commission,
    agent_count: agentStats.agent_count,
    ...customers,
    status: 'open',
    is_locked: false,
    has_anomalies: false,
    anomaly_flags: [],
    details: {
      generated_at: new Date().toISOString(),
      timezone: 'Asia/Bangkok',
    },
    breakdown,
  };

  // ตรวจสอบความผิดปกติ
  const previousDays = await getDailyClosings(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  
  const anomalies = await detectAnomalies(supabase, closingData, previousDays);
  closingData.anomaly_flags = anomalies;
  closingData.has_anomalies = anomalies.length > 0;

  return closingData;
}

// บันทึก Daily Closing ลงฐานข้อมูล
export async function saveDailyClosing(
  data: DailyClosingData, 
  closedBy?: string,
  closingType: 'auto' | 'manual' = 'auto',
  notes?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  // ตรวจสอบว่ามีข้อมูลวันนี้อยู่แล้วหรือไม่
  const { data: existing } = await supabase
    .from('daily_closings')
    .select('id, status, is_locked')
    .eq('closing_date', data.closing_date)
    .single();

  // ถ้า locked แล้ว ห้ามแก้ไข
  if (existing?.is_locked) {
    return { success: false, error: 'Cannot modify locked daily closing' };
  }

  const closingRecord = {
    ...data,
    status: 'closed',
    closing_type: closingType,
    closed_by: closedBy,
    closing_time: new Date().toISOString(),
    notes,
    breakdown: data.breakdown,
    anomaly_flags: data.anomaly_flags,
  };

  let closingId: string;

  if (existing) {
    // อัปเดตข้อมูลที่มีอยู่
    const { error } = await supabase
      .from('daily_closings')
      .update(closingRecord)
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating daily closing:', error);
      return { success: false, error: error.message };
    }
    closingId = existing.id;
  } else {
    // สร้างใหม่
    const { data: newRecord, error } = await supabase
      .from('daily_closings')
      .insert(closingRecord)
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting daily closing:', error);
      return { success: false, error: error.message };
    }
    closingId = newRecord.id;
  }

  // บันทึก anomalies ลง table แยก
  if (data.anomaly_flags && data.anomaly_flags.length > 0) {
    await saveAnomalies(supabase, closingId, data.closing_date, data.anomaly_flags);
  }

  // อัปเดต monthly/yearly summary
  await updateMonthlySummary(data.closing_date);

  // Log audit
  if (closedBy) {
    await auditLogger.log({
      userId: closedBy,
      action: 'system.config_change',
      entityType: 'system',
      entityId: closingId,
      newValues: { 
        action: 'daily_closing', 
        date: data.closing_date, 
        type: closingType,
        net_profit: data.net_profit,
      },
    });
  }

  return { success: true, id: closingId };
}

// บันทึก anomalies
async function saveAnomalies(
  supabase: ReturnType<typeof createClient>,
  closingId: string,
  closingDate: string,
  anomalies: AnomalyFlag[]
) {
  const records = anomalies.map(a => ({
    daily_closing_id: closingId,
    closing_date: closingDate,
    anomaly_type: a.type,
    severity: a.severity,
    title: a.title,
    description: a.description,
    affected_amount: a.amount,
    status: 'pending',
  }));

  await supabase.from('daily_closing_anomalies').insert(records);
}

// Lock Daily Closing (ห้ามแก้ไขย้อนหลัง)
export async function lockDailyClosing(
  closingDate: string,
  lockedBy: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('daily_closings')
    .update({
      is_locked: true,
      locked_at: new Date().toISOString(),
      locked_by: lockedBy,
      status: 'locked',
    })
    .eq('closing_date', closingDate);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log audit
  await createAuditLog({
    daily_closing_id: '', // Will be fetched
    closing_date: closingDate,
    action: 'lock',
    performed_by: lockedBy,
    performer_role: 'super_admin',
    performer_name: '',
    reason: 'Manual lock by admin',
  });

  return { success: true };
}

// Unlock Daily Closing (Super Admin only)
export async function unlockDailyClosing(
  closingDate: string,
  unlockedBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // ตรวจสอบว่าเป็น Super Admin
  const { data: user } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', unlockedBy)
    .single();

  if (!user || user.role !== 'super_admin') {
    return { success: false, error: 'Only Super Admin can unlock daily closings' };
  }

  // Get current data for audit
  const { data: currentData } = await supabase
    .from('daily_closings')
    .select('*')
    .eq('closing_date', closingDate)
    .single();

  const { error } = await supabase
    .from('daily_closings')
    .update({
      is_locked: false,
      status: 'closed',
    })
    .eq('closing_date', closingDate);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log audit
  await createAuditLog({
    daily_closing_id: currentData?.id || '',
    closing_date: closingDate,
    action: 'unlock',
    old_values: { is_locked: true },
    new_values: { is_locked: false },
    performed_by: unlockedBy,
    performer_role: 'super_admin',
    performer_name: user.full_name,
    reason,
  });

  return { success: true };
}

// Edit Daily Closing (Super Admin only, with audit log)
export async function editDailyClosing(
  closingDate: string,
  updates: Partial<DailyClosingData>,
  editedBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // ตรวจสอบว่าเป็น Super Admin
  const { data: user } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', editedBy)
    .single();

  if (!user || user.role !== 'super_admin') {
    return { success: false, error: 'Only Super Admin can edit locked daily closings' };
  }

  // Get current data for audit
  const { data: currentData } = await supabase
    .from('daily_closings')
    .select('*')
    .eq('closing_date', closingDate)
    .single();

  if (!currentData) {
    return { success: false, error: 'Daily closing not found' };
  }

  // Update
  const { error } = await supabase
    .from('daily_closings')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('closing_date', closingDate);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log audit
  await createAuditLog({
    daily_closing_id: currentData.id,
    closing_date: closingDate,
    action: 'edit',
    old_values: currentData,
    new_values: updates,
    performed_by: editedBy,
    performer_role: 'super_admin',
    performer_name: user.full_name,
    reason,
  });

  // Re-calculate summaries
  await updateMonthlySummary(closingDate);

  return { success: true };
}

// Create Audit Log
async function createAuditLog(entry: AuditLogEntry) {
  const supabase = await createClient();

  await supabase.from('daily_closing_audit_logs').insert({
    daily_closing_id: entry.daily_closing_id,
    closing_date: entry.closing_date,
    action: entry.action,
    old_values: entry.old_values,
    new_values: entry.new_values,
    performed_by: entry.performed_by,
    performer_role: entry.performer_role,
    performer_name: entry.performer_name,
    reason: entry.reason,
    ip_address: entry.ip_address,
  });
}

// =====================================================
// SEARCH & QUERY FUNCTIONS
// =====================================================

// ดึงข้อมูล Daily Closing ตาม date range
export async function getDailyClosings(startDate: string, endDate: string): Promise<DailyClosingSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('daily_closings')
    .select('*')
    .gte('closing_date', startDate)
    .lte('closing_date', endDate)
    .order('closing_date', { ascending: false });

  if (error) {
    console.error('Error fetching daily closings:', error);
    return [];
  }

  return data || [];
}

// ค้นหาละเอียด
export async function searchDailyClosings(filters: SearchFilters): Promise<DailyClosingSummary[]> {
  const supabase = await createClient();

  let query = supabase.from('daily_closings').select('*');

  if (filters.startDate) {
    query = query.gte('closing_date', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('closing_date', filters.endDate);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.hasAnomalies !== undefined) {
    query = query.eq('has_anomalies', filters.hasAnomalies);
  }
  if (filters.minAmount) {
    query = query.gte('net_profit', filters.minAmount);
  }
  if (filters.maxAmount) {
    query = query.lte('net_profit', filters.maxAmount);
  }

  const { data, error } = await query.order('closing_date', { ascending: false });

  if (error) {
    console.error('Error searching daily closings:', error);
    return [];
  }

  return data || [];
}

// ค้นหา transactions by user/phone/bet
export async function searchTransactionDetails(
  closingDate: string,
  filters: SearchFilters
) {
  const supabase = await createClient();
  const startOfDay = `${closingDate}T00:00:00+07:00`;
  const endOfDay = `${closingDate}T23:59:59+07:00`;

  let results: {
    transactions: unknown[];
    bets: unknown[];
  } = { transactions: [], bets: [] };

  // Search transactions
  let txQuery = supabase
    .from('transactions')
    .select('*, user:users(full_name, phone)')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  if (filters.userId) {
    txQuery = txQuery.eq('user_id', filters.userId);
  }

  const { data: txData } = await txQuery.order('created_at', { ascending: false });
  results.transactions = txData || [];

  // Search bets
  let betQuery = supabase
    .from('bets')
    .select('*, user:users(full_name, phone)')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  if (filters.userId) {
    betQuery = betQuery.eq('user_id', filters.userId);
  }
  if (filters.betId) {
    betQuery = betQuery.eq('id', filters.betId);
  }

  const { data: betData } = await betQuery.order('created_at', { ascending: false });
  results.bets = betData || [];

  return results;
}

// Get audit logs for a specific date
export async function getAuditLogs(closingDate: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('daily_closing_audit_logs')
    .select('*')
    .eq('closing_date', closingDate)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }

  return data || [];
}

// Get anomalies for a specific date
export async function getAnomalies(closingDate: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('daily_closing_anomalies')
    .select('*')
    .eq('closing_date', closingDate)
    .order('severity', { ascending: true });

  if (error) {
    console.error('Error fetching anomalies:', error);
    return [];
  }

  return data || [];
}

// =====================================================
// SUMMARY FUNCTIONS
// =====================================================

// อัปเดต Monthly Summary
async function updateMonthlySummary(date: string) {
  const supabase = await createClient();
  const [year, month] = date.split('-').map(Number);

  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

  const { data: dailyData } = await supabase
    .from('daily_closings')
    .select('*')
    .gte('closing_date', startOfMonth)
    .lte('closing_date', endOfMonth);

  if (!dailyData || dailyData.length === 0) return;

  const summary = dailyData.reduce((acc, day) => ({
    total_deposits: acc.total_deposits + Number(day.total_deposits),
    total_withdrawals: acc.total_withdrawals + Number(day.total_withdrawals),
    total_bets: acc.total_bets + Number(day.total_bets),
    total_winnings: acc.total_winnings + Number(day.total_winnings || 0),
    total_payouts: acc.total_payouts + Number(day.total_payouts),
    total_bonuses: acc.total_bonuses + Number(day.total_bonuses || 0),
    total_sales: acc.total_sales + Number(day.total_sales),
    gross_profit: acc.gross_profit + Number(day.gross_profit),
    net_profit: acc.net_profit + Number(day.net_profit),
    agent_commission: acc.agent_commission + Number(day.agent_commission),
    new_customers: acc.new_customers + Number(day.new_customers),
    days_count: acc.days_count + 1,
  }), {
    total_deposits: 0,
    total_withdrawals: 0,
    total_bets: 0,
    total_winnings: 0,
    total_payouts: 0,
    total_bonuses: 0,
    total_sales: 0,
    gross_profit: 0,
    net_profit: 0,
    agent_commission: 0,
    new_customers: 0,
    days_count: 0,
  });

  await supabase
    .from('monthly_summaries')
    .upsert({
      year,
      month,
      ...summary,
    }, { onConflict: 'year,month' });

  await updateYearlySummary(year);
}

// อัปเดต Yearly Summary
async function updateYearlySummary(year: number) {
  const supabase = await createClient();

  const { data: monthlyData } = await supabase
    .from('monthly_summaries')
    .select('*')
    .eq('year', year);

  if (!monthlyData || monthlyData.length === 0) return;

  const summary = monthlyData.reduce((acc, month) => ({
    total_deposits: acc.total_deposits + Number(month.total_deposits),
    total_withdrawals: acc.total_withdrawals + Number(month.total_withdrawals),
    total_bets: acc.total_bets + Number(month.total_bets),
    total_winnings: acc.total_winnings + Number(month.total_winnings || 0),
    total_payouts: acc.total_payouts + Number(month.total_payouts),
    total_bonuses: acc.total_bonuses + Number(month.total_bonuses || 0),
    total_sales: acc.total_sales + Number(month.total_sales),
    gross_profit: acc.gross_profit + Number(month.gross_profit),
    net_profit: acc.net_profit + Number(month.net_profit),
    agent_commission: acc.agent_commission + Number(month.agent_commission),
    new_customers: acc.new_customers + Number(month.new_customers),
  }), {
    total_deposits: 0,
    total_withdrawals: 0,
    total_bets: 0,
    total_winnings: 0,
    total_payouts: 0,
    total_bonuses: 0,
    total_sales: 0,
    gross_profit: 0,
    net_profit: 0,
    agent_commission: 0,
    new_customers: 0,
  });

  await supabase
    .from('yearly_summaries')
    .upsert({
      year,
      ...summary,
    }, { onConflict: 'year' });
}

// ดึง Monthly Summaries
export async function getMonthlySummaries(year: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('monthly_summaries')
    .select('*')
    .eq('year', year)
    .order('month', { ascending: true });

  if (error) {
    console.error('Error fetching monthly summaries:', error);
    return [];
  }

  return data || [];
}

// ดึง Yearly Summaries
export async function getYearlySummaries() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('yearly_summaries')
    .select('*')
    .order('year', { ascending: false });

  if (error) {
    console.error('Error fetching yearly summaries:', error);
    return [];
  }

  return data || [];
}

// ตรวจสอบสถานะ Daily Closing ของวันนี้
export async function getTodayClosingStatus(): Promise<{ isOpen: boolean; closingData?: DailyClosingSummary }> {
  const supabase = await createClient();
  const today = getBusinessDate();

  const { data } = await supabase
    .from('daily_closings')
    .select('*')
    .eq('closing_date', today)
    .single();

  if (!data) {
    return { isOpen: true };
  }

  return {
    isOpen: data.status === 'open',
    closingData: data,
  };
}
