import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentContext } from '@/lib/agent-context';

// GET - ดึงรายการเลขอั้นของเอเย่น (identity จาก session)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id'); // admin only
    const lotteryId = searchParams.get('lottery_id');

    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // สร้าง query - เลขอั้นของ agent ที่ login เท่านั้น
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
        block_type: bn.block_type,
        max_amount: bn.max_amount,
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

// POST - เพิ่มเลขอั้น (agent_id มาจาก session เท่านั้น)
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await requireAgentContext();
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();
    const body = await request.json();
    const {
      lottery_id,
      numbers, // array of { number, bet_type }
      block_type = 'full', // full หรือ partial
      max_amount = null, // ถ้า partial
      reason = null,
    } = body;

    if (!lottery_id || !numbers || !numbers.length) {
      return NextResponse.json({
        error: 'lottery_id and numbers are required'
      }, { status: 400 });
    }

    // สร้างรายการเลขอั้น — ผูก agent_id จาก session (กัน spoofing)
    const blockedEntries = numbers.map((n: any) => ({
      agent_id: agentId,
      lottery_id,
      number: n.number,
      bet_type: n.bet_type || 'all',
      block_type,
      max_amount: block_type === 'partial' ? max_amount : null,
      reason,
      is_active: true,
    }));

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

// DELETE - ลบเลขอั้น (เฉพาะของ agent ที่ login)
export async function DELETE(request: NextRequest) {
  try {
    const ctxResult = await requireAgentContext();
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const number = searchParams.get('number');
    const lotteryId = searchParams.get('lottery_id');

    if (id) {
      // ลบตาม id — บังคับ agent_id จาก session (กันลบของคนอื่น)
      const { error } = await supabase
        .from('agent_blocked_numbers')
        .delete()
        .eq('id', id)
        .eq('agent_id', agentId);

      if (error) throw error;
    } else if (number && lotteryId) {
      // ลบตาม number + lottery — scope ด้วย agent จาก session
      const { error } = await supabase
        .from('agent_blocked_numbers')
        .delete()
        .eq('agent_id', agentId)
        .eq('lottery_id', lotteryId)
        .eq('number', number);

      if (error) throw error;
    } else {
      return NextResponse.json({
        error: 'id or (number, lottery_id) is required'
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
