import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Fetch all payout rates (optionally by lottery_id)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');

    let query = supabase
      .from('payout_rates')
      .select(`
        *,
        lottery:lotteries(id, name)
      `)
      .order('lottery_id');

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Payout rates GET error:', error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Payout rates GET exception:', error);
    return NextResponse.json([]);
  }
}

// PUT - Update payout rate
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lottery_id, bet_type, rate } = body;

    if (!lottery_id || !bet_type || rate === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert the rate
    const { data, error } = await supabase
      .from('payout_rates')
      .upsert({
        lottery_id,
        bet_type,
        rate: parseFloat(rate),
      }, {
        onConflict: 'lottery_id,bet_type',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating payout rate:', error);
    return NextResponse.json({ error: 'Failed to update payout rate' }, { status: 500 });
  }
}

// POST - Bulk update payout rates for a lottery
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lottery_id, rates } = body;

    if (!lottery_id || !rates || !Array.isArray(rates)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Prepare upsert data
    const upsertData = rates.map((r: { bet_type: string; rate: number }) => ({
      lottery_id,
      bet_type: r.bet_type,
      rate: parseFloat(String(r.rate)),
    }));

    const { data, error } = await supabase
      .from('payout_rates')
      .upsert(upsertData, {
        onConflict: 'lottery_id,bet_type',
      })
      .select();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error bulk updating payout rates:', error);
    return NextResponse.json({ error: 'Failed to update payout rates' }, { status: 500 });
  }
}
