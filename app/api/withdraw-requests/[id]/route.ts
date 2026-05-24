import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { subtractCredit, addCredit } from '@/lib/wallet-ledger';
import { createAuditLog, getClientIP, getUserAgent } from '@/lib/audit-log';
import { requirePermission } from '@/lib/permissions';
import { 
  checkSelfApproval, 
  checkApprovalLimits, 
  updateDailyTracking,
  logSecurityEvent 
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
        customer:customers(id, name, phone, credit_balance),
        approved_by_user:users!withdraw_requests_approved_by_fkey(id, display_name)
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[v0] Withdraw request GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
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
    
    const supabase = await createClient();
    
    // Get current request
    const { data: withdrawRequest, error: fetchError } = await supabase
      .from('withdraw_requests')
      .select('*, customer:customers(id, name, credit_balance)')
      .eq('id', id)
      .single();
    
    if (fetchError || !withdrawRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    
    if (withdrawRequest.status !== 'pending' && withdrawRequest.status !== 'reviewing') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }
    
    // Security Check 1: Self-approval prevention
    const selfApprovalCheck = await checkSelfApproval(
      withdrawRequest.created_by,
      admin.id
    );
    if (!selfApprovalCheck.allowed) {
      return NextResponse.json({ error: selfApprovalCheck.reason }, { status: 403 });
    }
    
    // Security Check 2: Approval limits
    const limitsCheck = await checkApprovalLimits({
      userId: admin.id,
      userRole: admin.role || 'operator',
      amount: withdrawRequest.amount,
      type: 'withdraw',
    });
    if (!limitsCheck.allowed) {
      return NextResponse.json({ error: limitsCheck.reason }, { status: 403 });
    }
    
    // Check if supervisor approval needed
    if (limitsCheck.requiresSupervisor && admin.role !== 'owner' && admin.role !== 'super_admin') {
      return NextResponse.json({ 
        error: `จำนวนเงิน ${withdrawRequest.amount} บาท ต้องให้หัวหน้าอนุมัติ`,
        requiresSupervisor: true 
      }, { status: 403 });
    }
    
    const now = new Date().toISOString();
    
    if (action === 'approve') {
      // Check if credit was already deducted when request was created
      // If not, deduct now
      if (!withdrawRequest.credit_deducted) {
        const walletResult = await subtractCredit({
          customerId: withdrawRequest.customer_id,
          amount: withdrawRequest.amount,
          type: 'withdraw',
          description: `ถอนเงิน #${id.slice(0, 8)}`,
          referenceId: id,
          referenceType: 'withdraw_request',
          performedBy: admin.id,
        });
        
        if (!walletResult.success) {
          return NextResponse.json({ error: walletResult.error || 'ยอดเครดิตไม่เพียงพอ' }, { status: 400 });
        }
      }
      
      // Update request status
      await supabase
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
      
      // Create notification
      await supabase.from('notifications').insert({
        customer_id: withdrawRequest.customer_id,
        title: 'ถอนเงินสำเร็จ',
        message: `ยอดถอน ${withdrawRequest.amount.toLocaleString()} บาท กำลังดำเนินการ`,
        type: 'withdraw',
      });
      
      // Audit log
      await createAuditLog({
        action: 'withdraw_approve',
        userId: admin.id,
        customerId: withdrawRequest.customer_id,
        targetId: id,
        targetType: 'withdraw_request',
        details: { amount: withdrawRequest.amount, bank: withdrawRequest.bank_name },
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      });
      
      // Update daily tracking
      await updateDailyTracking({
        userId: admin.id,
        amount: withdrawRequest.amount,
        type: 'withdraw',
      });
      
      return NextResponse.json({ success: true, message: 'อนุมัติสำเร็จ' });
      
    } else if (action === 'reject') {
      // If credit was deducted, refund it
      if (withdrawRequest.credit_deducted) {
        await addCredit({
          customerId: withdrawRequest.customer_id,
          amount: withdrawRequest.amount,
          type: 'refund',
          description: `คืนเงินถอน #${id.slice(0, 8)} (ปฏิเสธ)`,
          referenceId: id,
          referenceType: 'withdraw_request',
          performedBy: admin.id,
        });
      }
      
      // Update request status
      await supabase
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
      
      // Create notification
      await supabase.from('notifications').insert({
        customer_id: withdrawRequest.customer_id,
        title: 'คำขอถอนเงินถูกปฏิเสธ',
        message: admin_note || 'กรุณาติดต่อแอดมิน',
        type: 'alert',
      });
      
      // Audit log
      await createAuditLog({
        action: 'withdraw_reject',
        userId: admin.id,
        customerId: withdrawRequest.customer_id,
        targetId: id,
        targetType: 'withdraw_request',
        details: { amount: withdrawRequest.amount, reason: admin_note },
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      });
      
      return NextResponse.json({ success: true, message: 'ปฏิเสธสำเร็จ' });
      
    } else if (action === 'reviewing') {
      await supabase
        .from('withdraw_requests')
        .update({
          status: 'reviewing',
          updated_at: now,
        })
        .eq('id', id);
      
      return NextResponse.json({ success: true, message: 'เปลี่ยนสถานะเป็นกำลังตรวจสอบ' });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[v0] Withdraw request PATCH error:', error);
    if (error instanceof Error && error.message === 'Permission denied') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
