import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getDateRange, getBusinessDay, getYesterdayBusinessDay } from '@/lib/daily-reset';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { getCustomerScopeForUser } from '@/lib/customer-scope';

export async function GET(request: Request) {
  try {
    // SECURITY: Auth guard
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const period = searchParams.get('period') as 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | null;

    const supabase = await createClient();

    // Calculate date range based on period using daily-reset utility (01:00 AM Thailand reset)
    let dateStart: string | null = startDate;
    let dateEnd: string | null = endDate;
    let useBusinessDayRange = false;
    
    if (period) {
      const range = getDateRange(period);
      dateStart = range.start;
      dateEnd = range.end;
      useBusinessDayRange = true; // Use full datetime range for proper 01:00 reset
    }

    // ดึงรายชื่อ Demo Users ก่อน เพื่อ exclude ออกจาก reports
    const { data: demoUsers } = await supabase
      .from('customers')
      .select('id')
      .eq('is_demo_user', true);
    
    const demoUserIds = (demoUsers || []).map(u => u.id);

    // SECURITY: Get customer scope for data filtering
    const scope = await getCustomerScopeForUser({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });

    // Get accessible customer IDs based on scope
    let scopedCustomerIds: string[] | null = null;
    
    if (scope.isAgent && scope.agentIds.length > 0) {
      // Agent sees only their customers
      const { data: scopedCustomers } = await supabase
        .from('customers')
        .select('id')
        .in('agent_id', scope.agentIds);
      scopedCustomerIds = (scopedCustomers || []).map(c => c.id);
    } else if (scope.isTenantOwner && scope.tenantId) {
      // Tenant owner sees customers in their tenant
      const { data: tenantCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', scope.tenantId);
      scopedCustomerIds = (tenantCustomers || []).map(c => c.id);
    }
    // Super admin (scopedCustomerIds = null) sees all

    // Fetch all entries (exclude demo users, apply scope filter)
    let entriesQuery = supabase
      .from('entries')
      .select('*, lottery:lotteries(id, name), customer:customers(id, name, is_demo_user)');

    // SECURITY: Apply scope filter
    if (scopedCustomerIds !== null) {
      if (scopedCustomerIds.length === 0) {
        // No accessible customers - return empty
        return NextResponse.json({ entries: [], results: [], winnings: [], lotteries: [], summary: getEmptySummary() });
      }
      entriesQuery = entriesQuery.in('customer_id', scopedCustomerIds);
    }

    if (lotteryId) {
      entriesQuery = entriesQuery.eq('lottery_id', lotteryId);
    }
    if (dateStart) {
      // If using business day range (from daily-reset), dateStart is already full datetime
      const startQuery = useBusinessDayRange ? dateStart : `${dateStart}T00:00:00`;
      entriesQuery = entriesQuery.gte('created_at', startQuery);
    }
    if (dateEnd) {
      // If using business day range (from daily-reset), dateEnd is already full datetime
      const endQuery = useBusinessDayRange ? dateEnd : `${dateEnd}T23:59:59`;
      entriesQuery = entriesQuery.lte('created_at', endQuery);
    }

    const { data: allEntries, error: entriesError } = await entriesQuery;
    
    // Filter out demo users from entries
    const entries = (allEntries || []).filter(e => !demoUserIds.includes(e.customer_id));

    if (entriesError) {
      console.error('[v0] Profit-loss entries error:', entriesError.message);
      return NextResponse.json({ entries: [], results: [], winnings: [], lotteries: [], summary: getEmptySummary() });
    }

    // Fetch lottery results
    let resultsQuery = supabase
      .from('lottery_results')
      .select('*, lottery:lotteries(id, name)');

    if (lotteryId) {
      resultsQuery = resultsQuery.eq('lottery_id', lotteryId);
    }
    if (dateStart) {
      resultsQuery = resultsQuery.gte('draw_date', dateStart);
    }
    if (dateEnd) {
      resultsQuery = resultsQuery.lte('draw_date', dateEnd);
    }

    const { data: results, error: resultsError } = await resultsQuery;

    if (resultsError) {
      console.error('[v0] Profit-loss results error:', resultsError.message);
    }

    // Fetch winning entries
    let winningsQuery = supabase
      .from('winning_entries')
      .select('*, entry:entries(*, lottery:lotteries(id, name)), result:lottery_results(*)');

    const { data: winnings, error: winningsError } = await winningsQuery;

    if (winningsError) {
      console.error('[v0] Profit-loss winnings error:', winningsError.message);
    }

    // Fetch all lotteries for filter
    const { data: lotteries } = await supabase
      .from('lotteries')
      .select('id, name')
      .order('sort_order', { ascending: true });

    // Calculate summary
    const safeEntries = entries || [];
    const safeWinnings = winnings || [];
    const safeResults = results || [];
    const safeLotteries = lotteries || [];

    const totalBets = safeEntries.reduce((sum, e) => sum + (e?.amount || 0), 0);
    const totalPayout = safeWinnings.reduce((sum, w) => sum + (w?.payout || 0), 0);
    const netProfit = totalBets - totalPayout;
    const totalEntries = safeEntries.length;
    
    // Unique customers
    const uniqueCustomers = new Set(safeEntries.map(e => e?.customer_id).filter(Boolean));

    // Group by lottery
    const lotteryStats: Record<string, {
      id: string;
      name: string;
      totalBets: number;
      totalPayout: number;
      netProfit: number;
      entryCount: number;
      winCount: number;
      hasResult: boolean;
    }> = {};

    safeEntries.forEach(entry => {
      if (!entry?.lottery_id) return;
      const lid = entry.lottery_id;
      const lname = entry.lottery?.name || 'ไม่ระบุ';
      
      if (!lotteryStats[lid]) {
        lotteryStats[lid] = {
          id: lid,
          name: lname,
          totalBets: 0,
          totalPayout: 0,
          netProfit: 0,
          entryCount: 0,
          winCount: 0,
          hasResult: false,
        };
      }
      lotteryStats[lid].totalBets += entry.amount || 0;
      lotteryStats[lid].entryCount += 1;
    });

    safeWinnings.forEach(win => {
      const lid = win?.entry?.lottery_id;
      if (lid && lotteryStats[lid]) {
        lotteryStats[lid].totalPayout += win?.payout || 0;
        lotteryStats[lid].winCount += 1;
      }
    });

    safeResults.forEach(result => {
      const lid = result?.lottery_id;
      if (lid && lotteryStats[lid]) {
        lotteryStats[lid].hasResult = true;
      }
    });

    // Calculate net profit for each lottery
    Object.values(lotteryStats).forEach(stat => {
      stat.netProfit = stat.totalBets - stat.totalPayout;
    });

    const lotteryStatsList = Object.values(lotteryStats).sort((a, b) => b.netProfit - a.netProfit);

    // Find best and worst performing lotteries
    const bestLottery = lotteryStatsList.length > 0 ? lotteryStatsList[0] : null;
    const worstLottery = lotteryStatsList.length > 0 ? lotteryStatsList[lotteryStatsList.length - 1] : null;

    // Daily stats for chart
    const dailyStats: Record<string, { date: string; bets: number; payout: number; profit: number }> = {};
    
    safeEntries.forEach(entry => {
      if (!entry?.created_at) return;
      const date = entry.created_at.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { date, bets: 0, payout: 0, profit: 0 };
      }
      dailyStats[date].bets += entry.amount || 0;
    });

    safeWinnings.forEach(win => {
      const date = win?.entry?.created_at?.split('T')[0];
      if (date && dailyStats[date]) {
        dailyStats[date].payout += win?.payout || 0;
      }
    });

    Object.values(dailyStats).forEach(stat => {
      stat.profit = stat.bets - stat.payout;
    });

    const dailyStatsList = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));

    const summary = {
      totalBets,
      totalPayout,
      netProfit,
      isProfit: netProfit >= 0,
      totalEntries,
      totalCustomers: uniqueCustomers.size,
      bestLottery: bestLottery ? { name: bestLottery.name, profit: bestLottery.netProfit } : null,
      worstLottery: worstLottery && worstLottery.netProfit < 0 ? { name: worstLottery.name, loss: Math.abs(worstLottery.netProfit) } : null,
    };

    return NextResponse.json({
      entries: safeEntries,
      results: safeResults,
      winnings: safeWinnings,
      lotteries: safeLotteries,
      lotteryStats: lotteryStatsList,
      dailyStats: dailyStatsList,
      summary,
    });
  } catch (error) {
    console.error('[v0] Profit-loss exception:', error);
    return NextResponse.json({
      entries: [],
      results: [],
      winnings: [],
      lotteries: [],
      lotteryStats: [],
      dailyStats: [],
      summary: getEmptySummary(),
    });
  }
}

function getEmptySummary() {
  return {
    totalBets: 0,
    totalPayout: 0,
    netProfit: 0,
    isProfit: true,
    totalEntries: 0,
    totalCustomers: 0,
    bestLottery: null,
    worstLottery: null,
  };
}
