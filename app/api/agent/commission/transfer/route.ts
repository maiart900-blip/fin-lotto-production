import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext } from '@/lib/agent-context';

export async function POST(request: NextRequest) {
  try {
    // identity จาก session — การโอนคอมทำได้เฉพาะของ agent ตัวเองเท่านั้น
    const ctxResult = await requireAgentContext();
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;

    if (!context.agentId) {
      return NextResponse.json({ error: 'Agent context required' }, { status: 403 });
    }

    const supabase = await createClient();

    // ดึงคอมค้างจ่ายเฉพาะของ agent นี้ (กันการโอนคอมของคนอื่น)
    const { data: pendingLogs, error: logsError } = await supabase
      .from('commission_logs')
      .select('id, amount')
      .eq('status', 'pending')
      .eq('agent_id', context.agentId);

    if (logsError) {
      throw logsError;
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      return NextResponse.json(
        { error: 'No pending commission to transfer' },
        { status: 400 }
      );
    }

    // ยอดรวมคำนวณจากข้อมูลจริงฝั่ง server (ไม่รับ amount จาก client)
    const totalPending = pendingLogs.reduce(
      (sum, log) => sum + Number(log.amount || 0),
      0
    );

    // อัปเดตเฉพาะรายการของ agent นี้ (double-guard ด้วย agent_id)
    const logIds = pendingLogs.map((log) => log.id);
    const { error: updateError } = await supabase
      .from('commission_logs')
      .update({
        status: 'credited',
        paid_at: new Date().toISOString(),
      })
      .in('id', logIds)
      .eq('agent_id', context.agentId);

    if (updateError) {
      throw updateError;
    }

    // บันทึกธุรกรรม (ผูก agent_id จาก session)
    await supabase.from('transactions').insert({
      agent_id: context.agentId,
      transaction_type: 'commission_transfer',
      amount: totalPending,
      status: 'completed',
      description: `โอนค่าคอมมิชชัน ${pendingLogs.length} รายการ`,
      process_type: 'auto',
    });

    return NextResponse.json({
      success: true,
      transferred: totalPending,
      logsCount: pendingLogs.length,
      message: `โอนค่าคอมมิชชัน ฿${totalPending.toLocaleString()} เรียบร้อยแล้ว`,
    });
  } catch (error) {
    console.error('Commission transfer error:', error);
    return NextResponse.json(
      { error: 'Failed to transfer commission' },
      { status: 500 }
    );
  }
}
