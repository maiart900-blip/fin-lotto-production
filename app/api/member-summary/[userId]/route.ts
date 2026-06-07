import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    const supabase = await createClient();

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get parent info
    let parent = null;
    if (user.parent_id) {
      const { data: parentData } = await supabase
        .from('users')
        .select('id, username, display_name, role')
        .eq('id', user.parent_id)
        .single();
      parent = parentData;
    }

    // Get customers created by this user
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    const customerIds = (customers || []).map(c => c.id);

    // Get entries from this user's customers
    let entriesQuery = supabase
      .from('entries')
      .select('*, customer:customers(id, name), lottery:lotteries(id, name)')
      .in('customer_id', customerIds.length > 0 ? customerIds : ['00000000-0000-0000-0000-000000000000'])
      .order('created_at', { ascending: false });

    if (dateFrom) {
      entriesQuery = entriesQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      entriesQuery = entriesQuery.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data: entries } = await entriesQuery;

    // Get winning entries
    const entryIds = (entries || []).map(e => e.id);
    const { data: winnings } = await supabase
      .from('winning_entries')
      .select('*, entry:entries(id, number, bet_type, amount, customer:customers(id, name))')
      .in('entry_id', entryIds.length > 0 ? entryIds : ['00000000-0000-0000-0000-000000000000']);

    // Get credit transactions
    let creditsQuery = supabase
      .from('credit_transactions')
      .select('*, customer:customers(id, name)')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (dateFrom) {
      creditsQuery = creditsQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      creditsQuery = creditsQuery.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data: creditTransactions } = await creditsQuery;

    // Calculate daily profit/loss
    const dailyStats: Record<string, { date: string; bets: number; payout: number; profit: number }> = {};
    
    (entries || []).forEach(entry => {
      const date = entry.created_at.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { date, bets: 0, payout: 0, profit: 0 };
      }
      dailyStats[date].bets += entry.amount || 0;
    });

    const entryWinningsMap: Record<string, number> = {};
    (winnings || []).forEach(w => {
      entryWinningsMap[w.entry_id] = (entryWinningsMap[w.entry_id] || 0) + (w.payout_amount || 0);
      const entry = (entries || []).find(e => e.id === w.entry_id);
      if (entry) {
        const date = entry.created_at.split('T')[0];
        if (dailyStats[date]) {
          dailyStats[date].payout += w.payout_amount || 0;
        }
      }
    });

    Object.keys(dailyStats).forEach(date => {
      dailyStats[date].profit = dailyStats[date].bets - dailyStats[date].payout;
    });

    const dailyProfitLoss = Object.values(dailyStats)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    // Top customers by bets
    const customerBets: Record<string, { id: string; name: string; totalBets: number; entryCount: number }> = {};
    (entries || []).forEach(entry => {
      const customerId = entry.customer_id;
      const customerName = entry.customer?.name || 'ไม่ระบุ';
      if (!customerBets[customerId]) {
        customerBets[customerId] = { id: customerId, name: customerName, totalBets: 0, entryCount: 0 };
      }
      customerBets[customerId].totalBets += entry.amount || 0;
      customerBets[customerId].entryCount += 1;
    });

    const topCustomers = Object.values(customerBets)
      .sort((a, b) => b.totalBets - a.totalBets)
      .slice(0, 10);

    // Top numbers
    const numberBets: Record<string, { number: string; betType: string; totalBets: number; count: number }> = {};
    (entries || []).forEach(entry => {
      const key = `${entry.number}-${entry.bet_type}`;
      if (!numberBets[key]) {
        numberBets[key] = { number: entry.number, betType: entry.bet_type, totalBets: 0, count: 0 };
      }
      numberBets[key].totalBets += entry.amount || 0;
      numberBets[key].count += 1;
    });

    const topNumbers = Object.values(numberBets)
      .sort((a, b) => b.totalBets - a.totalBets)
      .slice(0, 10);

    // Calculate totals
    const totalBets = (entries || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPayout = (winnings || []).reduce((sum, w) => sum + (w.payout_amount || 0), 0);
    const creditGiven = (creditTransactions || [])
      .filter(c => c.type === 'deposit')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    const creditReceived = (creditTransactions || [])
      .filter(c => c.type === 'deposit' && c.customer_id)
      .reduce((sum, c) => sum + (c.amount || 0), 0);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        creditBalance: user.credit_balance || 0,
        isUnlimitedCredit: user.is_unlimited_credit || false,
        hierarchyLevel: user.hierarchy_level || 0,
        createdAt: user.created_at,
      },
      parent,
      customers: customers || [],
      stats: {
        customerCount: (customers || []).length,
        entryCount: (entries || []).length,
        totalBets,
        totalPayout,
        netProfit: totalBets - totalPayout,
        isProfit: totalBets >= totalPayout,
        creditGiven,
        creditReceived,
      },
      recentEntries: (entries || []).slice(0, 20),
      recentWinnings: (winnings || []).slice(0, 20),
      creditHistory: (creditTransactions || []).slice(0, 20),
      dailyProfitLoss,
      topCustomers,
      topNumbers,
    });
  } catch (error) {
    console.error('Member detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
