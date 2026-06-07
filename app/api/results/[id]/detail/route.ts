import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: resultId } = await params;

    // Get result info
    const { data: result, error: resultError } = await supabase
      .from('lottery_results')
      .select('*, lottery:lotteries(id, name)')
      .eq('id', resultId)
      .single();

    if (resultError || !result) {
      return NextResponse.json({ error: 'Result not found' }, { status: 404 });
    }

    // Get bets for this lottery on this date
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        total_amount,
        total_win_amount,
        status,
        bet_items(
          number,
          bet_type,
          amount_top,
          amount_bottom,
          amount_tod,
          win_amount,
          status,
          payout_rate
        )
      `)
      .eq('lottery_id', result.lottery_id)
      .gte('created_at', result.draw_date + 'T00:00:00')
      .lt('created_at', result.draw_date + 'T23:59:59');

    if (betsError) {
      console.error('Error fetching bets for result detail:', betsError);
    }

    // Calculate statistics
    const totalSlips = bets?.length || 0;
    let totalPayout = 0;
    const winningNumbersMap: Record<string, { count: number; payout: number }> = {};

    bets?.forEach((bet: any) => {
      bet.bet_items?.forEach((item: any) => {
        if (item.status === 'won' && item.win_amount > 0) {
          totalPayout += item.win_amount;
          
          if (!winningNumbersMap[item.number]) {
            winningNumbersMap[item.number] = { count: 0, payout: 0 };
          }
          winningNumbersMap[item.number].count += 1;
          winningNumbersMap[item.number].payout += item.win_amount;
        }
      });
    });

    // Sort winning numbers by payout (desc)
    const topWinningNumbers = Object.entries(winningNumbersMap)
      .map(([number, data]) => ({ number, ...data }))
      .sort((a, b) => b.payout - a.payout)
      .slice(0, 5);

    return NextResponse.json({
      result,
      totalSlips,
      totalPayout,
      topWinningNumbers,
    });
  } catch (error) {
    console.error('Error in result detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
