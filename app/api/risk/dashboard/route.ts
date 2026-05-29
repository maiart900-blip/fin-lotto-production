import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { getBusinessDay } from '@/lib/daily-reset';

/**
 * Risk Dashboard API
 * 
 * TASK 3: REAL-TIME RISK AGGREGATION
 * 
 * GET /api/risk/dashboard
 * Returns aggregated risk data for the FIN LOTTO risk dashboard.
 * Groups and calculates numbers strictly by:
 * - Specific Lottery Name (lottery_type)
 * - Current Date (draw_date)
 * 
 * Query params:
 * - draw_date: YYYY-MM-DD (default: today's business day)
 * - lottery_type: filter by lottery type/name
 * - source_type: filter by source (main_auto, child_auto, keyin)
 */

export async function GET(request: NextRequest) {
  try {
    // Auth guard - super admin only
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Use business day for default (respects 01:00 AM reset)
    const drawDate = searchParams.get('draw_date') || getBusinessDay();
    const lotteryType = searchParams.get('lottery_type');
    const sourceType = searchParams.get('source_type');
    
    // 1. Get summary totals - GROUPED BY LOTTERY NAME AND DATE
    let summaryQuery = supabase
      .from('risk_aggregations')
      .select('lottery_type, total_bet_amount, payout_liability, bet_count, source_type')
      .eq('draw_date', drawDate);
    
    if (lotteryType) summaryQuery = summaryQuery.eq('lottery_type', lotteryType);
    if (sourceType) summaryQuery = summaryQuery.eq('source_type', sourceType);
    
    const { data: summaryData } = await summaryQuery;
    
    // Group by lottery_type for clear breakdown
    const byLotteryType: Record<string, {
      total_bet_amount: number;
      total_payout_liability: number;
      total_bet_count: number;
      by_source: Record<string, { bet_amount: number; liability: number; bet_count: number }>;
    }> = {};
    
    let globalSummary = {
      total_bet_amount: 0,
      total_payout_liability: 0,
      total_bet_count: 0,
      by_source: {} as Record<string, { bet_amount: number; liability: number; bet_count: number }>,
    };
    
    (summaryData || []).forEach((row) => {
      const lottery = row.lottery_type;
      const source = row.source_type;
      const betAmount = Number(row.total_bet_amount) || 0;
      const liability = Number(row.payout_liability) || 0;
      const count = row.bet_count || 0;
      
      // Global totals
      globalSummary.total_bet_amount += betAmount;
      globalSummary.total_payout_liability += liability;
      globalSummary.total_bet_count += count;
      
      if (!globalSummary.by_source[source]) {
        globalSummary.by_source[source] = { bet_amount: 0, liability: 0, bet_count: 0 };
      }
      globalSummary.by_source[source].bet_amount += betAmount;
      globalSummary.by_source[source].liability += liability;
      globalSummary.by_source[source].bet_count += count;
      
      // Per-lottery breakdown
      if (!byLotteryType[lottery]) {
        byLotteryType[lottery] = {
          total_bet_amount: 0,
          total_payout_liability: 0,
          total_bet_count: 0,
          by_source: {},
        };
      }
      byLotteryType[lottery].total_bet_amount += betAmount;
      byLotteryType[lottery].total_payout_liability += liability;
      byLotteryType[lottery].total_bet_count += count;
      
      if (!byLotteryType[lottery].by_source[source]) {
        byLotteryType[lottery].by_source[source] = { bet_amount: 0, liability: 0, bet_count: 0 };
      }
      byLotteryType[lottery].by_source[source].bet_amount += betAmount;
      byLotteryType[lottery].by_source[source].liability += liability;
      byLotteryType[lottery].by_source[source].bet_count += count;
    });
    
    // 2. Get risk level counts
    let riskCountQuery = supabase
      .from('risk_aggregations')
      .select('risk_level, lottery_type')
      .eq('draw_date', drawDate);
    
    if (lotteryType) riskCountQuery = riskCountQuery.eq('lottery_type', lotteryType);
    if (sourceType) riskCountQuery = riskCountQuery.eq('source_type', sourceType);
    
    const { data: riskData } = await riskCountQuery;
    
    const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    const riskByLottery: Record<string, { low: number; medium: number; high: number; critical: number }> = {};
    
    (riskData || []).forEach((row) => {
      const level = row.risk_level as keyof typeof riskCounts;
      const lottery = row.lottery_type;
      
      if (level in riskCounts) riskCounts[level]++;
      
      if (!riskByLottery[lottery]) {
        riskByLottery[lottery] = { low: 0, medium: 0, high: 0, critical: 0 };
      }
      if (level in riskByLottery[lottery]) riskByLottery[lottery][level]++;
    });
    
    // 3. Get top exposure numbers - GROUPED BY LOTTERY NAME
    let topExposureQuery = supabase
      .from('risk_aggregations')
      .select('lottery_number, bet_type, lottery_type, payout_liability, total_bet_amount, risk_level, source_type, source_site_name')
      .eq('draw_date', drawDate)
      .order('payout_liability', { ascending: false })
      .limit(50); // Get more, then group by lottery
    
    if (lotteryType) topExposureQuery = topExposureQuery.eq('lottery_type', lotteryType);
    if (sourceType) topExposureQuery = topExposureQuery.eq('source_type', sourceType);
    
    const { data: topExposure } = await topExposureQuery;
    
    // Group top exposures by lottery type
    const topExposureByLottery: Record<string, typeof topExposure> = {};
    (topExposure || []).forEach((row) => {
      const lottery = row.lottery_type;
      if (!topExposureByLottery[lottery]) {
        topExposureByLottery[lottery] = [];
      }
      if (topExposureByLottery[lottery].length < 10) { // Top 10 per lottery
        topExposureByLottery[lottery].push(row);
      }
    });
    
    // 4. Get available lottery types for this date
    const { data: lotteryTypes } = await supabase
      .from('risk_aggregations')
      .select('lottery_type')
      .eq('draw_date', drawDate);
    
    const uniqueLotteryTypes = [...new Set((lotteryTypes || []).map((l) => l.lottery_type))];
    
    // 5. Get source sites (all sub-webs reporting data)
    const { data: sources } = await supabase
      .from('risk_aggregations')
      .select('source_type, source_site_id, source_site_name')
      .eq('draw_date', drawDate);
    
    const uniqueSources = [...new Map(
      (sources || []).map((s) => [`${s.source_type}:${s.source_site_id}`, s])
    ).values()];
    
    return NextResponse.json({
      draw_date: drawDate,
      business_day: getBusinessDay(),
      filters: {
        lottery_type: lotteryType,
        source_type: sourceType,
      },
      // Global summary
      summary: globalSummary,
      risk_counts: riskCounts,
      
      // Breakdown by lottery name
      by_lottery: Object.entries(byLotteryType).map(([name, data]) => ({
        lottery_name: name,
        ...data,
        risk_counts: riskByLottery[name] || { low: 0, medium: 0, high: 0, critical: 0 },
        top_exposure: topExposureByLottery[name] || [],
      })),
      
      // Top 20 overall exposure
      top_exposure: (topExposure || []).slice(0, 20),
      
      // Available filters
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
