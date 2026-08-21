import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { auditLogger } from '@/lib/audit-logger';

/**
 * API สำหรับจัดการโพย (Admin Only)
 * - refund: คืนเงินโพย (ไม่จำกัดเวลา)
 * - hold: พักโพยชั่วคราว
 * - unhold: ปลดพักโพย
 */

// POST - จัดการโพย
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: betId } = await params;

  // ตรวจสอบ Authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ตรวจสอบสิทธิ์ Admin
  const { data: userData } = await supabase
    .from('users')
    .select('id, role, name')
    .eq('id', user.id)
    .single();

  if (
    !userData ||
    !['super_admin', 'admin', 'manager'].includes(userData.role)
  ) {
    return NextResponse.json(
      { error: 'Permission denied' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !['refund', 'hold', 'unhold'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    if (!reason && action === 'refund') {
      return NextResponse.json(
        { error: 'Reason is required for refund' },
        { status: 400 }
      );
    }

    // ดึงข้อมูลโพย
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .select(`
        *,
        customer:customers(id, name, credit_balance, phone),
        lottery:lotteries(id, name)
      `)
      .eq('id', betId)
      .single();

    if (betError || !bet) {
      return NextResponse.json(
        { error: 'Bet not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    switch (action) {
      case 'refund': {
        // ตรวจสอบสถานะ (ไม่สามารถคืนโพยที่จ่ายแล้วหรือยกเลิกแล้ว)
        if (
          bet.status === 'paid' ||
          bet.status === 'cancelled' ||
          bet.status === 'refunded'
        ) {
          return NextResponse.json(
            {
              error: `ไม่สามารถคืนโพยสถานะ "${bet.status}" ได้`,
            },
            { status: 400 }
          );
        }

        // ATOMIC STATUS UPDATE
        const { data: updatedBet, error: updateError } = await supabase
          .from('bets')
          .update({
            status: 'refunded',
            refunded_at: now,
            refunded_by: user.id,
            refund_reason: reason,
            updated_at: now,
          })
          .eq('id', betId)
          .not('status', 'in', '("paid","cancelled","refunded")')
          .select('id, status')
          .single();

        if (updateError || !updatedBet) {
          return NextResponse.json(
            {
              error: 'Bet already refunded or modified by another request',
              code: 'BET_ALREADY_MODIFIED',
            },
            { status: 409 }
          );
        }

        // อัปเดต bet_items
        await supabase
          .from('bet_items')
          .update({ status: 'refunded' })
          .eq('bet_id', betId);

        // คืนเงินให้ลูกค้า
        const customer = bet.customer as any;
        const refundAmount = Number(bet.total_amount) || 0;

        const { data: updatedCustomer, error: creditError } = await supabase
          .from('customers')
          .update({
            credit_balance:
              (Number(customer?.credit_balance) || 0) + refundAmount,
            updated_at: now,
          })
          .eq('id', bet.customer_id)
          .select('credit_balance')
          .single();

        if (creditError || !updatedCustomer) {
          // Rollback bet status if credit update fails
          await supabase
            .from('bets')
            .update({
              status: bet.status,
              refunded_at: null,
              refunded_by: null,
              refund_reason: null,
            })
            .eq('id', betId);

          return NextResponse.json(
            { error: 'Failed to refund credit' },
            { status: 500 }
          );
        }

        const newBalance = updatedCustomer.credit_balance;

        // บันทึก credit transaction
        await supabase
          .from('credit_transactions')
          .insert({
            customer_id: bet.customer_id,
            amount: refundAmount,
            type: 'refund',
            description: `คืนโพย ${(bet.lottery as any)?.name || 'หวย'} - ${reason}`,
            balance_after: newBalance,
            reference_id: betId,
            reference_type: 'admin_refund',
            created_by: user.id,
          });

        // ลดยอด number_risks
        const { data: betItems } = await supabase
          .from('bet_items')
          .select(
            'number, bet_type, amount_top, amount_bottom, amount_tod'
          )
          .eq('bet_id', betId);

        if (betItems) {
          for (const item of betItems) {
            const totalAmount =
              (Number(item.amount_top) || 0) +
              (Number(item.amount_bottom) || 0) +
              (Number(item.amount_tod) || 0);

            // Supabase query builder ไม่รองรับ .catch() ต่อท้าย
            const { error: riskError } = await supabase.rpc(
              'decrease_number_risk',
              {
                p_lottery_id: bet.lottery_id,
                p_number: item.number,
                p_bet_type: item.bet_type,
                p_amount: totalAmount,
              }
            );

            // ถ้า RPC ไม่มีหรือทำงานไม่ได้ ให้ข้ามไป
            if (riskError) {
              console.warn(
                '[Bet Manage] decrease_number_risk skipped:',
                riskError.message
              );
            }
          }
        }

        // Audit Log
        await auditLogger.log({
          action: 'bet_refund',
          performedBy: user.id,
          performerName: userData.name,
          performerRole: userData.role,
          targetId: betId,
          targetType: 'bet',
          oldValues: { status: bet.status },
          newValues: {
            status: 'refunded',
            refund_reason: reason,
          },
          details: {
            customer_id: bet.customer_id,
            customer_name: customer?.name,
            lottery_name: (bet.lottery as any)?.name,
            total_amount: refundAmount,
            new_balance: newBalance,
          },
        });

        return NextResponse.json({
          success: true,
          action: 'refund',
          message: 'คืนโพยสำเร็จ',
          bet_id: betId,
          refund_amount: refundAmount,
          new_balance: newBalance,
        });
      }

      case 'hold': {
        if (bet.status === 'on_hold') {
          return NextResponse.json(
            { error: 'โพยถูกพักไว้แล้ว' },
            { status: 400 }
          );
        }

        if (['cancelled', 'refunded', 'paid'].includes(bet.status)) {
          return NextResponse.json(
            {
              error: `ไม่สามารถพักโพยสถานะ "${bet.status}" ได้`,
            },
            { status: 400 }
          );
        }

        const previousStatus = bet.status;

        const { error: updateError } = await supabase
          .from('bets')
          .update({
            status: 'on_hold',
            previous_status: previousStatus,
            hold_at: now,
            hold_by: user.id,
            hold_reason: reason || 'ตรวจสอบข้อมูล',
            updated_at: now,
          })
          .eq('id', betId);

        if (updateError) {
          throw updateError;
        }

        await auditLogger.log({
          action: 'bet_hold',
          performedBy: user.id,
          performerName: userData.name,
          performerRole: userData.role,
          targetId: betId,
          targetType: 'bet',
          oldValues: { status: previousStatus },
          newValues: {
            status: 'on_hold',
            hold_reason: reason,
          },
        });

        return NextResponse.json({
          success: true,
          action: 'hold',
          message: 'พักโพยสำเร็จ',
          bet_id: betId,
          previous_status: previousStatus,
        });
      }

      case 'unhold': {
        if (bet.status !== 'on_hold') {
          return NextResponse.json(
            { error: 'โพยไม่ได้อยู่ในสถานะพัก' },
            { status: 400 }
          );
        }

        const restoreStatus = bet.previous_status || 'confirmed';

        const { error: updateError } = await supabase
          .from('bets')
          .update({
            status: restoreStatus,
            previous_status: null,
            hold_at: null,
            hold_by: null,
            hold_reason: null,
            unhold_at: now,
            unhold_by: user.id,
            updated_at: now,
          })
          .eq('id', betId);

        if (updateError) {
          throw updateError;
        }

        await auditLogger.log({
          action: 'bet_unhold',
          performedBy: user.id,
          performerName: userData.name,
          performerRole: userData.role,
          targetId: betId,
          targetType: 'bet',
          oldValues: { status: 'on_hold' },
          newValues: { status: restoreStatus },
        });

        return NextResponse.json({
          success: true,
          action: 'unhold',
          message: 'ปลดพักโพยสำเร็จ',
          bet_id: betId,
          restored_status: restoreStatus,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Bet management error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    );
  }
}