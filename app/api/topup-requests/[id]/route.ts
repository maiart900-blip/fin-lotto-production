import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { addCredit } from '@/lib/wallet-ledger';
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
      .from('topup_requests')
      .select(`
        *,
        customer:customers(id, name, phone, credit_balance),
        approver:users!topup_requests_approved_by_fkey(id, display_name)
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Topup request GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requirePermission('approve_topups');
    const { id } = await params;
    const body = await request.json();
    const { action, admin_note } = body;
    
    const supabase = await createClient();
    
    // Get current request
    const { data: topupRequest, error: fetchError } = await supabase
      .from('topup_requests')
      .select('*, customer:customers(id, name, credit_balance, total_deposits, required_turnover, current_turnover)')
      .eq('id', id)
      .single();
    
    if (fetchError || !topupRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    
    if (topupRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }
    
    // Security Check 1: Self-approval prevention
    const selfApprovalCheck = await checkSelfApproval(
      topupRequest.created_by,
      admin.id
    );
    if (!selfApprovalCheck.allowed) {
      return NextResponse.json({ error: selfApprovalCheck.reason }, { status: 403 });
    }
    
    // Security Check 2: Approval limits
    const limitsCheck = await checkApprovalLimits({
      userId: admin.id,
      userRole: admin.role || 'operator',
      amount: topupRequest.amount,
      type: 'topup',
    });
    if (!limitsCheck.allowed) {
      return NextResponse.json({ error: limitsCheck.reason }, { status: 403 });
    }
    
    // Check if supervisor approval needed
    if (limitsCheck.requiresSupervisor && admin.role !== 'owner' && admin.role !== 'super_admin') {
      return NextResponse.json({ 
        error: `จำนวนเงิน ${topupRequest.amount} บาท ต้องให้หัวหน้าอนุมัติ`,
        requiresSupervisor: true 
      }, { status: 403 });
    }
    
    const now = new Date().toISOString();
    
    if (action === 'approve') {
      // Add credit using wallet ledger
      const walletResult = await addCredit({
        customerId: topupRequest.customer_id,
        amount: topupRequest.amount,
        type: 'deposit',
        description: `เติมเงิน #${id.slice(0, 8)}`,
        referenceId: id,
        referenceType: 'topup_request',
        performedBy: admin.id,
      });
      
      if (!walletResult.success) {
        return NextResponse.json({ error: walletResult.error }, { status: 500 });
      }
      
      // Update required turnover for this deposit
      // ดึงค่า turnover settings จาก database
      const { data: settings } = await supabase
        .from('settings')
        .select('turnover_enabled, turnover_percentage')
        .eq('id', 1)
        .single();
      
      const turnoverEnabled = settings?.turnover_enabled ?? false;
      const turnoverPercentage = settings?.turnover_percentage ?? 100;
      const turnoverMultiplier = turnoverEnabled ? (turnoverPercentage / 100) : 0;
      
      // ยอดเทิร์นที่ต้องทำ = ยอดฝาก x (เปอร์เซ็นต์/100)
      // เช่น ฝาก 1000 x 50% = ต้องเดิมพัน 500 บาท
      if (turnoverEnabled && turnoverMultiplier > 0) {
        const { error: turnoverError } = await supabase.rpc('reset_turnover_on_deposit', {
          p_customer_id: topupRequest.customer_id,
          p_deposit_amount: topupRequest.amount,
          p_multiplier: turnoverMultiplier,
        });
        
        if (turnoverError) {
          console.error('Turnover update error:', turnoverError);
          // Fallback: direct update if RPC fails
          const turnoverAmount = topupRequest.amount * turnoverMultiplier;
          await supabase
            .from('customers')
            .update({ 
              total_deposits: (topupRequest.customer?.total_deposits || 0) + topupRequest.amount,
              required_turnover: (topupRequest.customer?.required_turnover || 0) + turnoverAmount,
            })
            .eq('id', topupRequest.customer_id);
        }
      }
      
      // Update request status
      await supabase
        .from('topup_requests')
        .update({
          status: 'approved',
          approved_by: admin.id,
          approved_at: now,
          admin_note,
          updated_at: now,
        })
        .eq('id', id);
      
      // Create notification for customer
      await supabase.from('notifications').insert({
        customer_id: topupRequest.customer_id,
        title: 'เติมเงินสำเร็จ',
        message: `ยอดเติม ${topupRequest.amount.toLocaleString()} บาท เข้าบัญชีแล้ว`,
        type: 'deposit',
      });
      
      // Audit log
      await createAuditLog({
        action: 'topup_approve',
        userId: admin.id,
        customerId: topupRequest.customer_id,
        targetId: id,
        targetType: 'topup_request',
        details: { amount: topupRequest.amount, newBalance: walletResult.newBalance },
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      });
      
      // Update daily tracking
      await updateDailyTracking({
        userId: admin.id,
        amount: topupRequest.amount,
        type: 'topup',
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'อนุมัติสำเร็จ',
        newBalance: walletResult.newBalance 
      });
      
    } else if (action === 'reject') {
      // Update request status
      await supabase
        .from('topup_requests')
        .update({
          status: 'rejected',
          approved_by: admin.id,
          approved_at: now,
          admin_note,
          updated_at: now,
        })
        .eq('id', id);
      
      // Create notification
      await supabase.from('notifications').insert({
        customer_id: topupRequest.customer_id,
        title: 'คำขอเติมเงินถูกปฏิเสธ',
        message: admin_note || 'กรุณาติดต่อแอดมิน',
        type: 'alert',
      });
      
      // Audit log
      await createAuditLog({
        action: 'topup_reject',
        userId: admin.id,
        customerId: topupRequest.customer_id,
        targetId: id,
        targetType: 'topup_request',
        details: { amount: topupRequest.amount, reason: admin_note },
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      });
      
      return NextResponse.json({ success: true, message: 'ปฏิเสธสำเร็จ' });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('Topup request PATCH error:', error);
    if (error instanceof Error && error.message === 'Permission denied') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
