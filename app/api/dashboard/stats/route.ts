import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to get date ranges with 01:00 AM reset
function getDateRanges() {
  const now = new Date();
  
  // Today (01:00 AM - 00:59 AM next day)
  const todayStart = new Date(now);
  if (now.getHours() < 1) {
    todayStart.setDate(todayStart.getDate() - 1);
  }
  todayStart.setHours(1, 0, 0, 0);
  
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  todayEnd.setMilliseconds(-1);
  
  // This week (Monday 01:00 AM)
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);
  weekStart.setHours(1, 0, 0, 0);
  
  // This month (1st 01:00 AM)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 1, 0, 0, 0);
  
  return {
    today: { start: todayStart.toISOString(), end: todayEnd.toISOString() },
    week: { start: weekStart.toISOString(), end: now.toISOString() },
    month: { start: monthStart.toISOString(), end: now.toISOString() },
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ranges = getDateRanges();

    // Get customer stats
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    const { count: newCustomersToday } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', ranges.today.start)
      .lte('created_at', ranges.today.end);

    // Fetch all deposit/withdraw data for the month (covers all periods)
    const [depositsMonth, withdrawsMonth, topupsMonth] = await Promise.all([
      supabase
        .from('deposit_requests')
        .select('amount, status, created_at')
        .gte('created_at', ranges.month.start),
      supabase
        .from('withdraw_requests')
        .select('amount, status, created_at')
        .gte('created_at', ranges.month.start),
      supabase
        .from('topup_requests')
        .select('amount, status, created_at')
        .gte('created_at', ranges.month.start),
    ]);

    // Helper to calculate stats for a period
    const calcDepositStats = (data: any[] | null, startDate: string, endDate?: string) => {
      const filtered = data?.filter(d => {
        const date = new Date(d.created_at);
        return date >= new Date(startDate) && (!endDate || date <= new Date(endDate));
      }) || [];
      return {
        total: filtered.length,
        pending: filtered.filter(d => d.status === 'pending').length,
        approved: filtered.filter(d => d.status === 'approved').length,
        totalAmount: filtered.reduce((sum, d) => sum + Number(d.amount || 0), 0),
        approvedAmount: filtered.filter(d => d.status === 'approved').reduce((sum, d) => sum + Number(d.amount || 0), 0),
      };
    };

    const calcWithdrawStats = (data: any[] | null, startDate: string, endDate?: string) => {
      const filtered = data?.filter(w => {
        const date = new Date(w.created_at);
        return date >= new Date(startDate) && (!endDate || date <= new Date(endDate));
      }) || [];
      return {
        total: filtered.length,
        pending: filtered.filter(w => w.status === 'pending' || w.status === 'reviewing').length,
        approved: filtered.filter(w => w.status === 'approved' || w.status === 'completed').length,
        totalAmount: filtered.reduce((sum, w) => sum + Number(w.amount || 0), 0),
        approvedAmount: filtered.filter(w => w.status === 'approved' || w.status === 'completed').reduce((sum, w) => sum + Number(w.amount || 0), 0),
      };
    };

    const calcTopupStats = (data: any[] | null, startDate: string, endDate?: string) => {
      const filtered = data?.filter(t => {
        const date = new Date(t.created_at);
        return date >= new Date(startDate) && (!endDate || date <= new Date(endDate));
      }) || [];
      return {
        total: filtered.length,
        pending: filtered.filter(t => t.status === 'pending').length,
        approved: filtered.filter(t => t.status === 'approved').length,
        totalAmount: filtered.reduce((sum, t) => sum + Number(t.amount || 0), 0),
        approvedAmount: filtered.filter(t => t.status === 'approved').reduce((sum, t) => sum + Number(t.amount || 0), 0),
      };
    };

    // Calculate stats for each period
    const depositsToday = calcDepositStats(depositsMonth.data, ranges.today.start, ranges.today.end);
    const depositsWeek = calcDepositStats(depositsMonth.data, ranges.week.start);
    const depositsMonthStats = calcDepositStats(depositsMonth.data, ranges.month.start);

    const withdrawsToday = calcWithdrawStats(withdrawsMonth.data, ranges.today.start, ranges.today.end);
    const withdrawsWeek = calcWithdrawStats(withdrawsMonth.data, ranges.week.start);
    const withdrawsMonthStats = calcWithdrawStats(withdrawsMonth.data, ranges.month.start);

    const topupsToday = calcTopupStats(topupsMonth.data, ranges.today.start, ranges.today.end);
    const topupsWeek = calcTopupStats(topupsMonth.data, ranges.week.start);
    const topupsMonthStats = calcTopupStats(topupsMonth.data, ranges.month.start);

    // Get bet stats (today only for performance)
    const { data: betsToday } = await supabase
      .from('bets')
      .select('amount, potential_win, status')
      .gte('created_at', ranges.today.start)
      .lte('created_at', ranges.today.end);

    // Get entries with payout for profit calculation
    const [entriesToday, entriesWeek, entriesMonth] = await Promise.all([
      supabase
        .from('entries')
        .select('bet_amount, payout, status')
        .gte('created_at', ranges.today.start)
        .lte('created_at', ranges.today.end),
      supabase
        .from('entries')
        .select('bet_amount, payout, status')
        .gte('created_at', ranges.week.start),
      supabase
        .from('entries')
        .select('bet_amount, payout, status')
        .gte('created_at', ranges.month.start),
    ]);

    // Helper to calculate payout (winning amount)
    const calcPayout = (entries: any[] | null) => {
      return entries?.reduce((sum, e) => sum + Number(e.payout || 0), 0) || 0;
    };

    const calcTotalBets = (entries: any[] | null) => {
      return entries?.reduce((sum, e) => sum + Number(e.bet_amount || 0), 0) || 0;
    };

    const payoutToday = calcPayout(entriesToday.data);
    const payoutWeek = calcPayout(entriesWeek.data);
    const payoutMonth = calcPayout(entriesMonth.data);

    const totalBetsToday = calcTotalBets(entriesToday.data);
    const totalBetsWeek = calcTotalBets(entriesWeek.data);
    const totalBetsMonth = calcTotalBets(entriesMonth.data);

    const betStats = {
      total: betsToday?.length || 0,
      pending: betsToday?.filter(b => b.status === 'pending').length || 0,
      won: betsToday?.filter(b => b.status === 'won').length || 0,
      lost: betsToday?.filter(b => b.status === 'lost').length || 0,
      totalBetAmount: betsToday?.reduce((sum, b) => sum + Number(b.amount), 0) || 0,
      totalWinAmount: betsToday?.filter(b => b.status === 'won').reduce((sum, b) => sum + Number(b.potential_win || 0), 0) || 0,
    };

    // Get total customer balance
    const { data: customers } = await supabase
      .from('customers')
      .select('credit_balance');

    const totalCustomerBalance = customers?.reduce((sum, c) => sum + Number(c.credit_balance || 0), 0) || 0;

    // Get active lotteries count
    const { count: activeLotteries } = await supabase
      .from('lotteries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    // Calculate financial summaries
    // กำไรสุทธิ = ยอดแทงทั้งหมด - ยอดถูกรางวัล
    // ไม่ใช่ยอดฝาก - ยอดถูกรางวัล เพราะถ้าลูกค้าฝากแล้วถอนโดยไม่แทง จะไม่มีกำไร
    const financialToday = {
      totalDeposit: depositsToday.approvedAmount + topupsToday.approvedAmount,
      totalWithdraw: withdrawsToday.approvedAmount,
      totalPayout: payoutToday,
      totalBets: totalBetsToday,
      // กำไรสุทธิ = ยอดแทง - ยอดถูกรางวัล (ถ้าไม่มีคนแทง = ไม่มีกำไร)
      netProfit: totalBetsToday - payoutToday,
      // net = ยอดฝาก - ยอดถอน (cash flow)
      net: (depositsToday.approvedAmount + topupsToday.approvedAmount) - withdrawsToday.approvedAmount,
    };

    const financialWeek = {
      totalDeposit: depositsWeek.approvedAmount + topupsWeek.approvedAmount,
      totalWithdraw: withdrawsWeek.approvedAmount,
      totalPayout: payoutWeek,
      totalBets: totalBetsWeek,
      netProfit: totalBetsWeek - payoutWeek,
      net: (depositsWeek.approvedAmount + topupsWeek.approvedAmount) - withdrawsWeek.approvedAmount,
    };

    const financialMonth = {
      totalDeposit: depositsMonthStats.approvedAmount + topupsMonthStats.approvedAmount,
      totalWithdraw: withdrawsMonthStats.approvedAmount,
      totalPayout: payoutMonth,
      totalBets: totalBetsMonth,
      netProfit: totalBetsMonth - payoutMonth,
      net: (depositsMonthStats.approvedAmount + topupsMonthStats.approvedAmount) - withdrawsMonthStats.approvedAmount,
    };

    return NextResponse.json({
      success: true,
      stats: {
        customers: {
          total: totalCustomers || 0,
          newToday: newCustomersToday || 0,
          totalBalance: totalCustomerBalance,
        },
        // Daily stats
        deposits: depositsToday,
        withdraws: withdrawsToday,
        topups: topupsToday,
        bets: betStats,
        // Period-based stats
        periods: {
          today: {
            deposits: depositsToday,
            topups: topupsToday,
            withdraws: withdrawsToday,
            financial: financialToday,
          },
          week: {
            deposits: depositsWeek,
            topups: topupsWeek,
            withdraws: withdrawsWeek,
            financial: financialWeek,
          },
          month: {
            deposits: depositsMonthStats,
            topups: topupsMonthStats,
            withdraws: withdrawsMonthStats,
            financial: financialMonth,
          },
        },
        financial: {
          netDeposit: financialToday.net,
          betProfit: betStats.totalBetAmount - betStats.totalWinAmount,
          totalProfit: financialToday.net + (betStats.totalBetAmount - betStats.totalWinAmount),
          pendingDeposits: depositsToday.pending + topupsToday.pending,
          pendingWithdraws: withdrawsToday.pending,
        },
        lotteries: {
          active: activeLotteries || 0,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[v0] Dashboard stats error:', error);
    return NextResponse.json({
      success: false,
      stats: {
        customers: { total: 0, newToday: 0, totalBalance: 0 },
        deposits: { total: 0, pending: 0, approved: 0, totalAmount: 0, approvedAmount: 0 },
        withdraws: { total: 0, pending: 0, approved: 0, totalAmount: 0, approvedAmount: 0 },
        topups: { total: 0, pending: 0, approved: 0, totalAmount: 0, approvedAmount: 0 },
        bets: { total: 0, pending: 0, won: 0, lost: 0, totalBetAmount: 0, totalWinAmount: 0 },
        periods: {
          today: { deposits: {}, topups: {}, withdraws: {}, financial: { totalDeposit: 0, totalWithdraw: 0, net: 0 } },
          week: { deposits: {}, topups: {}, withdraws: {}, financial: { totalDeposit: 0, totalWithdraw: 0, net: 0 } },
          month: { deposits: {}, topups: {}, withdraws: {}, financial: { totalDeposit: 0, totalWithdraw: 0, net: 0 } },
        },
        financial: { netDeposit: 0, betProfit: 0, totalProfit: 0, pendingDeposits: 0, pendingWithdraws: 0 },
        lotteries: { active: 0 },
        lastUpdated: new Date().toISOString(),
      },
    });
  }
}
