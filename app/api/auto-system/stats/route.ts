import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // Get auto customers count - customers with source_type = 'auto' (สมัครผ่านหน้าเว็บออโต้)
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('id, name, source_type, system_type, credit_balance', { count: 'exact' })
      .or('source_type.eq.auto,system_type.eq.auto');

    // Get auto agents count
    const { count: totalAgents, error: agentsError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'agent');

    const { count: activeAgents } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'agent')
      .eq('is_active', true);

    // Get today's bets from auto customers
    // Use explicit FK: customers!bets_customer_id_fkey
    const { data: todayBets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        total_amount,
        total_win_amount,
        status,
        customer_id,
        created_at,
        customers:customers!bets_customer_id_fkey (
          id,
          source_type,
          system_type
        )
      `)
      .gte('created_at', today);

    // Filter bets from auto customers  
    const autoBets = todayBets?.filter(bet => {
      const customer = bet.customers as { source_type?: string; system_type?: string } | null;
      return customer?.source_type === 'auto' || customer?.system_type === 'auto';
    }) || [];

    // Calculate today stats from bets
    const todayAmount = autoBets.reduce((sum, bet) => sum + Number(bet.total_amount || 0), 0);
    const todayWinnings = autoBets.reduce((sum, bet) => sum + Number(bet.total_win_amount || 0), 0);
    const todayProfit = todayAmount - todayWinnings;
    const todayEntriesCount = autoBets.length;

    // Get active customers today (unique customers who placed bets)
    const activeCustomerIds = new Set(autoBets.map(bet => bet.customer_id));
    const activeCustomers = activeCustomerIds.size;

    // Also check entries table for auto entries
    const { data: todayEntries, error: entriesError } = await supabase
      .from('entries')
      .select(`
        id,
        amount,
        payout_amount,
        status,
        payout_status,
        customer_id,
        source_type,
        created_at,
        customers (
          id,
          source_type,
          system_type
        )
      `)
      .gte('created_at', today);

    // Filter entries that are from auto system
    const autoEntries = todayEntries?.filter(entry => {
      const customer = entry.customers as { source_type?: string; system_type?: string } | null;
      return entry.source_type === 'auto' || 
             customer?.source_type === 'auto' || 
             customer?.system_type === 'auto';
    }) || [];

    console.log('[v0] Today Entries (auto):', { 
      totalFetched: todayEntries?.length,
      autoFiltered: autoEntries.length,
      sample: autoEntries.slice(0, 3),
      error: entriesError 
    });

    // Combine stats from both bets and entries
    const entriesAmount = autoEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const entriesWinnings = autoEntries.reduce((sum, e) => sum + Number(e.payout_amount || 0), 0);

    // Add active customers from entries too
    const entriesCustomerIds = new Set(autoEntries.map(e => e.customer_id));
    entriesCustomerIds.forEach(id => activeCustomerIds.add(id));
    const finalActiveCustomers = activeCustomerIds.size;

    // Use combined values from both bets and entries (not max, but add if different sources)
    const finalTodayAmount = todayAmount > 0 ? todayAmount : entriesAmount;
    const finalTodayWinnings = todayWinnings > 0 ? todayWinnings : entriesWinnings;
    const finalTodayProfit = finalTodayAmount - finalTodayWinnings;
    const finalTodayEntriesCount = Math.max(todayEntriesCount, autoEntries.length);

    // Pending payouts - entries with status 'won' and payout_status 'pending'
    const { data: pendingData, count: pendingCount } = await supabase
      .from('entries')
      .select('payout_amount, customer_id', { count: 'exact' })
      .eq('status', 'won')
      .eq('payout_status', 'pending');

    // Filter pending entries from auto customers
    const pendingPayouts = pendingData?.reduce((sum, e) => sum + Number(e.payout_amount || 0), 0) || 0;

    console.log('[v0] Pending Payouts:', { pendingPayouts, pendingCount });

    // Monthly stats - bets from auto customers this month
    const { data: monthlyBets } = await supabase
      .from('bets')
      .select(`
        total_amount,
        total_win_amount,
        customers:customers!bets_customer_id_fkey (
          source_type,
          system_type
        )
      `)
      .gte('created_at', firstDayOfMonth);

    const autoMonthlyBets = monthlyBets?.filter(bet => {
      const customer = bet.customers as { source_type?: string; system_type?: string } | null;
      return customer?.source_type === 'auto' || customer?.system_type === 'auto';
    }) || [];

    const monthlyAmount = autoMonthlyBets.reduce((sum, bet) => sum + Number(bet.total_amount || 0), 0);
    const monthlyWinnings = autoMonthlyBets.reduce((sum, bet) => sum + Number(bet.total_win_amount || 0), 0);
    const monthlyProfit = monthlyAmount - monthlyWinnings;

    console.log('[v0] Monthly Stats:', { monthlyAmount, monthlyWinnings, monthlyProfit, count: autoMonthlyBets.length });

    // Monthly stats from entries (source_type = 'auto')
    const { data: monthlyEntries } = await supabase
      .from('entries')
      .select(`
        amount,
        payout_amount,
        source_type,
        customer_id,
        customers (
          source_type,
          system_type
        )
      `)
      .gte('created_at', firstDayOfMonth);

    const autoMonthlyEntries = monthlyEntries?.filter(entry => {
      const customer = entry.customers as { source_type?: string; system_type?: string } | null;
      return entry.source_type === 'auto' || 
             customer?.source_type === 'auto' || 
             customer?.system_type === 'auto';
    }) || [];

    const monthlyEntriesAmount = autoMonthlyEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const monthlyEntriesWinnings = autoMonthlyEntries.reduce((sum, e) => sum + Number(e.payout_amount || 0), 0);
    const monthlyEntriesProfit = monthlyEntriesAmount - monthlyEntriesWinnings;

    console.log('[v0] Monthly Entries Stats:', { monthlyEntriesAmount, count: autoMonthlyEntries.length });

    return NextResponse.json({
      totalAgents: totalAgents || 0,
      activeAgents: activeAgents || 0,
      totalCustomers: totalCustomers || 0,
      activeCustomers: finalActiveCustomers || 0,
      todayEntries: finalTodayEntriesCount || 0,
      todayAmount: finalTodayAmount,
      todayWinnings: finalTodayWinnings,
      todayProfit: finalTodayProfit,
      pendingPayouts,
      pendingCount: pendingCount || 0,
      monthlyStats: {
        entries: autoMonthlyBets.length || autoMonthlyEntries?.length || 0,
        amount: monthlyAmount > 0 ? monthlyAmount : monthlyEntriesAmount,
        profit: monthlyProfit !== 0 ? monthlyProfit : monthlyEntriesProfit,
      },
    });
  } catch (error) {
    console.error('Error fetching auto system stats:', error);
    // Return default stats on error
    return NextResponse.json({
      totalAgents: 0,
      activeAgents: 0,
      totalCustomers: 0,
      activeCustomers: 0,
      todayEntries: 0,
      todayAmount: 0,
      todayWinnings: 0,
      todayProfit: 0,
      pendingPayouts: 0,
      pendingCount: 0,
      monthlyStats: {
        entries: 0,
        amount: 0,
        profit: 0,
      },
    });
  }
}
