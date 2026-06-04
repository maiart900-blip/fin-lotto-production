import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { auditLogger } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    

    let query = supabase
      .from('withdraw_requests')
      .select(`
        *,
        customer:customers(id, name, phone, credit_balance),
        approved_by_user:users!withdraw_requests_approved_by_fkey(id, username, display_name)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[v0] Withdraw requests fetch error:', error);
      // Return empty data instead of throwing
      return NextResponse.json({ 
        requests: [], 
        summary: {
          total: 0,
          pending: 0,
          reviewing: 0,
          approved: 0,
          rejected: 0,
          totalAmount: 0,
          pendingAmount: 0,
        }
      });
    }
    

    // Get summary counts - with safe fallback
    const { data: allRequests } = await supabase
      .from('withdraw_requests')
      .select('status, amount');

    const summary = {
      total: allRequests?.length || 0,
      pending: allRequests?.filter(r => r.status === 'pending').length || 0,
      reviewing: allRequests?.filter(r => r.status === 'reviewing').length || 0,
      approved: allRequests?.filter(r => r.status === 'approved').length || 0,
      rejected: allRequests?.filter(r => r.status === 'rejected').length || 0,
      totalAmount: allRequests?.reduce((sum, r) => sum + Number(r.amount), 0) || 0,
      pendingAmount: allRequests?.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount), 0) || 0,
    };

    return NextResponse.json({ requests: data || [], summary });
  } catch (error) {
    console.error('[v0] Error fetching withdraw requests:', error);
    // Return empty data on error - don't throw 500
    return NextResponse.json({ 
      requests: [], 
      summary: {
        total: 0,
        pending: 0,
        reviewing: 0,
        approved: 0,
        rejected: 0,
        totalAmount: 0,
        pendingAmount: 0,
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { customer_id, amount, bank_name, account_number, account_name, admin_note } = body;

    // Get customer current credit
    const { data: customer } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', customer_id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check for existing pending withdrawals and calculate locked amount
    const { data: pendingWithdraws } = await supabase
      .from('withdraw_requests')
      .select('amount')
      .eq('customer_id', customer_id)
      .eq('status', 'pending');
    
    const lockedAmount = pendingWithdraws?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;
    const availableBalance = Number(customer.credit_balance) - lockedAmount;

    if (availableBalance < amount) {
      return NextResponse.json({ 
        error: `ยอดคงเหลือไม่พอ (ยอดว่าง: ${availableBalance.toLocaleString()} บาท, ยอดล็อค: ${lockedAmount.toLocaleString()} บาท)` 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('withdraw_requests')
      .insert({
        customer_id,
        amount,
        bank_name,
        account_number,
        account_name,
        admin_note,
        credit_before: customer.credit_balance,
        locked_amount: lockedAmount + amount, // Track total locked
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;


    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating withdraw request:', error);
    return NextResponse.json({ error: 'Failed to create withdraw request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, status, reject_reason, admin_note, approved_by, slip_url, transferred_at, transfer_account_id } = body;

    // =====================================================
    // OPTIMISTIC LOCKING - Prevent double approval
    // =====================================================
    
    // Get current request with explicit locking check
    const { data: currentRequest, error: fetchError } = await supabase
      .from('withdraw_requests')
      .select('*, customer:customers(id, credit_balance, name)')
      .eq('id', id)
      .single();

    if (fetchError || !currentRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // CRITICAL: Check if status transition is valid
    // Only 'pending' can be approved/rejected
    // 'processing' means another admin is already handling it
    if (status === 'approved' || status === 'processing') {
      if (currentRequest.status === 'processing') {
        // Already being processed by another admin
        return NextResponse.json({ 
          error: 'รายการนี้กำลังถูกดำเนินการโดยแอดมินคนอื่น กรุณารอสักครู่หรือรีเฟรชหน้าจอ',
          code: 'ALREADY_PROCESSING',
          lockedBy: currentRequest.processing_by,
          lockedAt: currentRequest.processing_at,
        }, { status: 409 }); // 409 Conflict
      }
      
      if (currentRequest.status === 'approved') {
        return NextResponse.json({ 
          error: 'รายการนี้ได้รับการอนุมัติแล้ว',
          code: 'ALREADY_APPROVED',
        }, { status: 409 });
      }
      
      if (currentRequest.status === 'rejected') {
        return NextResponse.json({ 
          error: 'รายการนี้ถูกปฏิเสธไปแล้ว',
          code: 'ALREADY_REJECTED',
        }, { status: 409 });
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    // Add optional fields if provided
    if (admin_note !== undefined) updates.admin_note = admin_note;
    if (slip_url !== undefined) updates.slip_url = slip_url;
    if (transferred_at !== undefined) updates.transferred_at = transferred_at;
    if (transfer_account_id !== undefined) updates.transfer_account_id = transfer_account_id;

    // =====================================================
    // STATUS TRANSITIONS WITH LOCKING
    // =====================================================
    
    if (status === 'processing') {
      // Lock the request - mark as "being processed"
      updates.status = 'processing';
      updates.processing_by = approved_by;
      updates.processing_at = new Date().toISOString();
      
      // Use optimistic locking: only update if still pending
      const { data, error } = await supabase
        .from('withdraw_requests')
        .update(updates)
        .eq('id', id)
        .eq('status', 'pending') // Only if still pending!
        .select()
        .single();
      
      if (error || !data) {
        // Someone else already changed it
        return NextResponse.json({ 
          error: 'รายการนี้ถูกดำเนินการโดยแอดมินคนอื่นแล้ว กรุณารีเฟรชหน้าจอ',
          code: 'RACE_CONDITION',
        }, { status: 409 });
      }
      
      // Log the lock action
      await auditLogger.logAdmin(
        approved_by,
        'wallet_withdraw',
        'withdraw_requests',
        id,
        `เริ่มตรวจสอบคำขอถอนเงิน ${Number(currentRequest.amount).toLocaleString()} บาท`,
        { customerId: currentRequest.customer_id, amount: currentRequest.amount }
      );
      
      return NextResponse.json(data);
    }

    if (status === 'rejected') {
      updates.status = 'rejected';
      updates.reject_reason = reject_reason;
      updates.processing_by = null;
      updates.processing_at = null;
      
      // Log rejection
      await auditLogger.logAdmin(
        approved_by,
        'wallet_withdraw',
        'withdraw_requests',
        id,
        `ปฏิเสธคำขอถอนเงิน ${Number(currentRequest.amount).toLocaleString()} บาท - เหตุผล: ${reject_reason}`,
        { customerId: currentRequest.customer_id, amount: currentRequest.amount, reason: reject_reason }
      );
    }

    if (status === 'approved') {
      updates.status = 'approved';
      updates.approved_by = approved_by;
      updates.approved_at = new Date().toISOString();
      updates.processing_by = null;
      updates.processing_at = null;

      // Deduct credit from customer
      const newCredit = Number(currentRequest.customer.credit_balance) - Number(currentRequest.amount);
      updates.credit_after = newCredit;

      await supabase
        .from('customers')
        .update({ credit_balance: newCredit })
        .eq('id', currentRequest.customer_id);

      // Create credit transaction
      await supabase.from('credit_transactions').insert({
        customer_id: currentRequest.customer_id,
        amount: -Number(currentRequest.amount),
        type: 'withdraw',
        note: `ถอนเงิน - ${currentRequest.bank_name} ${currentRequest.account_number}`,
        reference_type: 'withdraw_request',
        reference_id: id,
        balance_before: currentRequest.customer.credit_balance,
        balance_after: newCredit,
        created_by: approved_by,
      });
      
      // Log approval
      await auditLogger.logFinancial(
        approved_by,
        'wallet_withdraw',
        Number(currentRequest.amount),
        id,
        Number(currentRequest.customer.credit_balance),
        newCredit,
        { 
          customerId: currentRequest.customer_id,
          customerName: currentRequest.customer.name,
          bankName: currentRequest.bank_name,
          accountNumber: currentRequest.account_number,
        }
      );
    }

    // Use optimistic locking for final update
    const allowedPreviousStatuses = status === 'approved' ? ['pending', 'processing'] : ['pending', 'processing'];
    
    const { data, error } = await supabase
      .from('withdraw_requests')
      .update(updates)
      .eq('id', id)
      .in('status', allowedPreviousStatuses)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ 
        error: 'รายการนี้ถูกเปลี่ยนสถานะโดยแอดมินคนอื่นแล้ว กรุณารีเฟรชหน้าจอ',
        code: 'STATUS_CHANGED',
      }, { status: 409 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating withdraw request:', error);
    return NextResponse.json({ error: 'Failed to update withdraw request' }, { status: 500 });
  }
}
