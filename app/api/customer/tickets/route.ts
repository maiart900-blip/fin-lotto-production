import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;
    const customerToken = cookieStore.get('customer_token')?.value;
    
    const supabase = await createClient();
    
    // Try to get customer_id from cookie first (direct match)
    let finalCustomerId = customerId;
    
    // If no direct customer_id, try to get from session token
    if (!finalCustomerId && customerToken) {
      const { data: session } = await supabase
        .from('customer_sessions')
        .select('customer_id')
        .eq('token', customerToken)
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (session) {
        finalCustomerId = session.customer_id;
      }
    }
    
    if (!finalCustomerId) {
      return NextResponse.json([]);
    }
    
    // Get customer's bets with items
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        customer_id,
        total_amount,
        status,
        is_checked,
        total_win_amount,
        created_at,
        lottery_id,
        lotteries(name),
        bet_items(
          id,
          number,
          bet_type,
          amount_top,
          amount_bottom,
          amount_tod,
          status,
          win_amount,
          payout_rate
        )
      `)
      .eq('customer_id', finalCustomerId)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (betsError) {
      console.error('[API] Error fetching bets:', betsError);
      return NextResponse.json([]);
    }
    
    // Transform data - ใช้ status และ win_amount จาก database จริง
    const tickets = (bets || []).map((bet) => {
      const items = (bet as any).bet_items || [];
      const hasWon = items.some((item: any) => item.status === 'won');
      const hasLost = items.some((item: any) => item.status === 'lost');
      const totalWinAmount = items.reduce((sum: number, item: any) => sum + (item.win_amount || 0), 0);
      
      // Determine ticket status based on bet_items
      let ticketStatus = bet.status;
      if (bet.is_checked) {
        ticketStatus = hasWon ? (hasLost ? 'partial_won' : 'won') : 'lost';
      } else if (bet.status === 'confirmed' || bet.status === 'waiting_result') {
        ticketStatus = 'pending';
      }
      
      return {
        id: bet.id,
        slip_number: `BET-${bet.id.substring(0, 8).toUpperCase()}`,
        total_amount: bet.total_amount,
        status: ticketStatus,
        created_at: bet.created_at,
        lottery_name: (bet as any).lotteries?.name || 'หวย',
        total_win_amount: totalWinAmount || bet.total_win_amount || 0,
        entries: items.map((item: any) => ({
          id: item.id,
          numbers: item.number,
          bet_type: item.bet_type,
          amount: (item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0),
          status: item.status || 'pending',
          prize_amount: item.win_amount || 0
        }))
      };
    });
    
    return NextResponse.json(tickets);
    
  } catch (error) {
    console.error('[API] Customer tickets error:', error);
    return NextResponse.json([]);
  }
}
