import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('withdraw_accounts')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist or any error, return empty array
      console.log('Withdraw accounts not found, returning default:', error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching withdraw accounts:', error);
    // Return empty array instead of error for better UX
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { 
      bank_code,
      bank_name, 
      account_name, 
      account_number, 
      is_active = true,
      is_primary = false,
      daily_limit = 500000,
      min_withdraw = 100,
      max_withdraw = 50000,
      note,
      sort_order = 0,
    } = body;

    // Validate required fields
    if (!bank_code || !bank_name || !account_name || !account_number) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, 
        { status: 400 }
      );
    }

    // If setting as primary, unset other primary accounts first
    if (is_primary) {
      await supabase
        .from('withdraw_accounts')
        .update({ is_primary: false })
        .eq('is_primary', true);
    }

    const { data, error } = await supabase
      .from('withdraw_accounts')
      .insert({
        bank_code,
        bank_name,
        account_name,
        account_number,
        is_active,
        is_primary,
        daily_limit,
        current_daily_used: 0,
        min_withdraw,
        max_withdraw,
        note,
        sort_order,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating withdraw account:', error);
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มบัญชีได้' }, { status: 500 });
  }
}
