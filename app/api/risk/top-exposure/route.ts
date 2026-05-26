import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

/**
 * Top Exposure API
 * 
 * GET /api/risk/top-exposure
 * Returns the numbers with highest payout liability.
 * 
 * Query params:
 * - draw_date: YYYY-MM-DD (default: today)
 * - lottery_type: filter by lottery type
 * - limit: number of results (default: 50)
 * - bet_type: filter by bet type
 */

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const drawDate = searchParams.get('draw_date') || new Date().toISOString().split('T')[0];
    const lotteryType = searchParams.get('lottery_type');
    const betType = searchParams.get('bet_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    
    // Get all aggregations for the date
    let query = supabase
      .from('risk_aggregations')
      .select('lottery_number, bet_type, total_bet_amount, payout_liability, risk_level, source_type, source_site_name')
      .eq('draw_date', drawDate);
    
    if (lotteryType) query = query.eq('lottery_type', lotteryType);
    if (betType) query = query.eq('bet_type', betType);
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Aggregate by number + bet_type combination
    const aggregated: Record<string, {
      lottery_number: string;
      bet_type: string;
      total_bet_amount: number;
      total_liability: number;
      bet_count: number;
      source_count: number;
      sources: string[];
      highest_risk_level: string;
    }> = {};
    
    const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    (data || []).forEach((row) => {
      const key = `${row.lottery_number}:${row.bet_type}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          lottery_number: row.lottery_number,
          bet_type: row.bet_type,
          total_bet_amount: 0,
          total_liability: 0,
          bet_count: 0,
          source_count: 0,
          sources: [],
          highest_risk_level: 'low',
        };
      }
      
      aggregated[key].total_bet_amount += Number(row.total_bet_amount) || 0;
      aggregated[key].total_liability += Number(row.payout_liability) || 0;
      aggregated[key].source_count++;
      
      const sourceName = row.source_site_name || row.source_type;
      if (!aggregated[key].sources.includes(sourceName)) {
        aggregated[key].sources.push(sourceName);
      }
      
      const currentRisk = riskOrder[aggregated[key].highest_risk_level as keyof typeof riskOrder] || 1;
      const newRisk = riskOrder[row.risk_level as keyof typeof riskOrder] || 1;
      if (newRisk > currentRisk) {
        aggregated[key].highest_risk_level = row.risk_level;
      }
    });
    
    // Sort by liability and take top N
    const sorted = Object.values(aggregated)
      .sort((a, b) => b.total_liability - a.total_liability)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
        estimated_loss_if_wins: item.total_liability - item.total_bet_amount,
      }));
    
    // Summary stats
    const totalLiability = sorted.reduce((sum, item) => sum + item.total_liability, 0);
    const criticalCount = sorted.filter((item) => item.highest_risk_level === 'critical').length;
    const highCount = sorted.filter((item) => item.highest_risk_level === 'high').length;
    
    return NextResponse.json({
      draw_date: drawDate,
      filters: { lottery_type: lotteryType, bet_type: betType },
      summary: {
        total_numbers: sorted.length,
        total_liability: totalLiability,
        critical_count: criticalCount,
        high_count: highCount,
      },
      top_exposure: sorted,
    });
    
  } catch (error) {
    console.error('Top exposure error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
