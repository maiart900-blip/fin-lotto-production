import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  verifyAndUpdate2FA,
  is2FARequiredForRole,
} from '@/lib/2fa-guard';

// Dual approval threshold (50,000 THB)
const DUAL_APPROVAL_THRESHOLD = 50000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const supabase = await createClient();

  // Get approver info from session
  const cookieStore = await cookies();
  const sessionCookie =
    cookieStore.get('session') ||
    cookieStore.get('lottery_session');

  if (!sessionCookie?.value) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let session: any;

  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
  }

  const approverId =
    session.userId || session.id;

  const approverRole = session.role;

  if (!approverId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get IP address
  const clientIP =
    request.headers
      .get('x-forwarded-for')
      ?.split(',')[0]
      ?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Parse body safely
  let body: Record<string, any> = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { twoFactorCode } = body;

  // Check if 2FA verification is required
  if (is2FARequiredForRole(approverRole)) {
    const sessionVerified =
      session.twoFactorVerified;

    const lastVerifiedAt =
      session.lastTwoFactorVerifiedAt;

    const fiveMinutesAgo =
      Date.now() - 5 * 60 * 1000;

    const recentlyVerified =
      Boolean(sessionVerified) &&
      Boolean(lastVerifiedAt) &&
      new Date(lastVerifiedAt).getTime() >
        fiveMinutesAgo;

    if (!recentlyVerified) {
      if (!twoFactorCode) {
        return NextResponse.json(
          {
            error:
              'กรุณายืนยัน 2FA ก่อนอนุมัติรายการ',
            requires2FA: true,
          },
          { status: 403 }
        );
      }

      const isValid =
        await verifyAndUpdate2FA(
          approverId,
          twoFactorCode
        );

      if (!isValid) {
        return NextResponse.json(
          { error: 'รหัส 2FA ไม่ถูกต้อง' },
          { status: 400 }
        );
      }
    }
  }

  // Get withdraw request
  const {
    data: withdrawRequest,
    error: withdrawError,
  } = await supabase
    .from('tenant_withdraw_requests')
    .select(`
      *,
      customer:customers(
        id,
        credit_balance
      )
    `)
    .eq('id', id)
    .single();

  if (withdrawError || !withdrawRequest) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  if (
    withdrawRequest.status !== 'pending' &&
    withdrawRequest.status !==
      'pending_second_approval'
  ) {
    return NextResponse.json(
      { error: 'Already processed' },
      { status: 400 }
    );
  }

  // Supabase relation may be inferred as array
  const customer = Array.isArray(
    withdrawRequest.customer
  )
    ? withdrawRequest.customer[0] ?? null
    : withdrawRequest.customer;

  const customerBalance =
    Number(customer?.credit_balance) || 0;

  const withdrawAmount =
    Number(withdrawRequest.amount) || 0;

  // Check customer has enough balance
  if (customerBalance < withdrawAmount) {
    return NextResponse.json(
      { error: 'ยอดเครดิตไม่เพียงพอ' },
      { status: 400 }
    );
  }

  // Check if dual approval is required
  const requiresDualApproval =
    withdrawAmount >=
    DUAL_APPROVAL_THRESHOLD;

  if (
    requiresDualApproval &&
    !withdrawRequest.approved_by
  ) {
    // First approval
    const { error: updateError } =
      await supabase
        .from('tenant_withdraw_requests')
        .update({
          approved_by: approverId,
          approved_at:
            new Date().toISOString(),
          approved_ip: clientIP,
          requires_dual_approval: true,
          status:
            'pending_second_approval',
        })
        .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Log first approval
    try {
      const { error: auditError } =
        await supabase
          .from('audit_logs')
          .insert({
            user_id: approverId,
            action:
              'withdraw_first_approval',
            entity_type:
              'tenant_withdraw_requests',
            entity_id: id,
            details: {
              amount: withdrawAmount,
              customer_id:
                withdrawRequest.customer_id,
              tenant_slug: slug,
              ip: clientIP,
            },
            created_at:
              new Date().toISOString(),
          });

      if (auditError) {
        console.error(
          'Withdraw first approval audit log error:',
          auditError
        );
      }
    } catch (auditError) {
      console.error(
        'Withdraw first approval audit log exception:',
        auditError
      );
    }

    return NextResponse.json({
      success: true,
      requiresSecondApproval: true,
      message:
        'อนุมัติขั้นแรกสำเร็จ รอการอนุมัติจากผู้ดูแลคนที่ 2',
    });
  }

  // Check if this is second approval
  if (
    withdrawRequest.requires_dual_approval &&
    withdrawRequest.approved_by
  ) {
    if (
      withdrawRequest.approved_by ===
      approverId
    ) {
      return NextResponse.json(
        {
          error:
            'ไม่สามารถอนุมัติซ้ำโดยผู้อนุมัติคนเดียวกันได้',
        },
        { status: 400 }
      );
    }
  }

  const finalRequiresDualApproval =
    Boolean(
      withdrawRequest.requires_dual_approval
    ) || requiresDualApproval;

  // Final approval
  const { error: updateError } =
    await supabase
      .from('tenant_withdraw_requests')
      .update({
        status: 'approved',

        approved_at:
          finalRequiresDualApproval &&
          withdrawRequest.approved_at
            ? withdrawRequest.approved_at
            : new Date().toISOString(),

        approved_by:
          finalRequiresDualApproval &&
          withdrawRequest.approved_by
            ? withdrawRequest.approved_by
            : approverId,

        approved_ip:
          finalRequiresDualApproval &&
          withdrawRequest.approved_ip
            ? withdrawRequest.approved_ip
            : clientIP,

        second_approver_id:
          finalRequiresDualApproval
            ? approverId
            : null,

        second_approved_at:
          finalRequiresDualApproval
            ? new Date().toISOString()
            : null,
      })
      .eq('id', id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // Deduct credit
  const newBalance =
    customerBalance - withdrawAmount;

  const { error: balanceError } =
    await supabase
      .from('customers')
      .update({
        credit_balance: newBalance,
      })
      .eq(
        'id',
        withdrawRequest.customer_id
      );

  if (balanceError) {
    console.error(
      'Withdraw customer balance update error:',
      balanceError
    );

    return NextResponse.json(
      {
        error:
          'Failed to update customer credit',
      },
      { status: 500 }
    );
  }

  // Create transaction record
  const { error: transactionError } =
    await supabase
      .from('transactions')
      .insert({
        customer_id:
          withdrawRequest.customer_id,

        tenant_id:
          withdrawRequest.tenant_id,

        type: 'withdraw',

        amount: -withdrawAmount,

        balance_after: newBalance,

        status: 'completed',

        description:
          finalRequiresDualApproval
            ? 'ถอนเงิน (อนุมัติ 2 ขั้น)'
            : 'ถอนเงิน (อนุมัติ)',

        reference_id: id,
      });

  if (transactionError) {
    console.error(
      'Withdraw transaction insert error:',
      transactionError
    );
  }

  // Log final approval
  try {
    const { error: auditError } =
      await supabase
        .from('audit_logs')
        .insert({
          user_id: approverId,

          action:
            finalRequiresDualApproval
              ? 'withdraw_second_approval'
              : 'withdraw_approved',

          entity_type:
            'tenant_withdraw_requests',

          entity_id: id,

          details: {
            amount: withdrawAmount,

            customer_id:
              withdrawRequest.customer_id,

            tenant_slug: slug,

            ip: clientIP,

            first_approver:
              withdrawRequest.approved_by,
          },

          created_at:
            new Date().toISOString(),
        });

    if (auditError) {
      console.error(
        'Withdraw final approval audit log error:',
        auditError
      );
    }
  } catch (auditError) {
    console.error(
      'Withdraw final approval audit log exception:',
      auditError
    );
  }

  return NextResponse.json({
    success: true,
    amount: withdrawAmount,
    new_balance: newBalance,
  });
}