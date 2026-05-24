import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - บันทึกการจ่ายรางวัล (อัปโหลดสลิป)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { slip_url, note } = body;
    
    const supabase = await createClient();
    
    // อัพเดท entry เป็น paid
    const { data, error } = await supabase
      .from('entries')
      .update({
        payout_status: 'paid',
        payout_slip_url: slip_url,
        payout_note: note,
        payout_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'won')
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, entry: data });
  } catch (error) {
    console.error('Error in prize-payout POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - ดึงข้อมูล entry เดียว
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('entries')
      .select(`
        *,
        lottery:lotteries(id, name)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    // ดึงข้อมูลลูกค้า
    if (data.customer_name) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, phone, bank_code, bank_account_number, bank_account_name')
        .eq('name', data.customer_name)
        .single();
      
      data.customer = customer;
    }
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
