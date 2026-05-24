import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Comprehensive risk analysis for Master Risk Panel
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all entries for today
    const { data: entries } = await supabase
      .from('entries')
      .select('number, amount, bet_type, agent_id, created_at')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    // Aggregate by number
    const numberMap = new Map<string, {
      totalAmount: number;
      betCount: number;
      sources: Map<string, { amount: number }>;
    }>();

    (entries || []).forEach((entry: any) => {
      const key = entry.number;
      if (!numberMap.has(key)) {
        numberMap.set(key, { totalAmount: 0, betCount: 0, sources: new Map() });
      }
      const data = numberMap.get(key)!;
      data.totalAmount += Number(entry.amount);
      data.betCount += 1;
      
      // Track by agent/source
      const agentId = entry.agent_id || 'master';
      if (!data.sources.has(agentId)) {
        data.sources.set(agentId, { amount: 0 });
      }
      data.sources.get(agentId)!.amount += Number(entry.amount);
    });

    // Get payout rates for exposure calculation
    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'payout_rates')
      .single();

    const payoutRates = settings?.setting_value || {
      top_three: 900,
      bottom_three: 650,
      top_two: 95,
      bottom_two: 95,
      run_top: 3.5,
      run_bottom: 4.5,
      tood: 150,
    };

    // Convert to array with risk levels
    const numbers = Array.from(numberMap.entries()).map(([number, data]) => {
      // Estimate potential payout (simplified)
      const avgRate = 500; // Average payout rate
      const potentialPayout = data.totalAmount * avgRate;

      // Determine risk level based on thresholds
      let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
      if (data.totalAmount >= 50000) riskLevel = 'critical';
      else if (data.totalAmount >= 20000) riskLevel = 'high';
      else if (data.totalAmount >= 10000) riskLevel = 'medium';

      return {
        number,
        totalAmount: data.totalAmount,
        betCount: data.betCount,
        potentialPayout,
        riskLevel,
        sources: Array.from(data.sources.entries()).map(([siteId, s]) => ({
          siteId,
          siteName: siteId === 'master' ? 'Master Site' : `Agent ${siteId.slice(0, 6)}`,
          amount: s.amount,
        })),
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    // Calculate summary
    const summary = {
      totalVolume: numbers.reduce((sum, n) => sum + n.totalAmount, 0),
      criticalCount: numbers.filter(n => n.riskLevel === 'critical').length,
      highCount: numbers.filter(n => n.riskLevel === 'high').length,
      potentialExposure: numbers.reduce((sum, n) => sum + n.potentialPayout, 0),
    };

    // Aggregate by agent for agent stats
    const agentMap = new Map<string, {
      totalBets: number;
      totalAmount: number;
      riskNumbers: Set<string>;
    }>();

    (entries || []).forEach((entry: any) => {
      const agentId = entry.agent_id || 'master';
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, { totalBets: 0, totalAmount: 0, riskNumbers: new Set() });
      }
      const data = agentMap.get(agentId)!;
      data.totalBets += 1;
      data.totalAmount += Number(entry.amount);
      
      // Check if this is a risky number
      const numData = numberMap.get(entry.number);
      if (numData && numData.totalAmount >= 10000) {
        data.riskNumbers.add(entry.number);
      }
    });

    const agentStats = Array.from(agentMap.entries()).map(([id, data]) => ({
      id,
      name: id === 'master' ? 'Master Site' : `Agent ${id.slice(0, 6)}`,
      totalBets: data.totalBets,
      totalAmount: data.totalAmount,
      riskNumbers: data.riskNumbers.size,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    // Hourly trend
    const hourlyMap = new Map<string, number>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h.toString().padStart(2, '0'), 0);
    }

    (entries || []).forEach((entry: any) => {
      const hour = new Date(entry.created_at).getHours().toString().padStart(2, '0');
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + Number(entry.amount));
    });

    const hourlyTrend = Array.from(hourlyMap.entries()).map(([hour, amount]) => ({
      hour: `${hour}:00`,
      amount,
    }));

    return NextResponse.json({
      numbers: numbers.slice(0, 100), // Top 100 numbers
      summary,
      agentStats: agentStats.slice(0, 20),
      hourlyTrend,
    });
  } catch (error) {
    console.error('Risk analysis error:', error);
    return NextResponse.json({
      numbers: [],
      summary: { totalVolume: 0, criticalCount: 0, highCount: 0, potentialExposure: 0 },
      agentStats: [],
      hourlyTrend: [],
    });
  }
}
