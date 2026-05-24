import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Default keyin rates
const DEFAULT_KEYIN_RATES: Record<string, number> = {
  '3top': 850,
  '3tod': 140,
  '3flip': 140,
  '2top': 85,
  '2bot': 85,
  '2flip': 85,
  '1top': 3.0,
  '1bot': 4.0,
  'win2': 85,
  'win3': 140,
};

// GET - ดึง keyin rates สำหรับ lottery
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');

    if (!lotteryId) {
      return NextResponse.json({ error: 'Missing lottery_id' }, { status: 400 });
    }

    // ดึง keyin rates จาก keyin_payout_rates table
    const { data: rates, error } = await supabase
      .from('keyin_payout_rates')
      .select('*')
      .eq('lottery_id', lotteryId);

    if (error) {
      // ถ้า table ไม่มี ให้ return default rates พร้อมเปิด custom rates
      if (error.code === '42P01' || error.code === 'PGRST204') {
        return NextResponse.json({
          rates: Object.entries(DEFAULT_KEYIN_RATES).map(([bet_type, rate]) => ({
            lottery_id: lotteryId,
            bet_type,
            rate,
            is_custom: true,
          })),
          use_custom_rates: true,
        });
      }
      throw error;
    }

    if (!rates || rates.length === 0) {
      // Return default rates with custom rates enabled by default
      return NextResponse.json({
        rates: Object.entries(DEFAULT_KEYIN_RATES).map(([bet_type, rate]) => ({
          lottery_id: lotteryId,
          bet_type,
          rate,
          is_custom: true,
        })),
        use_custom_rates: true,
      });
    }

    return NextResponse.json({
      rates,
      use_custom_rates: true,
    });
  } catch (error) {
    console.error('Error fetching keyin rates:', error);
    // Return default rates on error with custom rates enabled
    return NextResponse.json({
      rates: Object.entries(DEFAULT_KEYIN_RATES).map(([bet_type, rate]) => ({
        bet_type,
        rate,
        is_custom: true,
      })),
      use_custom_rates: true,
    });
  }
}

// POST - บันทึก keyin rates สำหรับ lottery
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lottery_id, rates, use_custom_rates, copy_to_all } = body;

    if (!lottery_id || !rates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if table exists first
    const { error: tableCheckError } = await supabase
      .from('keyin_payout_rates')
      .select('id')
      .limit(1);

    if (tableCheckError && (tableCheckError.code === '42P01' || tableCheckError.message.includes('does not exist'))) {
      // Table doesn't exist, just return success (use defaults)
      return NextResponse.json({ 
        success: true, 
        message: 'Using default rates (table not created yet)',
        rates,
      });
    }

    if (copy_to_all) {
      // Copy to all lotteries
      const { data: lotteries } = await supabase
        .from('lotteries')
        .select('id')
        .eq('is_active', true);

      for (const lottery of lotteries || []) {
        // Delete existing rates
        await supabase
          .from('keyin_payout_rates')
          .delete()
          .eq('lottery_id', lottery.id);

        // Insert new rates
        const ratesData = rates.map((r: { bet_type: string; rate: number }) => ({
          lottery_id: lottery.id,
          bet_type: r.bet_type,
          rate: r.rate,
          is_custom: true,
        }));

        await supabase.from('keyin_payout_rates').insert(ratesData);
      }
    } else {
      // Delete existing rates for this lottery
      await supabase
        .from('keyin_payout_rates')
        .delete()
        .eq('lottery_id', lottery_id);

      // Insert new rates
      const ratesData = rates.map((r: { bet_type: string; rate: number }) => ({
        lottery_id,
        bet_type: r.bet_type,
        rate: r.rate,
        is_custom: use_custom_rates,
      }));

      const { error } = await supabase.from('keyin_payout_rates').insert(ratesData);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving keyin rates:', error);
    return NextResponse.json({ error: 'Failed to save rates' }, { status: 500 });
  }
}
