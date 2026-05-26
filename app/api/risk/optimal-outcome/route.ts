import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

/**
 * Optimal Outcome API
 * 
 * GET /api/risk/optimal-outcome
 * Calculates which winning numbers would result in maximum profit for the platform.
 * 
 * For each bet type, shows:
 * - Numbers with LOWEST payout liability (if these win, platform loses least)
 * - Numbers with HIGHEST bet amount but lowest liability (best profit)
 * - Overall optimal outcome considering all sources
 * 
 * Query params:
 * - draw_date: YYYY-MM-DD (default: today)
 * - lottery_type: filter by lottery type
 */

interface OptimalNumber {
  lottery_number: string;
  bet_type: string;
  total_bet_amount: number;
  total_liability: number;
  estimated_profit_if_wins: number;
  source_count: number;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const drawDate = searchParams.get('draw_date') || new Date().toISOString().split('T')[0];
    const lotteryType = searchParams.get('lottery_type');
    
    // Get all aggregations for the date
    let query = supabase
      .from('risk_aggregations')
      .select('lottery_number, bet_type, total_bet_amount, payout_liability, source_type');
    
    query = query.eq('draw_date', drawDate);
    if (lotteryType) query = query.eq('lottery_type', lotteryType);
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Aggregate by number + bet_type
    const aggregated: Record<string, OptimalNumber> = {};
    
    (data || []).forEach((row) => {
      const key = `${row.lottery_number}:${row.bet_type}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          lottery_number: row.lottery_number,
          bet_type: row.bet_type,
          total_bet_amount: 0,
          total_liability: 0,
          estimated_profit_if_wins: 0,
          source_count: 0,
        };
      }
      
      aggregated[key].total_bet_amount += Number(row.total_bet_amount) || 0;
      aggregated[key].total_liability += Number(row.payout_liability) || 0;
      aggregated[key].source_count++;
    });
    
    // Calculate profit if wins (negative = loss)
    Object.values(aggregated).forEach((item) => {
      // Profit = Total bets received - Payout
      // But we also receive bets on OTHER numbers that don't win
      // For simplicity: profit_if_this_wins = -(payout - bet_on_this_number)
      item.estimated_profit_if_wins = item.total_bet_amount - item.total_liability;
    });
    
    // Group by bet_type
    const byBetType: Record<string, {
      bet_type: string;
      total_bet_amount: number;
      total_liability: number;
      optimal_winners: OptimalNumber[];
      worst_winners: OptimalNumber[];
    }> = {};
    
    Object.values(aggregated).forEach((item) => {
      if (!byBetType[item.bet_type]) {
        byBetType[item.bet_type] = {
          bet_type: item.bet_type,
          total_bet_amount: 0,
          total_liability: 0,
          optimal_winners: [],
          worst_winners: [],
        };
      }
      byBetType[item.bet_type].total_bet_amount += item.total_bet_amount;
      byBetType[item.bet_type].total_liability += item.total_liability;
    });
    
    // For each bet type, find optimal and worst winning numbers
    Object.keys(byBetType).forEach((betType) => {
      const items = Object.values(aggregated).filter((a) => a.bet_type === betType);
      
      // Optimal: lowest liability (platform pays least)
      const sortedByLiability = [...items].sort((a, b) => a.total_liability - b.total_liability);
      byBetType[betType].optimal_winners = sortedByLiability.slice(0, 5);
      
      // Worst: highest liability (platform pays most)
      byBetType[betType].worst_winners = sortedByLiability.slice(-5).reverse();
    });
    
    // Calculate total platform revenue if nothing wins
    const totalBetAmount = Object.values(aggregated).reduce((sum, a) => sum + a.total_bet_amount, 0);
    const maxLiability = Math.max(...Object.values(aggregated).map((a) => a.total_liability), 0);
    
    // Find the single best outcome across all bet types
    const allItems = Object.values(aggregated);
    const bestOutcome = allItems.length > 0
      ? allItems.reduce((best, current) => 
          current.estimated_profit_if_wins > best.estimated_profit_if_wins ? current : best
        )
      : null;
    
    const worstOutcome = allItems.length > 0
      ? allItems.reduce((worst, current) => 
          current.estimated_profit_if_wins < worst.estimated_profit_if_wins ? current : worst
        )
      : null;
    
    return NextResponse.json({
      draw_date: drawDate,
      lottery_type: lotteryType || 'all',
      
      summary: {
        total_bet_amount: totalBetAmount,
        max_single_payout: maxLiability,
        unique_number_bet_combinations: allItems.length,
      },
      
      overall_optimal: bestOutcome ? {
        ...bestOutcome,
        description: `If "${bestOutcome.lottery_number}" wins for ${bestOutcome.bet_type}, platform profit/loss: ${bestOutcome.estimated_profit_if_wins.toLocaleString()} THB`,
      } : null,
      
      overall_worst: worstOutcome ? {
        ...worstOutcome,
        description: `If "${worstOutcome.lottery_number}" wins for ${worstOutcome.bet_type}, platform loss: ${Math.abs(worstOutcome.estimated_profit_if_wins).toLocaleString()} THB`,
      } : null,
      
      by_bet_type: Object.values(byBetType).map((bt) => ({
        ...bt,
        optimal_description: bt.optimal_winners.length > 0
          ? `Best if "${bt.optimal_winners[0].lottery_number}" wins (pays only ${bt.optimal_winners[0].total_liability.toLocaleString()} THB)`
          : 'No data',
        worst_description: bt.worst_winners.length > 0
          ? `Worst if "${bt.worst_winners[0].lottery_number}" wins (pays ${bt.worst_winners[0].total_liability.toLocaleString()} THB)`
          : 'No data',
      })),
      
      disclaimer: 'This analysis is for risk management purposes only. Lottery results are random and cannot be predicted or influenced.',
    });
    
  } catch (error) {
    console.error('Optimal outcome error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
