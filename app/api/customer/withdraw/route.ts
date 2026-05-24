import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  
  if (!customerId) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  
  try {
    const { data: requests, error } = await supabase
      .from('withdraw_requests')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    console.error('Error fetching withdraw requests:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  
  
  if (!customerId) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { amount, bank_name, account_number, account_name } = body;
    
    
    if (!amount || amount < 100) {
      return NextResponse.json({ error: 'ยอดถอนขั้นต่ำ 100 บาท' }, { status: 400 });
    }
    
    if (!bank_name || !account_number || !account_name) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }
    
    // Get customer credit and turnover data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('credit_balance, total_deposits, current_turnover, required_turnover, turnover_multiplier')
      .eq('id', customerId)
      .single();
    
    if (customerError) throw customerError;
    
    const currentCredit = Number(customer?.credit_balance || 0);
    if (currentCredit < amount) {
      return NextResponse.json({ error: 'เครดิตไม่เพียงพอ' }, { status: 400 });
    }

    // Check turnover requirement - ดึงค่าจาก settings ก่อน
    const { data: settings } = await supabase
      .from('settings')
      .select('turnover_enabled')
      .eq('id', 1)
      .single();
    
    const turnoverEnabled = settings?.turnover_enabled ?? false;
    const requiredTurnover = Number(customer?.required_turnover || 0);
    const currentTurnover = Number(customer?.current_turnover || 0);
    
    // ถ้าเปิดใช้งาน turnover และ ยอดเทิร์นปัจจุบัน < ยอดเทิร์นที่ต้องทำ = ไม่สามารถถอนได้
    if (turnoverEnabled && requiredTurnover > 0 && currentTurnover < requiredTurnover) {
      const remaining = requiredTurnover - currentTurnover;
      return NextResponse.json({ 
        error: `ยอดเทิร์นไม่เพียงพอ ต้องเดิมพันอีก ${remaining.toLocaleString()} บาท`,
        turnoverRequired: requiredTurnover,
        currentTurnover: currentTurnover,
        remaining: remaining,
      }, { status: 400 });
    }
    
    // Check pending withdrawals
    const { data: pendingRequests } = await supabase
      .from('withdraw_requests')
      .select('amount')
      .eq('customer_id', customerId)
      .eq('status', 'pending');
    
    const pendingTotal = (pendingRequests || []).reduce((sum, r) => sum + Number(r.amount), 0);
    if (currentCredit - pendingTotal < amount) {
      return NextResponse.json({ error: 'มียอดถอนที่รอดำเนินการอยู่' }, { status: 400 });
    }
    
    // Create withdraw request
    const { data: newRequest, error: insertError } = await supabase
      .from('withdraw_requests')
      .insert({
        customer_id: customerId,
        amount,
        bank_name,
        account_number,
        account_name,
        status: 'pending',
        credit_before: currentCredit,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Insert withdraw_requests error:', insertError);
      throw insertError;
    }
    
    
    return NextResponse.json({ 
      success: true, 
      message: 'ส่งคำขอถอนเงินสำเร็จ',
      request: newRequest 
    });
  } catch (error) {
    console.error('Error creating withdraw request:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
