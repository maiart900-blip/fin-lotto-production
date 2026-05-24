import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const lotteryId = searchParams.get('lottery_id');
  const date = searchParams.get('date');
  const digitType = searchParams.get('digit_type') || '2'; // '2' or '3'
  const betType = searchParams.get('bet_type'); // specific bet type filter
  
  if (!lotteryId) {
    // Return empty data instead of error for graceful handling
    return NextResponse.json({
      numbers: [],
      summary: {
        grandTotal: 0,
        totalEntries: 0,
        numbersWithEntries: 0,
        numbersWithoutEntries: 100,
        topNumber: null,
        highestRisk: null,
        worstProfitLoss: null,
      },
      rates: {},
    });
  }

  try {
    // Build query for bet_items joined with bets
    // Only get confirmed/pending bets (not cancelled)
    let query = supabase
      .from('bet_items')
      .select(`
        number,
        bet_type,
        amount_top,
        amount_bottom,
        amount_tod,
        bet:bets!inner(
          id,
          lottery_id,
          status,
          created_at
        )
      `)
      .eq('bet.lottery_id', lotteryId)
      .in('bet.status', ['confirmed', 'pending', 'won', 'lost']);
    
    // Filter by date if provided
    if (date) {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      query = query.gte('bet.created_at', startOfDay).lte('bet.created_at', endOfDay);
    }

    // Filter by bet type (digit type)
    if (digitType === '2') {
      if (betType) {
        query = query.eq('bet_type', betType);
      } else {
        query = query.in('bet_type', ['2top', '2bot', '2flip']);
      }
    } else if (digitType === '3') {
      if (betType) {
        query = query.eq('bet_type', betType);
      } else {
        query = query.in('bet_type', ['3top', '3tod', '3flip']);
      }
    }

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      console.error('[Analysis] Items error:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Get payout rates for this lottery
    const { data: rates, error: ratesError } = await supabase
      .from('payout_rates')
      .select('bet_type, rate')
      .eq('lottery_id', lotteryId);

    if (ratesError) {
      console.error('[Analysis] Rates error:', ratesError);
    }

    // Create rate map
    const rateMap: Record<string, number> = {};
    (rates || []).forEach(r => {
      rateMap[r.bet_type] = parseFloat(r.rate);
    });

    // Default rates if not found
    const defaultRates: Record<string, number> = {
      '3top': 900,
      '3tod': 150,
      '3flip': 150,
      '2top': 90,
      '2bot': 90,
      '2flip': 90,
      '1top': 3.2,
      '1bot': 4.2,
    };

    // Aggregate bet_items by number
    const numberMap: Record<string, {
      number: string;
      count: number;
      totalAmount: number;
      byBetType: Record<string, { count: number; amount: number }>;
    }> = {};

    let grandTotal = 0;

    (items || []).forEach(item => {
      const num = item.number;
      // Calculate total amount from all amount fields
      const amount = (item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0);
      
      if (amount === 0) return; // Skip if no amount
      
      grandTotal += amount;

      if (!numberMap[num]) {
        numberMap[num] = {
          number: num,
          count: 0,
          totalAmount: 0,
          byBetType: {},
        };
      }

      numberMap[num].count += 1;
      numberMap[num].totalAmount += amount;

      if (!numberMap[num].byBetType[item.bet_type]) {
        numberMap[num].byBetType[item.bet_type] = { count: 0, amount: 0 };
      }
      numberMap[num].byBetType[item.bet_type].count += 1;
      numberMap[num].byBetType[item.bet_type].amount += amount;
    });

    // Calculate potential payout and profit/loss for each number
    const results = Object.values(numberMap).map(item => {
      // Calculate potential payout based on bet types
      let potentialPayout = 0;
      Object.entries(item.byBetType).forEach(([bt, data]) => {
        const rate = rateMap[bt] || defaultRates[bt] || 0;
        potentialPayout += data.amount * rate;
      });

      // Profit/Loss = Grand Total - Potential Payout for this number
      const profitLoss = grandTotal - potentialPayout;

      return {
        ...item,
        potentialPayout,
        profitLoss,
      };
    });

    // Sort by total amount descending
    results.sort((a, b) => b.totalAmount - a.totalAmount);

    // Calculate summary stats
    const totalNumbers = digitType === '2' ? 100 : 1000;
    const numbersWithEntries = results.length;
    const numbersWithoutEntries = totalNumbers - numbersWithEntries;
    const topNumber = results[0] || null;
    const highestRisk = results.reduce((max, r) => 
      r.potentialPayout > (max?.potentialPayout || 0) ? r : max, null as typeof results[0] | null);
    const worstProfitLoss = results.reduce((min, r) => 
      r.profitLoss < (min?.profitLoss || Infinity) ? r : min, null as typeof results[0] | null);

    return NextResponse.json({
      numbers: results,
      summary: {
        grandTotal,
        totalEntries: items?.length || 0,
        numbersWithEntries,
        numbersWithoutEntries,
        topNumber: topNumber ? { number: topNumber.number, amount: topNumber.totalAmount } : null,
        highestRisk: highestRisk ? { number: highestRisk.number, payout: highestRisk.potentialPayout } : null,
        worstProfitLoss: worstProfitLoss ? { number: worstProfitLoss.number, profitLoss: worstProfitLoss.profitLoss } : null,
      },
      rates: rateMap,
    });
  } catch (error) {
    console.error('[Analysis] Error:', error);
    // Return empty data for graceful degradation
    return NextResponse.json({
      numbers: [],
      summary: {
        grandTotal: 0,
        totalEntries: 0,
        numbersWithEntries: 0,
        numbersWithoutEntries: 100,
        topNumber: null,
        highestRisk: null,
        worstProfitLoss: null,
      },
      rates: {},
    });
  }
}
