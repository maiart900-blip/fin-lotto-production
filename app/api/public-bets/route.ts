import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// GET - Fetch public bets from lead users
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const leadUserId = searchParams.get('lead_user_id');
    const lotteryId = searchParams.get('lottery_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('public_bets')
      .select(`
        id,
        bet_id,
        customer_id,
        visibility,
        is_pinned,
        display_amount,
        show_real_amount,
        copy_count,
        visible_at,
        created_at,
        bets (
          id,
          lottery_id,
          total_amount,
          status,
          created_at,
          lotteries (
            id,
            name,
            draw_date,
            status
          ),
          bet_items (
            id,
            number,
            bet_type,
            amount_top,
            amount_bottom,
            amount_tod
          )
        ),
        customers (
          id,
          name,
          username,
          avatar_url,
          lead_badge,
          lead_user_stats (
            win_rate,
            total_profit,
            followers_count
          )
        )
      `)
      .eq('is_hidden', false)
      .lte('visible_at', new Date().toISOString())
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (leadUserId) {
      query = query.eq('customer_id', leadUserId);
    }

    const { data: publicBets, error } = await query;

    if (error) {
      console.error('[API] Error fetching public bets:', error);
      return NextResponse.json({ error: 'Failed to fetch public bets' }, { status: 500 });
    }

    // Filter by lottery if specified
    let filteredBets = publicBets || [];
    if (lotteryId) {
      filteredBets = filteredBets.filter((pb: any) => pb.bets?.lottery_id === lotteryId);
    }

    // Format response
    const formattedBets = filteredBets.map((pb: any) => {
      const bet = pb.bets as any;
      const customer = pb.customers as any;
      const stats = customer?.lead_user_stats?.[0];

      return {
        id: pb.id,
        bet_id: pb.bet_id,
        is_pinned: pb.is_pinned,
        copy_count: pb.copy_count,
        created_at: pb.created_at,
        // Bet info
        lottery: bet?.lotteries,
        bet_items: bet?.bet_items || [],
        total_amount: pb.show_real_amount ? bet?.total_amount : null,
        display_amount: pb.display_amount,
        bet_status: bet?.status,
        // Lead user info
        lead_user: {
          id: customer?.id,
          name: customer?.name,
          username: customer?.username,
          avatar_url: customer?.avatar_url,
          badge: customer?.lead_badge,
          win_rate: stats?.win_rate || 0,
          total_profit: stats?.total_profit || 0,
          followers_count: stats?.followers_count || 0,
        },
      };
    });

    return NextResponse.json(formattedBets);
  } catch (err) {
    console.error('[API] Public bets exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Copy a public bet
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;

    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { public_bet_id, multiplier = 1 } = body;

    if (!public_bet_id) {
      return NextResponse.json({ error: 'Missing public_bet_id' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get the public bet with its items
    const { data: publicBet, error: pbError } = await supabase
      .from('public_bets')
      .select(`
        id,
        bet_id,
        customer_id,
        bets (
          id,
          lottery_id,
          bet_items (
            number,
            bet_type,
            amount_top,
            amount_bottom,
            amount_tod,
            is_reverse,
            original_number
          )
        )
      `)
      .eq('id', public_bet_id)
      .single();

    if (pbError || !publicBet) {
      return NextResponse.json({ error: 'Public bet not found' }, { status: 404 });
    }

    // Get bet data (handle both single object and array)
    const betData = Array.isArray(publicBet.bets) ? publicBet.bets[0] : publicBet.bets;
    
    // Check if lottery is still open
    const { data: lottery, error: lottoError } = await supabase
      .from('lotteries')
      .select('id, status, close_time')
      .eq('id', betData.lottery_id)
      .single();

    if (lottoError || !lottery || lottery.status !== 'open') {
      return NextResponse.json({ error: 'Lottery is closed' }, { status: 400 });
    }

    if (new Date(lottery.close_time) < new Date()) {
      return NextResponse.json({ error: 'Lottery is closed' }, { status: 400 });
    }

    // Check customer balance
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('id, credit_balance')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Calculate total amount
    const betItems = betData.bet_items || [];
    const totalAmount = betItems.reduce((sum: number, item: any) => {
      return sum + ((item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0)) * multiplier;
    }, 0);

    if (customer.credit_balance < totalAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Create new bet
    const { data: newBet, error: betError } = await supabase
      .from('bets')
      .insert({
        customer_id: customerId,
        lottery_id: betData.lottery_id,
        total_amount: totalAmount,
        status: 'pending',
        copied_from_bet_id: publicBet.bet_id,
      })
      .select('id')
      .single();

    if (betError || !newBet) {
      console.error('[API] Error creating bet:', betError);
      return NextResponse.json({ error: 'Failed to create bet' }, { status: 500 });
    }

    // Create bet items with multiplied amounts
    const newBetItems = betItems.map((item: any) => ({
      bet_id: newBet.id,
      number: item.number,
      bet_type: item.bet_type,
      amount_top: (item.amount_top || 0) * multiplier,
      amount_bottom: (item.amount_bottom || 0) * multiplier,
      amount_tod: (item.amount_tod || 0) * multiplier,
      is_reverse: item.is_reverse || false,
      original_number: item.original_number,
    }));

    const { error: itemsError } = await supabase
      .from('bet_items')
      .insert(newBetItems);

    if (itemsError) {
      console.error('[API] Error creating bet items:', itemsError);
      // Rollback: delete the bet
      await supabase.from('bets').delete().eq('id', newBet.id);
      return NextResponse.json({ error: 'Failed to create bet items' }, { status: 500 });
    }

    // Deduct balance
    const { error: balanceError } = await supabase
      .from('customers')
      .update({ credit_balance: customer.credit_balance - totalAmount })
      .eq('id', customerId);

    if (balanceError) {
      console.error('[API] Error updating balance:', balanceError);
    }

    // Record credit transaction
    await supabase.from('credit_transactions').insert({
      customer_id: customerId,
      type: 'bet',
      amount: -totalAmount,
      balance_after: customer.credit_balance - totalAmount,
      reference_type: 'bet',
      reference_id: newBet.id,
      description: `แทงตามเซียน (Copy Bet)`,
    });

    // Record copied bet
    await supabase.from('copied_bets').insert({
      original_bet_id: publicBet.bet_id,
      public_bet_id: public_bet_id,
      copied_by_customer_id: customerId,
      new_bet_id: newBet.id,
    });

    // Update copy count
    await supabase
      .from('public_bets')
      .update({ copy_count: ((publicBet as any).copy_count || 0) + 1 })
      .eq('id', public_bet_id);

    return NextResponse.json({
      success: true,
      bet_id: newBet.id,
      total_amount: totalAmount,
      item_count: newBetItems.length,
    });
  } catch (err) {
    console.error('[API] Copy bet exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
