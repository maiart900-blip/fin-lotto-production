import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;

    if (!customerId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const supabase = await createClient();
    
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, phone, username, credit_balance, is_active, referral_code, bank_code, bank_account_number, bank_account_name, created_at, total_bets')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;

    if (!customerId) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('customers')
      .update({
        name: body.name,
        bank_code: body.bank_code,
        bank_account_number: body.bank_account_number,
        bank_account_name: body.bank_account_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
