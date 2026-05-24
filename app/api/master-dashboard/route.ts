import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get today's date range
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    
    // Get month's date range
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    
    // ===== REAL DATA QUERIES =====
    
    // 1. Total sites (from sites table if exists, else 0)
    let totalSites = 0;
    let activeSites = 0;
    try {
      const { count: sitesCount } = await supabase
        .from('sites')
        .select('*', { count: 'exact', head: true });
      totalSites = sitesCount || 0;
      
      const { count: activeCount } = await supabase
        .from('sites')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      activeSites = activeCount || 0;
    } catch {
      // sites table may not exist
    }
    
    // 2. Total members (customers)
    const { count: customersCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    const totalMembers = customersCount || 0;
    
    // 3. Active members today (customers with activity today)
    const { count: activeToday } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('last_login_at', todayStart);
    
    // 4. Total agents
    const { count: agentsCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });
    const totalAgents = agentsCount || 0;
    
    // 5. Today's volume (from entries + bets)
    const { data: todayEntries } = await supabase
      .from('entries')
      .select('amount')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);
    const todayEntriesVolume = todayEntries?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    
    const { data: todayBets } = await supabase
      .from('bets')
      .select('total_amount')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);
    const todayBetsVolume = todayBets?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
    
    const todayVolume = todayEntriesVolume + todayBetsVolume;
    
    // 6. Month's volume (from entries + bets)
    const { data: monthEntries } = await supabase
      .from('entries')
      .select('amount')
      .gte('created_at', monthStart);
    const monthEntriesVolume = monthEntries?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    
    const { data: monthBets } = await supabase
      .from('bets')
      .select('total_amount')
      .gte('created_at', monthStart);
    const monthBetsVolume = monthBets?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
    
    const monthVolume = monthEntriesVolume + monthBetsVolume;
    
    // 7. Today's payout (from entries + bets)
    const { data: todayPayouts } = await supabase
      .from('entries')
      .select('payout_amount')
      .eq('status', 'won')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);
    const todayEntriesPayout = todayPayouts?.reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;
    
    const { data: todayBetsPayouts } = await supabase
      .from('bets')
      .select('total_win_amount')
      .eq('status', 'won')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);
    const todayBetsPayout = todayBetsPayouts?.reduce((sum, b) => sum + (b.total_win_amount || 0), 0) || 0;
    
    const todayPayout = todayEntriesPayout + todayBetsPayout;
    
    // 8. Month's payout (from entries + bets)
    const { data: monthPayouts } = await supabase
      .from('entries')
      .select('payout_amount')
      .eq('status', 'won')
      .gte('created_at', monthStart);
    const monthEntriesPayout = monthPayouts?.reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;
    
    const { data: monthBetsPayouts } = await supabase
      .from('bets')
      .select('total_win_amount')
      .eq('status', 'won')
      .gte('created_at', monthStart);
    const monthBetsPayout = monthBetsPayouts?.reduce((sum, b) => sum + (b.total_win_amount || 0), 0) || 0;
    
    const monthPayout = monthEntriesPayout + monthBetsPayout;
    
    // 9. Pending payouts (from entries + bets)
    const { data: pendingPayoutsData } = await supabase
      .from('entries')
      .select('payout_amount')
      .eq('status', 'won');
    const pendingEntriesPayouts = pendingPayoutsData?.reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;
    
    const { data: pendingBetsPayoutsData } = await supabase
      .from('bets')
      .select('total_win_amount')
      .eq('status', 'won');
    const pendingBetsPayouts = pendingBetsPayoutsData?.reduce((sum, b) => sum + (b.total_win_amount || 0), 0) || 0;
    
    const pendingPayouts = pendingEntriesPayouts + pendingBetsPayouts;
    
    // 10. Recent alerts (from activity_logs or system_alerts if exists)
    let alerts: any[] = [];
    try {
      const { data: recentAlerts } = await supabase
        .from('system_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      alerts = recentAlerts || [];
    } catch {
      // system_alerts table may not exist
    }
    
    // Calculate profits
    const todayProfit = todayVolume - todayPayout;
    const monthProfit = monthVolume - monthPayout;
    
    // Calculate total volume (all time from entries + bets)
    const { data: allEntries } = await supabase
      .from('entries')
      .select('amount');
    const allEntriesVolume = allEntries?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    
    const { data: allBets } = await supabase
      .from('bets')
      .select('total_amount');
    const allBetsVolume = allBets?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
    
    const totalVolume = allEntriesVolume + allBetsVolume;
    
    // Calculate total profit (all time)
    const { data: allPayouts } = await supabase
      .from('entries')
      .select('payout_amount')
      .eq('status', 'won');
    const allEntriesPayout = allPayouts?.reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;
    
    const { data: allBetsPayouts } = await supabase
      .from('bets')
      .select('total_win_amount')
      .eq('status', 'won');
    const allBetsPayout = allBetsPayouts?.reduce((sum, b) => sum + (b.total_win_amount || 0), 0) || 0;
    
    const totalPayout = allEntriesPayout + allBetsPayout;
    const totalProfit = totalVolume - totalPayout;
    
    // Total credits issued (sum of all agent credit_limit)
    const { data: agentCredits } = await supabase
      .from('agents')
      .select('credit_limit');
    const totalCreditsIssued = agentCredits?.reduce((sum, a) => sum + (a.credit_limit || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        // Global Stats
        totalVolume,
        todayVolume,
        monthVolume,
        totalProfit,
        todayProfit,
        monthProfit,
        
        // Sites  
        totalSites,
        activeSites,
        
        // Users
        totalMembers,
        activeToday: activeToday || 0,
        
        // Agents
        totalAgents,
        totalCreditsIssued,
        
        // Risk
        riskLevel: pendingPayouts > 1000000 ? 'high' : pendingPayouts > 100000 ? 'normal' : 'low',
        pendingPayouts,
        
        // Alerts
        alerts: alerts.length > 0 ? alerts.map(a => ({
          id: a.id,
          type: a.type || 'info',
          message: a.message,
          time: a.created_at,
        })) : [],
        
        // Sites list (empty if no sites table)
        sites: [],
      },
    });
  } catch (error: any) {
    console.error('[API] master-dashboard error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      data: {
        totalVolume: 0,
        todayVolume: 0,
        monthVolume: 0,
        totalProfit: 0,
        todayProfit: 0,
        monthProfit: 0,
        totalSites: 0,
        activeSites: 0,
        totalMembers: 0,
        activeToday: 0,
        totalAgents: 0,
        totalCreditsIssued: 0,
        riskLevel: 'low',
        pendingPayouts: 0,
        alerts: [],
        sites: [],
      }
    });
  }
}
