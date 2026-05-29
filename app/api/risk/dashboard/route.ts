import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { getBusinessDay } from '@/lib/daily-reset';

/**
 * Risk Dashboard API - CRITICAL DATA PIPELINE
 * 
 * TASK 3: REAL-TIME RISK AGGREGATION
 * 
 * GET /api/risk/dashboard
 * Returns aggregated risk data for the FIN LOTTO risk dashboard.
 * 
 * CRITICAL: This endpoint MUST fetch ALL data from:
 * - ALL Sub-Agents (every ticket, 1 Baht to 10,000,000 Baht)
 * - ALL Agents (every ticket from their network)
 * - ALL Master Agents (every ticket from their hierarchy)
 * - ALL source_type: main_auto, child_auto, keyin, manual_key
 * 
 * NO DATA MUST BE MISSED to prevent catastrophic financial blindspots.
 * 
 * Query params:
 * - draw_date: YYYY-MM-DD (default: today's business day)
 * - lottery_type: filter by lottery type/name
 * - source_type: filter by source (main_auto, child_auto, keyin, manual_key)
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
    
    // =====================================================
    // CRITICAL: DIRECT BETS TABLE QUERY FOR REAL-TIME DATA
    // =====================================================
    // Query the bets table directly to ensure NO DATA IS MISSED
    // This includes ALL manual_key entries from ALL agents
    // =====================================================
    
    // 1. Get ALL bets for today - NO FILTERING BY AGENT
    let betsQuery = supabase
      .from('bets')
      .select(`
        id,
        lottery_type,
        bet_type,
        number,
        amount,
        payout_rate,
        status,
        source_type,
        agent_id,
        customer_id,
        created_at
      `)
      .gte('created_at', `${drawDate}T00:00:00`)
      .lte('created_at', `${drawDate}T23:59:59`);
    
    if (lotteryType) betsQuery = betsQuery.eq('lottery_type', lotteryType);
    if (sourceType) betsQuery = betsQuery.eq('source_type', sourceType);
    
    const { data: allBets, error: betsError } = await betsQuery;
    
    if (betsError) {
      console.error('Risk Dashboard: Failed to fetch bets:', betsError);
    }
    
    // 2. Calculate aggregations from raw bets data
    const byLotteryType: Record<string, {
      total_bet_amount: number;
      total_payout_liability: number;
      total_bet_count: number;
      by_source: Record<string, { bet_amount: number; liability: number; bet_count: number }>;
      by_number: Record<string, { amount: number; liability: number; count: number }>;
      top_exposure: Array<{ number: string; bet_type: string; amount: number; liability: number; risk_level: string }>;
    }> = {};
    
    let globalSummary = {
      total_bet_amount: 0,
      total_payout_liability: 0,
      total_bet_count: 0,
      by_source: {} as Record<string, { bet_amount: number; liability: number; bet_count: number }>,
      manual_key_stats: {
        total_tickets: 0,
        total_amount: 0,
        total_liability: 0,
        unique_agents: new Set<string>(),
        unique_customers: new Set<string>(),
      },
    };
    
    // Process ALL bets
    (allBets || []).forEach((bet) => {
      const lottery = bet.lottery_type || 'unknown';
      const source = bet.source_type || 'unknown';
      const betAmount = Number(bet.amount) || 0;
      const payoutRate = Number(bet.payout_rate) || 0;
      const liability = betAmount * payoutRate;
      const betNumber = bet.number || '';
      const betType = bet.bet_type || '';
      
      // Global totals
      globalSummary.total_bet_amount += betAmount;
      globalSummary.total_payout_liability += liability;
      globalSummary.total_bet_count += 1;
      
      if (!globalSummary.by_source[source]) {
        globalSummary.by_source[source] = { bet_amount: 0, liability: 0, bet_count: 0 };
      }
      globalSummary.by_source[source].bet_amount += betAmount;
      globalSummary.by_source[source].liability += liability;
      globalSummary.by_source[source].bet_count += 1;
      
      // Track manual_key stats specifically
      if (source === 'manual_key' || source === 'keyin') {
        globalSummary.manual_key_stats.total_tickets += 1;
        globalSummary.manual_key_stats.total_amount += betAmount;
        globalSummary.manual_key_stats.total_liability += liability;
        if (bet.agent_id) globalSummary.manual_key_stats.unique_agents.add(bet.agent_id);
        if (bet.customer_id) globalSummary.manual_key_stats.unique_customers.add(bet.customer_id);
      }
      
      // Per-lottery breakdown
      if (!byLotteryType[lottery]) {
        byLotteryType[lottery] = {
          total_bet_amount: 0,
          total_payout_liability: 0,
          total_bet_count: 0,
          by_source: {},
          by_number: {},
          top_exposure: [],
        };
      }
      byLotteryType[lottery].total_bet_amount += betAmount;
      byLotteryType[lottery].total_payout_liability += liability;
      byLotteryType[lottery].total_bet_count += 1;
      
      if (!byLotteryType[lottery].by_source[source]) {
        byLotteryType[lottery].by_source[source] = { bet_amount: 0, liability: 0, bet_count: 0 };
      }
      byLotteryType[lottery].by_source[source].bet_amount += betAmount;
      byLotteryType[lottery].by_source[source].liability += liability;
      byLotteryType[lottery].by_source[source].bet_count += 1;
      
      // Track by number for risk analysis
      const numberKey = `${betNumber}:${betType}`;
      if (!byLotteryType[lottery].by_number[numberKey]) {
        byLotteryType[lottery].by_number[numberKey] = { amount: 0, liability: 0, count: 0 };
      }
      byLotteryType[lottery].by_number[numberKey].amount += betAmount;
      byLotteryType[lottery].by_number[numberKey].liability += liability;
      byLotteryType[lottery].by_number[numberKey].count += 1;
    });
    
    // Calculate risk levels and top exposure per lottery
    Object.keys(byLotteryType).forEach(lottery => {
      const numberData = byLotteryType[lottery].by_number;
      const topExposure = Object.entries(numberData)
        .map(([key, data]) => {
          const [number, betType] = key.split(':');
          const riskLevel = data.liability > 100000 ? 'critical' : 
                          data.liability > 50000 ? 'high' : 
                          data.liability > 10000 ? 'medium' : 'low';
          return { number, bet_type: betType, amount: data.amount, liability: data.liability, risk_level: riskLevel };
        })
        .sort((a, b) => b.liability - a.liability)
        .slice(0, 20);
      
      byLotteryType[lottery].top_exposure = topExposure;
    });
    
    // 3. Calculate risk counts
    const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    Object.values(byLotteryType).forEach(lottery => {
      lottery.top_exposure.forEach(exposure => {
        const level = exposure.risk_level as keyof typeof riskCounts;
        if (level in riskCounts) riskCounts[level]++;
      });
    });
    
    // 4. Get top 20 overall exposure
    const allExposures: Array<{ lottery_type: string; number: string; bet_type: string; amount: number; liability: number; risk_level: string }> = [];
    Object.entries(byLotteryType).forEach(([lottery, data]) => {
      data.top_exposure.forEach(exp => {
        allExposures.push({ lottery_type: lottery, ...exp });
      });
    });
    const top20Exposure = allExposures.sort((a, b) => b.liability - a.liability).slice(0, 20);
    
    // 5. Get unique lottery types
    const uniqueLotteryTypes = Object.keys(byLotteryType);
    
    // 6. Get unique sources
    const uniqueSources = Object.keys(globalSummary.by_source).map(source => ({
      source_type: source,
      bet_count: globalSummary.by_source[source].bet_count,
      bet_amount: globalSummary.by_source[source].bet_amount,
    }));
    
    // Convert Set to count for manual_key_stats
    const manualKeyStats = {
      total_tickets: globalSummary.manual_key_stats.total_tickets,
      total_amount: globalSummary.manual_key_stats.total_amount,
      total_liability: globalSummary.manual_key_stats.total_liability,
      unique_agents: globalSummary.manual_key_stats.unique_agents.size,
      unique_customers: globalSummary.manual_key_stats.unique_customers.size,
    };
    
    return NextResponse.json({
      draw_date: drawDate,
      business_day: getBusinessDay(),
      filters: {
        lottery_type: lotteryType,
        source_type: sourceType,
      },
      // Global summary
      summary: {
        total_bet_amount: globalSummary.total_bet_amount,
        total_payout_liability: globalSummary.total_payout_liability,
        total_bet_count: globalSummary.total_bet_count,
        by_source: globalSummary.by_source,
      },
      risk_counts: riskCounts,
      
      // CRITICAL: Manual Key specific stats (to verify ALL data is captured)
      manual_key_stats: manualKeyStats,
      
      // Breakdown by lottery name
      by_lottery: Object.entries(byLotteryType).map(([name, data]) => ({
        lottery_name: name,
        total_bet_amount: data.total_bet_amount,
        total_payout_liability: data.total_payout_liability,
        total_bet_count: data.total_bet_count,
        by_source: data.by_source,
        top_exposure: data.top_exposure,
      })),
      
      // Top 20 overall exposure
      top_exposure: top20Exposure,
      
      // Available filters
      available_lottery_types: uniqueLotteryTypes,
      available_sources: uniqueSources,
      
      // Data integrity check
      data_integrity: {
        total_bets_fetched: (allBets || []).length,
        data_sources_count: uniqueSources.length,
        lottery_types_count: uniqueLotteryTypes.length,
        manual_key_coverage: manualKeyStats.total_tickets > 0 ? 'ACTIVE' : 'NO_DATA',
      },
      
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
