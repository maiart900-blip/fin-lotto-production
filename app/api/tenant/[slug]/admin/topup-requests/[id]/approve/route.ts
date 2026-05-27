import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { verifyAndUpdate2FA, is2FARequiredForRole } from '@/lib/2fa-guard';

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
  const sessionCookie = cookieStore.get('session') || cookieStore.get('lottery_session');
  
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  let session;
  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  
  const approverId = session.userId || session.id;
  const approverRole = session.role;
  
  if (!approverId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Get IP address
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown';
  
  // Check if 2FA verification is required for this action
  const body = await request.json().catch(() => ({}));
  const { twoFactorCode } = body;
  
  if (is2FARequiredForRole(approverRole)) {
    // Check if 2FA was verified in this session recently (within 5 minutes)
    const sessionVerified = session.twoFactorVerified;
    const lastVerifiedAt = session.lastTwoFactorVerifiedAt;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    const recentlyVerified = sessionVerified && lastVerifiedAt && new Date(lastVerifiedAt).getTime() > fiveMinutesAgo;
    
    if (!recentlyVerified) {
      if (!twoFactorCode) {
        return NextResponse.json({ 
          error: 'กรุณายืนยัน 2FA ก่อนอนุมัติรายการ',
          requires2FA: true,
        }, { status: 403 });
      }
      
      // Verify 2FA code
      const isValid = await verifyAndUpdate2FA(approverId, twoFactorCode);
      if (!isValid) {
        return NextResponse.json({ error: 'รหัส 2FA ไม่ถูกต้อง' }, { status: 400 });
      }
    }
  }

  // Get topup request
  const { data: topupRequest } = await supabase
    .from('tenant_topup_requests')
    .select('*, customer:customers(id, credit_balance)')
    .eq('id', id)
    .single();

  if (!topupRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (topupRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Already processed' }, { status: 400 });
  }
  
  // Check if dual approval is required
  const requiresDualApproval = topupRequest.amount >= DUAL_APPROVAL_THRESHOLD;
  
  if (requiresDualApproval && !topupRequest.approved_by) {
    // First approval - mark as pending second approval
    const { error: updateError } = await supabase
      .from('tenant_topup_requests')
      .update({ 
        approved_by: approverId,
        approved_at: new Date().toISOString(),
        approved_ip: clientIP,
        requires_dual_approval: true,
        status: 'pending_second_approval',
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    
    // Log first approval
    await supabase.from('audit_logs').insert({
      user_id: approverId,
      action: 'topup_first_approval',
      entity_type: 'tenant_topup_requests',
      entity_id: id,
      details: {
        amount: topupRequest.amount,
        customer_id: topupRequest.customer_id,
        ip: clientIP,
      },
      created_at: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ 
      success: true, 
      requiresSecondApproval: true,
      message: 'อนุมัติขั้นแรกสำเร็จ รอการอนุมัติจากผู้ดูแลคนที่ 2',
    });
  }
  
  // Check if this is second approval
  if (topupRequest.requires_dual_approval && topupRequest.approved_by) {
    // Prevent same person from second approval
    if (topupRequest.approved_by === approverId) {
      return NextResponse.json({ 
        error: 'ไม่สามารถอนุมัติซ้ำโดยผู้อนุมัติคนเดียวกันได้' 
      }, { status: 400 });
    }
  }

  // Update topup request status - final approval
  const { error: updateError } = await supabase
    .from('tenant_topup_requests')
    .update({ 
      status: 'approved',
      approved_at: requiresDualApproval ? topupRequest.approved_at : new Date().toISOString(),
      approved_by: requiresDualApproval ? topupRequest.approved_by : approverId,
      approved_ip: requiresDualApproval ? topupRequest.approved_ip : clientIP,
      second_approver_id: requiresDualApproval ? approverId : null,
      second_approved_at: requiresDualApproval ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Add credit to customer
  const newBalance = (topupRequest.customer?.credit_balance || 0) + topupRequest.amount;
  await supabase
    .from('customers')
    .update({ credit_balance: newBalance })
    .eq('id', topupRequest.customer_id);

  // Create transaction record
  await supabase.from('transactions').insert({
    customer_id: topupRequest.customer_id,
    tenant_id: topupRequest.tenant_id,
    type: 'deposit',
    amount: topupRequest.amount,
    balance_after: newBalance,
    status: 'completed',
    description: requiresDualApproval ? 'เติมเงิน (อนุมัติ 2 ขั้น)' : 'เติมเงิน (อนุมัติ)',
    reference_id: id,
  });

  // Log final approval
  await supabase.from('audit_logs').insert({
    user_id: approverId,
    action: requiresDualApproval ? 'topup_second_approval' : 'topup_approved',
    entity_type: 'tenant_topup_requests',
    entity_id: id,
    details: {
      amount: topupRequest.amount,
      customer_id: topupRequest.customer_id,
      ip: clientIP,
      first_approver: topupRequest.approved_by,
    },
    created_at: new Date().toISOString(),
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
