import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { amount, bank_account_id } = body;

    if (!amount || !bank_account_id) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    if (amount < 100) {
      return NextResponse.json({ error: 'ยอดถอนขั้นต่ำ 100 บาท' }, { status: 400 });
    }

    // Get bank account details
    const { data: bankAccount, error: bankError } = await supabase
      .from('agent_bank_accounts')
      .select('*')
      .eq('id', bank_account_id)
      .single();

    if (bankError || !bankAccount) {
      return NextResponse.json({ error: 'ไม่พบบัญชีธนาคาร' }, { status: 400 });
    }

    // Insert withdrawal request
    const { data, error } = await supabase
      .from('admin_withdrawals')
      .insert({
        amount,
        bank_name: bankAccount.bank_name,
        account_number: bankAccount.account_number,
        account_name: bankAccount.account_name,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Admin withdraw error:', error);
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึก' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Admin withdraw error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
