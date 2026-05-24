import { createClient } from '@/lib/supabase/server';
import { getBusinessDate } from '@/lib/daily-reset';

export interface DailyClosingData {
  closing_date: string;
  total_deposits: number;
  deposit_count: number;
  total_withdrawals: number;
  withdrawal_count: number;
  total_bets: number;
  bet_count: number;
  total_payouts: number;
  payout_count: number;
  total_sales: number;
  pending_balance: number;
  gross_profit: number;
  net_profit: number;
  agent_commission: number;
  total_customers: number;
  new_customers: number;
  active_customers: number;
  status: 'open' | 'closed' | 'finalized';
  details?: Record<string, unknown>;
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
  total_payouts: number;
  payout_count: number;
  total_sales: number;
  pending_balance: number;
  gross_profit: number;
  net_profit: number;
  agent_commission: number;
  total_customers: number;
  new_customers: number;
  active_customers: number;
  status: string;
  notes?: string;
  created_at: string;
}

// ดึงข้อมูล transactions ของวันที่ระบุ
async function getTransactionsForDate(supabase: ReturnType<typeof createClient>, date: string) {
  const startOfDay = `${date}T00:00:00+07:00`;
  const endOfDay = `${date}T23:59:59+07:00`;

  // ยอดฝาก
  const { data: deposits, count: depositCount } = await supabase
    .from('transactions')
    .select('amount', { count: 'exact' })
    .eq('type', 'deposit')
    .eq('status', 'completed')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalDeposits = deposits?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // ยอดถอน
  const { data: withdrawals, count: withdrawalCount } = await supabase
    .from('transactions')
    .select('amount', { count: 'exact' })
    .eq('type', 'withdrawal')
    .eq('status', 'completed')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalWithdrawals = withdrawals?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  return {
    total_deposits: totalDeposits,
    deposit_count: depositCount || 0,
    total_withdrawals: totalWithdrawals,
    withdrawal_count: withdrawalCount || 0,
  };
}

// ดึงข้อมูล bets ของวันที่ระบุ
async function getBetsForDate(supabase: ReturnType<typeof createClient>, date: string) {
  const startOfDay = `${date}T00:00:00+07:00`;
  const endOfDay = `${date}T23:59:59+07:00`;

  const { data: bets, count: betCount } = await supabase
    .from('bets')
    .select('amount, status', { count: 'exact' })
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalBets = bets?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;

  // ยอดจ่ายรางวัล
  const { data: payouts, count: payoutCount } = await supabase
    .from('bets')
    .select('payout_amount', { count: 'exact' })
    .eq('status', 'won')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const totalPayouts = payouts?.reduce((sum, p) => sum + Number(p.payout_amount || 0), 0) || 0;

  return {
    total_bets: totalBets,
    bet_count: betCount || 0,
    total_payouts: totalPayouts,
    payout_count: payoutCount || 0,
  };
}

// ดึงข้อมูล agent commission ของวันที่ระบุ
async function getAgentCommissionForDate(supabase: ReturnType<typeof createClient>, date: string) {
  const startOfDay = `${date}T00:00:00+07:00`;
  const endOfDay = `${date}T23:59:59+07:00`;

  const { data: commissions } = await supabase
    .from('agent_commissions')
    .select('amount')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  return commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
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
  const { data: activeUsers } = await supabase
    .from('bets')
    .select('user_id')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const uniqueActiveUsers = new Set(activeUsers?.map(u => u.user_id) || []);

  return {
    total_customers: totalCustomers || 0,
    new_customers: newCustomers || 0,
    active_customers: uniqueActiveUsers.size,
  };
}

// สร้าง Daily Closing snapshot
export async function createDailyClosing(date?: string): Promise<DailyClosingData> {
  const supabase = await createClient();
  const closingDate = date || getBusinessDate();

  // ดึงข้อมูลทั้งหมดพร้อมกัน
  const [transactions, bets, commission, customers] = await Promise.all([
    getTransactionsForDate(supabase, closingDate),
    getBetsForDate(supabase, closingDate),
    getAgentCommissionForDate(supabase, closingDate),
    getCustomerStatsForDate(supabase, closingDate),
  ]);

  // คำนวณกำไร
  const grossProfit = bets.total_bets - bets.total_payouts;
  const netProfit = grossProfit - commission;

  // คำนวณยอดค้างชำระ (pending withdrawals)
  const { data: pendingWithdrawals } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'withdrawal')
    .eq('status', 'pending');

  const pendingBalance = pendingWithdrawals?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const closingData: DailyClosingData = {
    closing_date: closingDate,
    ...transactions,
    ...bets,
    total_sales: bets.total_bets, // ยอดขาย = ยอดแทง
    pending_balance: pendingBalance,
    gross_profit: grossProfit,
    net_profit: netProfit,
    agent_commission: commission,
    ...customers,
    status: 'open',
    details: {
      generated_at: new Date().toISOString(),
      timezone: 'Asia/Bangkok',
    },
  };

  return closingData;
}

// บันทึก Daily Closing ลงฐานข้อมูล
export async function saveDailyClosing(data: DailyClosingData, closedBy?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // ตรวจสอบว่ามีข้อมูลวันนี้อยู่แล้วหรือไม่
  const { data: existing } = await supabase
    .from('daily_closings')
    .select('id, status')
    .eq('closing_date', data.closing_date)
    .single();

  if (existing) {
    // อัปเดตข้อมูลที่มีอยู่
    const { error } = await supabase
      .from('daily_closings')
      .update({
        ...data,
        status: 'closed',
        closed_by: closedBy,
        closing_time: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating daily closing:', error);
      return { success: false, error: error.message };
    }
  } else {
    // สร้างใหม่
    const { error } = await supabase
      .from('daily_closings')
      .insert({
        ...data,
        status: 'closed',
        closed_by: closedBy,
        closing_time: new Date().toISOString(),
      });

    if (error) {
      console.error('Error inserting daily closing:', error);
      return { success: false, error: error.message };
    }
  }

  // อัปเดต monthly summary
  await updateMonthlySummary(data.closing_date);

  return { success: true };
}

// อัปเดต Monthly Summary
async function updateMonthlySummary(date: string) {
  const supabase = await createClient();
  const [year, month] = date.split('-').map(Number);

  // ดึงข้อมูลทั้งเดือน
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
    total_payouts: acc.total_payouts + Number(day.total_payouts),
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
    total_payouts: 0,
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

  // อัปเดต yearly summary ด้วย
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
    total_payouts: acc.total_payouts + Number(month.total_payouts),
    total_sales: acc.total_sales + Number(month.total_sales),
    gross_profit: acc.gross_profit + Number(month.gross_profit),
    net_profit: acc.net_profit + Number(month.net_profit),
    agent_commission: acc.agent_commission + Number(month.agent_commission),
    new_customers: acc.new_customers + Number(month.new_customers),
  }), {
    total_deposits: 0,
    total_withdrawals: 0,
    total_bets: 0,
    total_payouts: 0,
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
