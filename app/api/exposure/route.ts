import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET: Fetch exposure data for a lottery
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');
    
    const supabase = await createClient();
    
    // Get all entries for this lottery that are not cancelled
    let query = supabase
      .from('entries')
      .select('number, bet_type, amount')
      .eq('status', 'pending');
    
    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }
    
    const { data: entries, error } = await query;
    
    if (error) {
      console.error('Exposure GET error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Calculate exposure by number
    const exposureByNumber: Record<string, {
      number: string;
      total: number;
      '2top': number;
      '2bot': number;
      '3top': number;
      '3tod': number;
      '1top': number;
      '1bot': number;
    }> = {};
    
    let totalVolume = 0;
    let totalBets = 0;
    
    (entries || []).forEach((entry) => {
      const key = entry.number;
      if (!exposureByNumber[key]) {
        exposureByNumber[key] = {
          number: entry.number,
          total: 0,
          '2top': 0,
          '2bot': 0,
          '3top': 0,
          '3tod': 0,
          '1top': 0,
          '1bot': 0,
        };
      }
      
      const betType = entry.bet_type as keyof typeof exposureByNumber[string];
      if (betType in exposureByNumber[key]) {
        (exposureByNumber[key][betType] as number) += entry.amount;
      }
      exposureByNumber[key].total += entry.amount;
      totalVolume += entry.amount;
      totalBets++;
    });
    
    // Sort by total exposure (highest first)
    const sortedExposure = Object.values(exposureByNumber)
      .sort((a, b) => b.total - a.total);
    
    // Calculate hot numbers (top 10)
    const hotNumbers = sortedExposure.slice(0, 10);
    
    // Calculate risk numbers (exposure > threshold)
    const riskThreshold = 10000; // configurable
    const riskNumbers = sortedExposure.filter(e => e.total >= riskThreshold);
    
    // Get limits from database (if exists)
    const { data: limits } = await supabase
      .from('risk_limits')
      .select('*')
      .eq('lottery_id', lotteryId)
      .eq('is_active', true);
    
    // Calculate blocked numbers (at limit)
    const blockedNumbers: string[] = [];
    if (limits) {
      limits.forEach((limit) => {
        const exposure = exposureByNumber[limit.number];
        if (exposure && exposure.total >= limit.max_amount) {
          blockedNumbers.push(limit.number);
        }
      });
    }
    
    // Calculate payout exposure (estimate)
    const payoutRates: Record<string, number> = {
      '2top': 90,
      '2bot': 90,
      '3top': 800,
      '3tod': 120,
      '1top': 3,
      '1bot': 3,
    };
    
    let maxPotentialPayout = 0;
    sortedExposure.forEach((exposure) => {
      let maxForNumber = 0;
      Object.entries(payoutRates).forEach(([betType, rate]) => {
        const amount = exposure[betType as keyof typeof exposure] as number || 0;
        maxForNumber = Math.max(maxForNumber, amount * rate);
      });
      maxPotentialPayout += maxForNumber;
    });
    
    return NextResponse.json({
      totalVolume,
      totalBets,
      hotNumbers,
      riskNumbers,
      blockedNumbers,
      maxPotentialPayout,
      exposureByNumber: sortedExposure.slice(0, 50), // Top 50
      limits: limits || [],
    });
  } catch (err) {
    console.error('Exposure GET exception:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
