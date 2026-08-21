import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const parentId = searchParams.get('parent_id');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    const supabase = await createClient();

    // Get all users with their hierarchy
    let usersQuery = supabase
      .from('users')
      .select('id, username, display_name, role, credit_balance, is_unlimited_credit, parent_id, hierarchy_level, created_at')
      .order('hierarchy_level', { ascending: true })
      .order('created_at', { ascending: false });

    if (role) {
      usersQuery = usersQuery.eq('role', role);
    }
    if (parentId) {
      usersQuery = usersQuery.eq('parent_id', parentId);
    }
    if (search) {
      usersQuery = usersQuery.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      console.error('[v0] Member summary users error:', usersError.message);
      return NextResponse.json({ members: [], summary: getEmptySummary() });
    }

    // Get all customers
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, credit_balance, created_by, created_at');

    // Get entries with date filter
    let entriesQuery = supabase
      .from('entries')
      .select('id, customer_id, amount, bet_type, created_at, created_by');

    if (dateFrom) {
      entriesQuery = entriesQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      entriesQuery = entriesQuery.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data: entries } = await entriesQuery;

    // Get winning entries
    let winningsQuery = supabase
      .from('winning_entries')
      .select('id, entry_id, payout_amount, created_at');

    if (dateFrom) {
      winningsQuery = winningsQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      winningsQuery = winningsQuery.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data: winnings } = await winningsQuery;

    // Get credit transactions
    let creditsQuery = supabase
      .from('credit_transactions')
      .select('id, customer_id, type, amount, created_by, created_at');

    if (dateFrom) {
      creditsQuery = creditsQuery.gte('created_at', dateFrom);
    }
    if (dateTo) {
      creditsQuery = creditsQuery.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data: credits } = await creditsQuery;

    // Build entry to winning map
    const entryWinningsMap: Record<string, number> = {};
    (winnings || []).forEach(w => {
      entryWinningsMap[w.entry_id] = (entryWinningsMap[w.entry_id] || 0) + (w.payout_amount || 0);
    });

    // Calculate stats for each user
    const memberStats = (users || []).map(user => {
      const userCustomers = (customers || []).filter(c => c.created_by === user.id);
      const customerIds = userCustomers.map(c => c.id);

      const userEntries = (entries || []).filter(e => customerIds.includes(e.customer_id));
      const totalBets = userEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
      const entryCount = userEntries.length;

      const userWinnings = userEntries.reduce((sum, e) => sum + (entryWinningsMap[e.id] || 0), 0);

      const userCredits = (credits || []).filter(c => c.created_by === user.id);
      const creditGiven = userCredits
        .filter(c => c.type === 'deposit')
        .reduce((sum, c) => sum + (c.amount || 0), 0);
      const creditUsed = userCredits
        .filter(c => c.type === 'bet')
        .reduce((sum, c) => sum + Math.abs(c.amount || 0), 0);

      const netProfit = totalBets - userWinnings;
      const isProfit = netProfit >= 0;

      const parent = (users || []).find(u => u.id === user.parent_id);

      return {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        parentId: user.parent_id,
        parentName: parent?.display_name || null,
        hierarchyLevel: user.hierarchy_level || 0,
        creditBalance: user.credit_balance || 0,
        isUnlimitedCredit: user.is_unlimited_credit || false,
        customerCount: userCustomers.length,
        entryCount,
        totalBets,
        totalPayout: userWinnings,
        creditGiven,
        creditUsed,
        netProfit: Math.abs(netProfit),
        isProfit,
        customerWinnings: userWinnings,
        customerLosses: Math.max(0, totalBets - userWinnings),
        createdAt: user.created_at,
        status: 'active',
      };
    });

    const summary = {
      totalMembers: memberStats.length,
      totalCustomers: (customers || []).length,
      totalCreditInSystem: memberStats.reduce((sum, m) => sum + m.creditBalance, 0),
      totalProfit: memberStats.filter(m => m.isProfit).reduce((sum, m) => sum + m.netProfit, 0),
      totalLoss: memberStats.filter(m => !m.isProfit).reduce((sum, m) => sum + m.netProfit, 0),
      topMember: memberStats.sort((a, b) => b.totalBets - a.totalBets)[0] || null,
      worstMember: memberStats.sort((a, b) => {
        const aProfit = a.isProfit ? a.netProfit : -a.netProfit;
        const bProfit = b.isProfit ? b.netProfit : -b.netProfit;
        return aProfit - bProfit;
      })[0] || null,
    };

    return NextResponse.json({ members: memberStats, summary });
  } catch (error) {
    console.error('[v0] Member summary error:', error);
    return NextResponse.json({ members: [], summary: getEmptySummary() });
  }
}

function getEmptySummary() {
  return {
    totalMembers: 0,
    totalCustomers: 0,
    totalCreditInSystem: 0,
    totalProfit: 0,
    totalLoss: 0,
    topMember: null,
    worstMember: null,
  };
}
