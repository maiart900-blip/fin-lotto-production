import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid transfer amount' },
        { status: 400 }
      );
    }

    // Get pending commission logs
    const { data: pendingLogs, error: logsError } = await supabase
      .from('commission_logs')
      .select('id, commission_amount, agent_id')
      .eq('status', 'pending');

    if (logsError) {
      throw logsError;
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      return NextResponse.json(
        { error: 'No pending commission to transfer' },
        { status: 400 }
      );
    }

    // Calculate total pending
    const totalPending = pendingLogs.reduce(
      (sum, log) => sum + Number(log.commission_amount), 
      0
    );

    // Update all pending logs to credited
    const logIds = pendingLogs.map(log => log.id);
    const { error: updateError } = await supabase
      .from('commission_logs')
      .update({ 
        status: 'credited',
        paid_at: new Date().toISOString()
      })
      .in('id', logIds);

    if (updateError) {
      throw updateError;
    }

    // Record the transfer transaction
    await supabase.from('transactions').insert({
      transaction_type: 'commission_transfer',
      amount: totalPending,
      status: 'completed',
      description: `โอนค่าคอมมิชชัน ${pendingLogs.length} รายการ`,
      process_type: 'auto'
    });

    return NextResponse.json({
      success: true,
      transferred: totalPending,
      logsCount: pendingLogs.length,
      message: `โอนค่าคอมมิชชัน ฿${totalPending.toLocaleString()} เรียบร้อยแล้ว`
    });
  } catch (error) {
    console.error('Commission transfer error:', error);
    return NextResponse.json(
      { error: 'Failed to transfer commission' },
      { status: 500 }
    );
  }
}
