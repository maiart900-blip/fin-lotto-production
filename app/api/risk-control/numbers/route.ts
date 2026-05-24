import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Risk Control API - ดึงเลขที่มียอดแทงสูงจากโพยจริง
 * 
 * ดึงข้อมูลจาก bet_items + bets table
 * รวมยอดแทงต่อเลข และเรียงจากมากไปน้อย
 * 
 * Query params:
 * - lottery_id: filter ตามหวย
 * - draw_date: filter ตามวันที่งวด (default: today)
 * - number_type: 2 | 3 | all (default: all)
 * - source_type: auto | manual_key | all (default: all)
 * - owner_id: filter ตาม owner (สำหรับ Agent)
 */

interface NumberStat {
  number: string;
  betType: string;
  totalBets: number; // ยอดแทงรวม
  betCount: number; // จำนวนโพย
  potentialPayout: number; // จ่ายถ้าถูก
  profitLoss: number; // กำไร/ขาดทุน (ยอดรับรวม - จ่ายถ้าถูก)
  riskLevel: 'normal' | 'risky' | 'danger';
  sources: {
    auto: number;
    manual_key: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const lotteryId = searchParams.get('lottery_id');
    const drawDate = searchParams.get('draw_date') || new Date().toISOString().split('T')[0];
    const numberType = searchParams.get('number_type') || 'all'; // 2, 3, all
    const sourceType = searchParams.get('source_type') || 'all'; // auto, manual_key, all
    const ownerId = searchParams.get('owner_id'); // For agent filtering
    
    // Get date range for the draw date
    const startDate = `${drawDate}T00:00:00`;
    const endDate = `${drawDate}T23:59:59`;
    
    // Build query for bet_items with bets join
    let query = supabase
      .from('bet_items')
      .select(`
        id,
        number,
        bet_type,
        amount_top,
        amount_bottom,
        amount_tod,
        payout_rate,
        bet_id,
        bets!inner (
          id,
          customer_id,
          lottery_id,
          status,
          source_type,
          created_at,
          created_by
        )
      `)
      .gte('bets.created_at', startDate)
      .lte('bets.created_at', endDate)
      .in('bets.status', ['confirmed', 'active', 'completed']);
    
    // Filter by lottery
    if (lotteryId) {
      query = query.eq('bets.lottery_id', lotteryId);
    }
    
    // Filter by source_type
    if (sourceType !== 'all') {
      query = query.eq('bets.source_type', sourceType);
    }
    
    const { data: betItems, error } = await query;
    
    if (error) {
      console.error('[v0] Risk control query error:', error);
      throw error;
    }
    
    // Get payout rates for the lottery
    let payoutRates: Record<string, number> = {};
    if (lotteryId) {
      const { data: rates } = await supabase
        .from('payout_rates')
        .select('bet_type, rate')
        .eq('lottery_id', lotteryId);
      
      if (rates) {
        payoutRates = Object.fromEntries(rates.map(r => [r.bet_type, parseFloat(r.rate)]));
      }
    }
    
    // Default payout rates if not found
    const defaultRates: Record<string, number> = {
      '3top': 900,
      '3tod': 150,
      '2top': 90,
      '2bot': 90,
      '1top': 3,
      '1bot': 4,
    };
    
    // Get risk limits from settings
    const { data: limitSettings } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'risk_limits')
      .single();
    
    const riskLimits = limitSettings?.setting_value || {
      risky_threshold: 50000, // ยอดแทง > 50,000 = เสี่ยง
      danger_threshold: 100000, // ยอดแทง > 100,000 = อันตราย
    };
    
    // Aggregate by number + bet_type
    const numberMap = new Map<string, {
      number: string;
      betType: string;
      totalBets: number;
      betCount: number;
      payoutRate: number;
      sources: { auto: number; manual_key: number };
      betIds: Set<string>;
    }>();
    
    betItems?.forEach((item: any) => {
      const bet = item.bets;
      const number = item.number;
      const betType = item.bet_type;
      
      // Filter by number type (2 or 3 digits)
      if (numberType === '2' && number.length !== 2) return;
      if (numberType === '3' && number.length !== 3) return;
      
      // Filter by owner_id if provided
      if (ownerId && bet.created_by !== ownerId) return;
      
      const key = `${number}_${betType}`;
      
      if (!numberMap.has(key)) {
        const rate = payoutRates[betType] || defaultRates[betType] || 90;
        numberMap.set(key, {
          number,
          betType,
          totalBets: 0,
          betCount: 0,
          payoutRate: rate,
          sources: { auto: 0, manual_key: 0 },
          betIds: new Set(),
        });
      }
      
      const data = numberMap.get(key)!;
      const amount = (item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0);
      data.totalBets += amount;
      data.betIds.add(item.bet_id);
      
      // Track source type
      const source = bet.source_type || 'auto';
      if (source === 'manual_key') {
        data.sources.manual_key += amount;
      } else {
        data.sources.auto += amount;
      }
    });
    
    // Calculate total revenue for profit/loss calculation
    const totalRevenue = Array.from(numberMap.values()).reduce((sum, d) => sum + d.totalBets, 0);
    
    // Convert to array with risk calculation
    const numbers: NumberStat[] = Array.from(numberMap.values())
      .map(data => {
        const potentialPayout = data.totalBets * data.payoutRate;
        const profitLoss = totalRevenue - potentialPayout;
        
        // Determine risk level
        let riskLevel: 'normal' | 'risky' | 'danger' = 'normal';
        if (potentialPayout >= riskLimits.danger_threshold) {
          riskLevel = 'danger';
        } else if (potentialPayout >= riskLimits.risky_threshold) {
          riskLevel = 'risky';
        }
        
        return {
          number: data.number,
          betType: data.betType,
          totalBets: data.totalBets,
          betCount: data.betIds.size,
          potentialPayout,
          profitLoss,
          riskLevel,
          sources: data.sources,
        };
      })
      // Sort by totalBets descending
      .sort((a, b) => b.totalBets - a.totalBets)
      // Filter out numbers with 0 bets
      .filter(n => n.totalBets > 0);
    
    // Calculate summary stats
    const summary = {
      totalNumbers: numbers.length,
      totalBetsAmount: numbers.reduce((sum, n) => sum + n.totalBets, 0),
      totalPotentialPayout: numbers.reduce((sum, n) => sum + n.potentialPayout, 0),
      dangerCount: numbers.filter(n => n.riskLevel === 'danger').length,
      riskyCount: numbers.filter(n => n.riskLevel === 'risky').length,
      normalCount: numbers.filter(n => n.riskLevel === 'normal').length,
      autoTotal: numbers.reduce((sum, n) => sum + n.sources.auto, 0),
      manualKeyTotal: numbers.reduce((sum, n) => sum + n.sources.manual_key, 0),
    };
    
    console.log('[v0] Risk control numbers:', {
      numberType,
      sourceType,
      lotteryId,
      drawDate,
      totalNumbers: numbers.length,
    });
    
    return NextResponse.json({
      success: true,
      numbers,
      summary,
      filters: {
        lottery_id: lotteryId,
        draw_date: drawDate,
        number_type: numberType,
        source_type: sourceType,
        owner_id: ownerId,
      },
    });
  } catch (error: any) {
    console.error('[v0] Risk control error:', error);
    return NextResponse.json({ 
      error: error.message,
      numbers: [],
      summary: {
        totalNumbers: 0,
        totalBetsAmount: 0,
        totalPotentialPayout: 0,
        dangerCount: 0,
        riskyCount: 0,
        normalCount: 0,
        autoTotal: 0,
        manualKeyTotal: 0,
      },
    }, { status: 500 });
  }
}
