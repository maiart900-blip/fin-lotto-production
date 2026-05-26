import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

/**
 * Risk By Number API
 * 
 * GET /api/risk/by-number
 * Returns aggregated exposure for a specific number across all sources.
 * 
 * Query params:
 * - number: lottery number to lookup (required)
 * - draw_date: YYYY-MM-DD (default: today)
 * - lottery_type: filter by lottery type
 */

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const number = searchParams.get('number');
    const drawDate = searchParams.get('draw_date') || new Date().toISOString().split('T')[0];
    const lotteryType = searchParams.get('lottery_type');
    
    if (!number) {
      return NextResponse.json(
        { error: 'Missing required parameter: number' },
        { status: 400 }
      );
    }
    
    let query = supabase
      .from('risk_aggregations')
      .select('*')
      .eq('draw_date', drawDate)
      .eq('lottery_number', number)
      .order('payout_liability', { ascending: false });
    
    if (lotteryType) query = query.eq('lottery_type', lotteryType);
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Aggregate by bet_type
    const byBetType: Record<string, {
      bet_type: string;
      total_bet_amount: number;
      total_liability: number;
      bet_count: number;
      sources: Array<{ source_type: string; source_site_name: string; liability: number }>;
    }> = {};
    
    (data || []).forEach((row) => {
      if (!byBetType[row.bet_type]) {
        byBetType[row.bet_type] = {
          bet_type: row.bet_type,
          total_bet_amount: 0,
          total_liability: 0,
          bet_count: 0,
          sources: [],
        };
      }
      byBetType[row.bet_type].total_bet_amount += Number(row.total_bet_amount) || 0;
      byBetType[row.bet_type].total_liability += Number(row.payout_liability) || 0;
      byBetType[row.bet_type].bet_count += row.bet_count || 0;
      byBetType[row.bet_type].sources.push({
        source_type: row.source_type,
        source_site_name: row.source_site_name || row.source_site_id,
        liability: Number(row.payout_liability) || 0,
      });
    });
    
    const totalLiability = Object.values(byBetType).reduce((sum, bt) => sum + bt.total_liability, 0);
    const totalBetAmount = Object.values(byBetType).reduce((sum, bt) => sum + bt.total_bet_amount, 0);
    
    return NextResponse.json({
      number,
      draw_date: drawDate,
      lottery_type: lotteryType || 'all',
      total_liability: totalLiability,
      total_bet_amount: totalBetAmount,
      estimated_loss_if_wins: totalLiability - totalBetAmount,
      by_bet_type: Object.values(byBetType),
      raw_data: data,
    });
    
  } catch (error) {
    console.error('Risk by-number error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
