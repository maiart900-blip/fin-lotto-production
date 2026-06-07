import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    console.log('Recent Auto Entries - Starting fetch, today:', today);

    // Get recent bets from auto customers (use explicit FK: customers!bets_customer_id_fkey)
    const { data: recentBets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        total_amount,
        total_win_amount,
        status,
        created_at,
        customer_id,
        lottery_id,
        customers:customers!bets_customer_id_fkey (
          id,
          name,
          source_type,
          system_type
        ),
        lotteries (
          id,
          name
        )
      `)
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .limit(30);

    console.log('Recent Bets fetched:', { 
      count: recentBets?.length, 
      sample: recentBets?.slice(0, 2),
      error: betsError 
    });

    // Filter only auto customers
    const autoBets = recentBets?.filter(bet => {
      const customer = bet.customers as { source_type?: string; system_type?: string } | null;
      return customer?.source_type === 'auto' || customer?.system_type === 'auto';
    }) || [];

    console.log('Auto Bets after filter:', { count: autoBets.length });

    // Also fetch entries for auto customers
    const { data: recentEntries, error: entriesError } = await supabase
      .from('entries')
      .select(`
        id,
        amount,
        payout_amount,
        status,
        source_type,
        created_at,
        customer_id,
        lottery_id,
        customers (
          id,
          name,
          source_type,
          system_type
        ),
        lotteries (
          id,
          name
        )
      `)
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .limit(30);

    console.log('Recent Entries fetched:', { 
      count: recentEntries?.length,
      sample: recentEntries?.slice(0, 2),
      error: entriesError 
    });

    // Filter auto entries
    const autoEntries = recentEntries?.filter(entry => {
      const customer = entry.customers as { source_type?: string; system_type?: string } | null;
      return entry.source_type === 'auto' || 
             customer?.source_type === 'auto' || 
             customer?.system_type === 'auto';
    }) || [];

    console.log('Auto Entries after filter:', { count: autoEntries.length });

    // Combine and format entries from both sources
    const combinedEntries: Array<{
      id: string;
      customer_name: string;
      lottery_name: string;
      amount: number;
      status: string;
      created_at: string;
    }> = [];

    // Add from bets
    autoBets.forEach(bet => {
      const customer = bet.customers as { name?: string } | null;
      const lottery = bet.lotteries as { name?: string } | null;
      
      combinedEntries.push({
        id: bet.id,
        customer_name: customer?.name || 'ไม่ระบุ',
        lottery_name: lottery?.name || 'ไม่ระบุ',
        amount: Number(bet.total_amount || 0),
        status: bet.status,
        created_at: bet.created_at,
      });
    });

    // Add from entries (if not already added via bets)
    const addedIds = new Set(combinedEntries.map(e => e.id));
    autoEntries.forEach(entry => {
      if (!addedIds.has(entry.id)) {
        const customer = entry.customers as { name?: string } | null;
        const lottery = entry.lotteries as { name?: string } | null;
        
        combinedEntries.push({
          id: entry.id,
          customer_name: customer?.name || 'ไม่ระบุ',
          lottery_name: lottery?.name || 'ไม่ระบุ',
          amount: Number(entry.amount || 0),
          status: entry.status || 'pending',
          created_at: entry.created_at,
        });
      }
    });

    // Sort by created_at descending and limit to 20
    const sortedEntries = combinedEntries
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    console.log('Final combined entries:', { count: sortedEntries.length });

    return NextResponse.json(sortedEntries);
  } catch (error) {
    console.error('Error fetching recent entries:', error);
    return NextResponse.json([]);
  }
}
