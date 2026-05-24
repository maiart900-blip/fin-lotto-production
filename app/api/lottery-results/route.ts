import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  const lotteryId = searchParams.get('lottery_id');

  try {
    let query = supabase
      .from('lottery_results')
      .select(`
        *,
        lotteries (
          id,
          name
        )
      `)
      .order('draw_date', { ascending: false })
      .limit(limit);

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching lottery results:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in lottery-results:', error);
    return NextResponse.json([]);
  }
}
