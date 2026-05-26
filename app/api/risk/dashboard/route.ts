import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

/**
 * Risk Dashboard API
 * 
 * GET /api/risk/dashboard
 * Returns aggregated risk data for the FIN LOTTO risk dashboard.
 * 
 * Query params:
 * - draw_date: YYYY-MM-DD (default: today)
 * - lottery_type: filter by lottery type
 * - source_type: filter by source (main_auto, child_auto, keyin)
 */

export async function GET(request: NextRequest) {
  try {
    // Auth guard - super admin only
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const drawDate = searchParams.get('draw_date') || new Date().toISOString().split('T')[0];
    const lotteryType = searchParams.get('lottery_type');
    const sourceType = searchParams.get('source_type');
    
    // 1. Get summary totals
    let summaryQuery = supabase
      .from('risk_aggregations')
      .select('total_bet_amount, payout_liability, bet_count, source_type')
      .eq('draw_date', drawDate);
    
    if (lotteryType) summaryQuery = summaryQuery.eq('lottery_type', lotteryType);
    if (sourceType) summaryQuery = summaryQuery.eq('source_type', sourceType);
    
    const { data: summaryData } = await summaryQuery;
    
    const summary = {
      total_bet_amount: 0,
      total_payout_liability: 0,
      total_bet_count: 0,
      by_source: {} as Record<string, { bet_amount: number; liability: number; bet_count: number }>,
    };
    
    (summaryData || []).forEach((row) => {
      summary.total_bet_amount += Number(row.total_bet_amount) || 0;
      summary.total_payout_liability += Number(row.payout_liability) || 0;
      summary.total_bet_count += row.bet_count || 0;
      
      const source = row.source_type;
      if (!summary.by_source[source]) {
        summary.by_source[source] = { bet_amount: 0, liability: 0, bet_count: 0 };
      }
      summary.by_source[source].bet_amount += Number(row.total_bet_amount) || 0;
      summary.by_source[source].liability += Number(row.payout_liability) || 0;
      summary.by_source[source].bet_count += row.bet_count || 0;
    });
    
    // 2. Get risk level counts
    let riskCountQuery = supabase
      .from('risk_aggregations')
      .select('risk_level')
      .eq('draw_date', drawDate);
    
    if (lotteryType) riskCountQuery = riskCountQuery.eq('lottery_type', lotteryType);
    if (sourceType) riskCountQuery = riskCountQuery.eq('source_type', sourceType);
    
    const { data: riskData } = await riskCountQuery;
    
    const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    (riskData || []).forEach((row) => {
      const level = row.risk_level as keyof typeof riskCounts;
      if (level in riskCounts) riskCounts[level]++;
    });
    
    // 3. Get top exposure numbers
    let topExposureQuery = supabase
      .from('risk_aggregations')
      .select('lottery_number, bet_type, payout_liability, total_bet_amount, risk_level, source_type, source_site_name')
      .eq('draw_date', drawDate)
      .order('payout_liability', { ascending: false })
      .limit(20);
    
    if (lotteryType) topExposureQuery = topExposureQuery.eq('lottery_type', lotteryType);
    if (sourceType) topExposureQuery = topExposureQuery.eq('source_type', sourceType);
    
    const { data: topExposure } = await topExposureQuery;
    
    // 4. Get available lottery types for this date
    const { data: lotteryTypes } = await supabase
      .from('risk_aggregations')
      .select('lottery_type')
      .eq('draw_date', drawDate);
    
    const uniqueLotteryTypes = [...new Set((lotteryTypes || []).map((l) => l.lottery_type))];
    
    // 5. Get source sites
    const { data: sources } = await supabase
      .from('risk_aggregations')
      .select('source_type, source_site_id, source_site_name')
      .eq('draw_date', drawDate);
    
    const uniqueSources = [...new Map(
      (sources || []).map((s) => [`${s.source_type}:${s.source_site_id}`, s])
    ).values()];
    
    return NextResponse.json({
      draw_date: drawDate,
      filters: {
        lottery_type: lotteryType,
        source_type: sourceType,
      },
      summary,
      risk_counts: riskCounts,
      top_exposure: topExposure || [],
      available_lottery_types: uniqueLotteryTypes,
      available_sources: uniqueSources,
      generated_at: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Risk dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
