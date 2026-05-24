import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Recent winners for ticker display
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get recent winning entries from credit_transactions
    const { data: winners, error } = await supabase
      .from('credit_transactions')
      .select(`
        id,
        amount,
        description,
        reference_id,
        created_at,
        customer:customers(name, code)
      `)
      .eq('type', 'win')
      .gt('amount', 0)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Format for ticker display
    const formattedWinners = (winners || []).map((w: any) => {
      // Parse description to extract details
      // Format: "ถูกรางวัล หวยไทย เลข 123 (3 ตัวบน)"
      const descParts = w.description?.match(/หวย(.+?) เลข (\d+) \((.+?)\)/);
      
      return {
        id: w.id,
        customer_name: w.customer?.name || 'ลูกค้า',
        lottery_name: descParts?.[1]?.trim() || 'หวย',
        number: descParts?.[2] || '***',
        bet_type: descParts?.[3] || 'รางวัล',
        amount: 0, // Original bet amount not stored
        payout: w.amount,
        created_at: w.created_at,
      };
    });

    return NextResponse.json(formattedWinners);
  } catch (error) {
    console.error('Error fetching winners:', error);
    return NextResponse.json([]);
  }
}
