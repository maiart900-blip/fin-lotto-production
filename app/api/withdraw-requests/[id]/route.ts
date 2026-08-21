import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { subtractCredit, addCredit } from '@/lib/wallet-ledger';
import {
  createAuditLog,
  getClientIP,
  getUserAgent,
} from '@/lib/audit-log';
import { requirePermission } from '@/lib/permissions';
import {
  checkSelfApproval,
  checkApprovalLimits,
  updateDailyTracking,
} from '@/lib/security/fraud-prevention';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('withdraw_requests')
      .select(`
        *,
        customer:customers(
          id,
          name,
          phone,
          credit_balance
        ),
        approved_by_user:users!withdraw_requests_approved_by_fkey(
          id,
          display_name
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Withdraw request GET error:', error);

    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requirePermission('approve_withdraws');

    const { id } = await params;

    const body = await request.json();
    const { action, admin_note } = body;

    if (
      action !== 'approve' &&
      action !== 'reject' &&
      action !== 'reviewing'
    ) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current request
    const {
      data: withdrawRequest,
      error: fetchError,
    } = await supabase
      .from('withdraw_requests')
      .select(`
        *,
        customer:customers(
          id,
          name,
          credit_balance
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !withdrawRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    if (
      withdrawRequest.status !== 'pending' &&
      withdrawRequest.status !== 'reviewing'
    ) {
      return NextResponse.json(
        { error: 'Request already processed' },
        { status: 400 }
      );
    }

    const amount =
      Number(withdrawRequest.amount) || 0;

    // Security Check 1: Self-approval prevention
    const selfApprovalCheck =
      await checkSelfApproval(
        withdrawRequest.created_by,
        admin.id
      );

    if (!selfApprovalCheck.allowed) {
      return NextResponse.json(
        { error: selfApprovalCheck.reason },
        { status: 403 }
      );
    }

    // Security Check 2: Approval limits
    const limitsCheck =
      await checkApprovalLimits({
        userId: admin.id,
        userRole: admin.role || 'operator',
        amount,
        type: 'withdraw',
      });

    if (!limitsCheck.allowed) {
      return NextResponse.json(
        { error: limitsCheck.reason },
        { status: 403 }
      );
    }

    /*
     * แปลง role เป็น string ก่อน
     * เพื่อแก้ TS2367:
     * Role และ "owner" ไม่มี overlap กันใน type
     */
    const adminRole = String(
      admin.role || 'operator'
    );

    // Check if supervisor approval needed
    if (
      limitsCheck.requiresSupervisor &&
      adminRole !== 'owner' &&
      adminRole !== 'super_admin'
    ) {
      return NextResponse.json(
        {
          error: `จำนวนเงิน ${amount} บาท ต้องให้หัวหน้าอนุมัติ`,
          requiresSupervisor: true,
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      // Check if credit was already deducted
      if (!withdrawRequest.credit_deducted) {
        const walletResult =
          await subtractCredit({
            customerId:
              withdrawRequest.customer_id,
            amount,
            type: 'withdraw',
            description: `ถอนเงิน #${id.slice(0, 8)}`,
            referenceId: id,
            referenceType:
              'withdraw_request',
            performedBy: admin.id,
          });

        if (!walletResult.success) {
          return NextResponse.json(
            {
              error:
                walletResult.error ||
                'ยอดเครดิตไม่เพียงพอ',
            },
            { status: 400 }
          );
        }
      }

      // Update request status
      const {
        error: updateError,
      } = await supabase
        .from('withdraw_requests')
        .update({
          status: 'approved',
          approved_by: admin.id,
          approved_at: now,
          admin_note,
          credit_deducted: true,
          updated_at: now,
        })
        .eq('id', id);

      if (updateError) {
        console.error(
          'Withdraw approve update error:',
          updateError
        );

        return NextResponse.json(
          {
            error:
              'ไม่สามารถอัปเดตสถานะรายการถอนได้',
          },
          { status: 500 }
        );
      }

      // Create notification
      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          customer_id:
            withdrawRequest.customer_id,
          title: 'ถอนเงินสำเร็จ',
          message: `ยอดถอน ${amount.toLocaleString()} บาท กำลังดำเนินการ`,
          type: 'withdraw',
        });

      if (notificationError) {
        console.error(
          'Withdraw notification error:',
          notificationError
        );
      }

      // Audit log
      try {
        await createAuditLog({
          action: 'withdraw_approve',
          userId: admin.id,
          customerId:
            withdrawRequest.customer_id,
          targetId: id,
          targetType:
            'withdraw_request',
          details: {
            amount,
            bank:
              withdrawRequest.bank_name,
          },
          ipAddress:
            getClientIP(request),
          userAgent:
            getUserAgent(request),
        });
      } catch (auditError) {
        console.error(
          'Withdraw approve audit error:',
          auditError
        );
      }

      // Update daily tracking
      try {
        await updateDailyTracking({
          userId: admin.id,
          amount,
          type: 'withdraw',
        });
      } catch (trackingError) {
        console.error(
          'Withdraw daily tracking error:',
          trackingError
        );
      }

      return NextResponse.json({
        success: true,
        message: 'อนุมัติสำเร็จ',
      });
    }

    if (action === 'reject') {
      // If credit was deducted, refund it
      if (withdrawRequest.credit_deducted) {
        const refundResult =
          await addCredit({
            customerId:
              withdrawRequest.customer_id,
            amount,
            type: 'refund',
            description: `คืนเงินถอน #${id.slice(0, 8)} (ปฏิเสธ)`,
            referenceId: id,
            referenceType:
              'withdraw_request',
            performedBy: admin.id,
          });

        if (!refundResult.success) {
          console.error(
            'Withdraw refund failed:',
            refundResult.error
          );

          return NextResponse.json(
            {
              error:
                refundResult.error ||
                'ไม่สามารถคืนเครดิตได้',
            },
            { status: 500 }
          );
        }
      }

      // Update request status
      const {
        error: rejectError,
      } = await supabase
        .from('withdraw_requests')
        .update({
          status: 'rejected',
          approved_by: admin.id,
          approved_at: now,
          admin_note,
          credit_deducted: false,
          updated_at: now,
        })
        .eq('id', id);

      if (rejectError) {
        console.error(
          'Withdraw reject update error:',
          rejectError
        );

        return NextResponse.json(
          {
            error:
              'ไม่สามารถปฏิเสธรายการถอนได้',
          },
          { status: 500 }
        );
      }

      // Create notification
      const {
        error: notificationError,
      } = await supabase
        .from('notifications')
        .insert({
          customer_id:
            withdrawRequest.customer_id,
          title:
            'คำขอถอนเงินถูกปฏิเสธ',
          message:
            admin_note ||
            'กรุณาติดต่อแอดมิน',
          type: 'alert',
        });

      if (notificationError) {
        console.error(
          'Withdraw reject notification error:',
          notificationError
        );
      }

      // Audit log
      try {
        await createAuditLog({
          action: 'withdraw_reject',
          userId: admin.id,
          customerId:
            withdrawRequest.customer_id,
          targetId: id,
          targetType:
            'withdraw_request',
          details: {
            amount,
            reason: admin_note,
          },
          ipAddress:
            getClientIP(request),
          userAgent:
            getUserAgent(request),
        });
      } catch (auditError) {
        console.error(
          'Withdraw reject audit error:',
          auditError
        );
      }

      return NextResponse.json({
        success: true,
        message: 'ปฏิเสธสำเร็จ',
      });
    }

    // Reviewing
    const {
      error: reviewingError,
    } = await supabase
      .from('withdraw_requests')
      .update({
        status: 'reviewing',
        updated_at: now,
      })
      .eq('id', id);

    if (reviewingError) {
      console.error(
        'Withdraw reviewing update error:',
        reviewingError
      );

      return NextResponse.json(
        {
          error:
            'ไม่สามารถเปลี่ยนสถานะได้',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'เปลี่ยนสถานะเป็นกำลังตรวจสอบ',
    });
  } catch (error) {
    console.error(
      'Withdraw request PATCH error:',
      error
    );

    if (
      error instanceof Error &&
      error.message ===
        'Permission denied'
    ) {
      return NextResponse.json(
        {
          error:
            'ไม่มีสิทธิ์ดำเนินการ',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}