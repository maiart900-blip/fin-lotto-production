import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface CheckRequest {
  lottery_id: string;
  numbers: {
    number: string;
    entry_type: string;
    amount: number;
  }[];
}

interface BlockedResult {
  number: string;
  entry_type: string;
  status: 'ok' | 'blocked' | 'limit_exceeded';
  message?: string;
  limit_amount?: number;
  current_amount?: number;
  available_amount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: CheckRequest = await request.json();
    
    if (!body.lottery_id || !body.numbers || !Array.isArray(body.numbers)) {
      return NextResponse.json(
        { error: 'กรุณาระบุหวยและเลขที่ต้องการตรวจสอบ' }, 
        { status: 400 }
      );
    }

    // Fetch all blocked numbers for this lottery
    const { data: blockedNumbers, error } = await supabase
      .from('blocked_numbers')
      .select('*')
      .eq('lottery_id', body.lottery_id);

    if (error) {
      console.error('check blocked numbers error:', error.message);
      // Return all OK if can't fetch - don't block betting
      return NextResponse.json({
        results: body.numbers.map(n => ({
          number: n.number,
          entry_type: n.entry_type,
          status: 'ok' as const,
        })),
      });
    }

    const results: BlockedResult[] = [];

    for (const item of body.numbers) {
      const cleanNumber = item.number.replace(/\D/g, '');
      
      // Find matching blocked number
      const blocked = (blockedNumbers || []).find(
        bn => bn.number === cleanNumber && bn.entry_type === item.entry_type
      );

      if (!blocked) {
        // No restriction
        results.push({
          number: cleanNumber,
          entry_type: item.entry_type,
          status: 'ok',
        });
        continue;
      }

      if (blocked.is_blocked) {
        // Fully blocked
        results.push({
          number: cleanNumber,
          entry_type: item.entry_type,
          status: 'blocked',
          message: 'เลขนี้ถูกอั้น ไม่รับแทง',
        });
        continue;
      }

      if (blocked.limit_amount) {
        // Has limit - check if exceeded
        const currentAmount = blocked.current_amount || 0;
        const availableAmount = blocked.limit_amount - currentAmount;

        if (item.amount > availableAmount) {
          results.push({
            number: cleanNumber,
            entry_type: item.entry_type,
            status: 'limit_exceeded',
            message: availableAmount <= 0 
              ? 'เลขนี้เต็มยอดแล้ว' 
              : `เลขนี้รับได้อีก ${availableAmount.toLocaleString()} บาท`,
            limit_amount: blocked.limit_amount,
            current_amount: currentAmount,
            available_amount: Math.max(0, availableAmount),
          });
        } else {
          results.push({
            number: cleanNumber,
            entry_type: item.entry_type,
            status: 'ok',
            limit_amount: blocked.limit_amount,
            current_amount: currentAmount,
            available_amount: availableAmount,
          });
        }
        continue;
      }

      // No restriction
      results.push({
        number: cleanNumber,
        entry_type: item.entry_type,
        status: 'ok',
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('check blocked numbers exception:', error);
    // Return all OK if error - don't block betting
    return NextResponse.json({
      results: [],
      error: 'ไม่สามารถตรวจสอบเลขอั้นได้',
    });
  }
}
