import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    
    const supabase = await createClient();
    
    let query = supabase
      .from('topup_requests')
      .select(`
        *,
        customer:customers(id, name, phone),
        approver:users!topup_requests_approved_by_fkey(id, display_name),
        payment_account:payment_accounts(id, account_name, bank_name)
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
      console.error('[v0] Topup requests GET error:', error.message);
      return NextResponse.json([]);
    }
    
    // Transform data - use customer_name/customer_phone if customer join is null
    const transformed = (data || []).map(req => ({
      ...req,
      customer: req.customer || {
        id: req.customer_id,
        name: req.customer_name || 'ไม่ระบุชื่อ',
        phone: req.customer_phone || 'ไม่ระบุเบอร์',
      },
    }));
    
    
    return NextResponse.json(transformed);
  } catch (err) {
    console.error('[v0] Topup requests GET exception:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, amount, bank_name, slip_url } = body;
    
    if (!customer_id || !amount || !bank_name) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('topup_requests')
      .insert({
        customer_id,
        amount,
        bank_name,
        slip_url,
        status: 'pending',
      })
      .select(`
        *,
        customer:customers(id, name, phone)
      `)
      .single();
    
    if (error) {
      console.error('[v0] Topup request POST error:', error.message);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างคำขอเติมเงินได้' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Topup request POST exception:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, status, reject_reason, approved_by } = body;
    
    if (!id || !status) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Get request details first
    const { data: topupRequest, error: fetchError } = await supabase
      .from('topup_requests')
      .select('*, customer:customers(id, name, credit_balance)')
      .eq('id', id)
      .single();
    
    if (fetchError || !topupRequest) {
      return NextResponse.json(
        { error: 'ไม่พบคำขอเติมเงิน' },
        { status: 404 }
      );
    }
    
    if (topupRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'คำขอนี้ถูกดำเนินการแล้ว' },
        { status: 400 }
      );
    }
    
    // Update request status
    const updateData: Record<string, unknown> = {
      status,
      approved_by,
      approved_at: new Date().toISOString(),
    };
    
    if (status === 'rejected' && reject_reason) {
      updateData.reject_reason = reject_reason;
    }
    
    const { error: updateError } = await supabase
      .from('topup_requests')
      .update(updateData)
      .eq('id', id);
    
    if (updateError) {
      console.error('[v0] Topup request update error:', updateError.message);
      return NextResponse.json(
        { error: 'ไม่สามารถอัปเดตคำขอได้' },
        { status: 500 }
      );
    }
    
    // If approved, add credit to customer
    if (status === 'approved') {
      const currentBalance = topupRequest.customer?.credit_balance || 0;
      const newBalance = currentBalance + topupRequest.amount;
      
      // Update customer credit
      const { error: creditError } = await supabase
        .from('customers')
        .update({ credit_balance: newBalance })
        .eq('id', topupRequest.customer_id);
      
      if (creditError) {
        console.error('[v0] Credit update error:', creditError.message);
      }
      
      // Create credit transaction
      await supabase
        .from('credit_transactions')
        .insert({
          customer_id: topupRequest.customer_id,
          type: 'deposit',
          amount: topupRequest.amount,
          balance_before: currentBalance,
          balance_after: newBalance,
          note: `เติมเงินผ่านสลิป - ${topupRequest.bank_name}`,
          created_by: approved_by,
        });
    }
    
    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error('[v0] Topup request PUT exception:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
