import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Get current request
    const { data: currentRequest } = await supabase
      .from('withdraw_requests')
      .select('*, customer:customers(id, credit_balance)')
      .eq('id', id)
      .single();

    if (!currentRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    // Add optional fields if provided
    if (status !== undefined) updates.status = status;
    if (admin_note !== undefined) updates.admin_note = admin_note;
    if (slip_url !== undefined) updates.slip_url = slip_url;
    if (transferred_at !== undefined) updates.transferred_at = transferred_at;
    if (transfer_account_id !== undefined) updates.transfer_account_id = transfer_account_id;

    if (status === 'rejected') {
      updates.reject_reason = reject_reason;
    }

    if (status === 'approved') {
      updates.approved_by = approved_by;
      updates.approved_at = new Date().toISOString();

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
    }

    const { data, error } = await supabase
      .from('withdraw_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating withdraw request:', error);
    return NextResponse.json({ error: 'Failed to update withdraw request' }, { status: 500 });
  }
}
