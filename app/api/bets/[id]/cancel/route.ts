import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuditLog, getClientIP, getUserAgent } from '@/lib/audit-log';

// POST - ยกเลิกโพย (ได้เฉพาะภายใน 5 นาที)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  const adminId = cookieStore.get('admin_id')?.value;
  const { id: betId } = await params;
  
  if (!customerId && !adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ดึงข้อมูลโพย
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .select(`
        *,
        customer:customers(id, name, credit_balance),
        lottery:lotteries(id, name)
      `)
      .eq('id', betId)
      .single();

    if (betError || !bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์ (ต้องเป็นเจ้าของโพยหรือแอดมิน)
    const isOwner = bet.customer_id === customerId;
    const isCreator = bet.created_by === adminId;
    const isAdmin = !!adminId;
    
    if (!isOwner && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // ตรวจสอบสถานะโพย
    if (bet.status === 'cancelled') {
      return NextResponse.json({ error: 'Bet already cancelled' }, { status: 400 });
    }

    if (bet.status !== 'confirmed' && bet.status !== 'pending') {
      return NextResponse.json({ error: 'Cannot cancel this bet' }, { status: 400 });
    }

    // ตรวจสอบเวลายกเลิก (5 นาที)
    const now = new Date();
    const cancelDeadline = new Date(bet.cancel_deadline);
    
    if (now > cancelDeadline) {
      const minutesPassed = Math.floor((now.getTime() - new Date(bet.created_at).getTime()) / 60000);
      return NextResponse.json({ 
        error: `ไม่สามารถยกเลิกโพยได้ เกิน 5 นาทีแล้ว (ผ่านมา ${minutesPassed} นาที)`,
        can_cancel: false,
        minutes_passed: minutesPassed,
      }, { status: 400 });
    }

    // คำนวณเวลาที่เหลือ
    const timeRemaining = Math.ceil((cancelDeadline.getTime() - now.getTime()) / 1000);

    // อัปเดตสถานะโพยเป็น cancelled
    const { error: updateError } = await supabase
      .from('bets')
      .update({ 
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        cancelled_by: adminId || customerId,
      })
      .eq('id', betId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // อัปเดต bet_items เป็น cancelled
    await supabase
      .from('bet_items')
      .update({ status: 'cancelled' })
      .eq('bet_id', betId);

    // คืนเงินให้ลูกค้า
    const customer = bet.customer as any;
    const newBalance = (customer?.credit_balance || 0) + bet.total_amount;
    
    await supabase
      .from('customers')
      .update({ 
        credit_balance: newBalance,
        updated_at: now.toISOString(),
      })
      .eq('id', bet.customer_id);

    // บันทึก credit transaction (คืนเงิน)
    await supabase
      .from('credit_transactions')
      .insert({
        customer_id: bet.customer_id,
        amount: bet.total_amount,
        type: 'refund',
        description: `ยกเลิกโพย ${(bet.lottery as any)?.name || 'หวย'}`,
        balance_after: newBalance,
        reference_id: betId,
        reference_type: 'bet_cancel',
      });

    // ลดยอดจาก number_risks
    const { data: betItems } = await supabase
      .from('bet_items')
      .select('number, bet_type, amount_top, amount_bottom, amount_tod')
      .eq('bet_id', betId);

    if (betItems) {
      for (const item of betItems) {
        const totalAmount = (item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0);
        await supabase.rpc('decrease_number_risk', {
          p_lottery_id: bet.lottery_id,
          p_number: item.number,
          p_bet_type: item.bet_type,
          p_amount: totalAmount,
        }).catch(() => {
          // ถ้าไม่มี function ก็ข้ามไป
        });
      }
    }

    // Audit log
    await createAuditLog({
      action: 'bet_cancel',
      customerId: bet.customer_id,
      targetId: betId,
      targetType: 'bet',
      details: {
        lottery_name: (bet.lottery as any)?.name,
        total_amount: bet.total_amount,
        refund_amount: bet.total_amount,
        new_balance: newBalance,
        cancelled_by: adminId || customerId,
        time_remaining_seconds: timeRemaining,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      message: 'ยกเลิกโพยสำเร็จ',
      bet_id: betId,
      refund_amount: bet.total_amount,
      new_balance: newBalance,
    });

  } catch (error) {
    console.error('Error cancelling bet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - ตรวจสอบว่ายกเลิกโพยได้หรือไม่
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: betId } = await params;

  const { data: bet, error } = await supabase
    .from('bets')
    .select('id, status, cancel_deadline, created_at, total_amount')
    .eq('id', betId)
    .single();

  if (error || !bet) {
    return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
  }

  const now = new Date();
  const cancelDeadline = new Date(bet.cancel_deadline);
  const canCancel = now <= cancelDeadline && (bet.status === 'confirmed' || bet.status === 'pending');
  const timeRemaining = Math.max(0, Math.ceil((cancelDeadline.getTime() - now.getTime()) / 1000));

  return NextResponse.json({
    bet_id: betId,
    can_cancel: canCancel,
    status: bet.status,
    cancel_deadline: bet.cancel_deadline,
    time_remaining_seconds: timeRemaining,
    total_amount: bet.total_amount,
    reason: !canCancel 
      ? (bet.status === 'cancelled' ? 'โพยถูกยกเลิกแล้ว' : 
         now > cancelDeadline ? 'เกินเวลายกเลิก 5 นาที' : 
         'ไม่สามารถยกเลิกสถานะนี้ได้')
      : null,
  });
}
