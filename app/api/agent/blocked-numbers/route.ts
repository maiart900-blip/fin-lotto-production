import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - ดึงรายการเลขอั้นของเอเย่น
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const lotteryId = searchParams.get('lottery_id');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    // สร้าง query - ไม่ใช้ join เพราะไม่มี FK
    let query = supabase
      .from('agent_blocked_numbers')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data: blockedNumbers, error } = await query;

    if (error) throw error;

    // ดึง lottery names แยก
    const lotteryIds = [...new Set((blockedNumbers || []).map(b => b.lottery_id))];
    const { data: lotteries } = await supabase
      .from('lotteries')
      .select('id, name')
      .in('id', lotteryIds);
    
    const lotteryMap = new Map((lotteries || []).map(l => [l.id, l.name]));

    // จัดกลุ่มตามหวย
    const byLottery: Record<string, any> = {};
    (blockedNumbers || []).forEach(bn => {
      const lotteryName = lotteryMap.get(bn.lottery_id) || 'Unknown';
      if (!byLottery[lotteryName]) {
        byLottery[lotteryName] = {
          lottery_id: bn.lottery_id,
          lottery_name: lotteryName,
          numbers: [],
        };
      }
      byLottery[lotteryName].numbers.push({
        id: bn.id,
        number: bn.number,
        bet_type: bn.bet_type,
        block_type: bn.block_type, // full = อั้นเต็ม, partial = จำกัดยอด
        max_amount: bn.max_amount, // ถ้า partial จะมียอดสูงสุดที่รับ
        reason: bn.reason,
        created_at: bn.created_at,
      });
    });

    return NextResponse.json({
      blocked_numbers: blockedNumbers || [],
      by_lottery: Object.values(byLottery),
      total: blockedNumbers?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching blocked numbers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - เพิ่มเลขอั้น
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      agent_id, 
      lottery_id, 
      numbers, // array of { number, bet_type }
      block_type = 'full', // full หรือ partial
      max_amount = null, // ถ้า partial
      reason = null,
    } = body;

    if (!agent_id || !lottery_id || !numbers || !numbers.length) {
      return NextResponse.json({ 
        error: 'agent_id, lottery_id, and numbers are required' 
      }, { status: 400 });
    }

    // สร้างรายการเลขอั้น
    const blockedEntries = numbers.map((n: any) => ({
      agent_id,
      lottery_id,
      number: n.number,
      bet_type: n.bet_type || 'all', // all = ทุกประเภท, 2top, 2bot, 3top, etc.
      block_type,
      max_amount: block_type === 'partial' ? max_amount : null,
      reason,
      is_active: true,
    }));

    // Upsert (ถ้ามีอยู่แล้วก็อัพเดท)
    const { data, error } = await supabase
      .from('agent_blocked_numbers')
      .upsert(blockedEntries, {
        onConflict: 'agent_id,lottery_id,number,bet_type',
      })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      blocked: data,
      count: data?.length || 0,
      message: `อั้นเลขสำเร็จ ${data?.length || 0} เลข`,
    });
  } catch (error: any) {
    console.error('Error adding blocked numbers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - ลบเลขอั้น
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const agentId = searchParams.get('agent_id');
    const number = searchParams.get('number');
    const lotteryId = searchParams.get('lottery_id');

    if (id) {
      // ลบตาม id
      const { error } = await supabase
        .from('agent_blocked_numbers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } else if (agentId && number && lotteryId) {
      // ลบตาม agent + number + lottery
      const { error } = await supabase
        .from('agent_blocked_numbers')
        .delete()
        .eq('agent_id', agentId)
        .eq('lottery_id', lotteryId)
        .eq('number', number);

      if (error) throw error;
    } else {
      return NextResponse.json({ 
        error: 'id or (agent_id, number, lottery_id) is required' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'ลบเลขอั้นสำเร็จ',
    });
  } catch (error: any) {
    console.error('Error deleting blocked number:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
