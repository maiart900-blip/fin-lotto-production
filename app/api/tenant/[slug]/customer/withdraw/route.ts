import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = getSupabase();
  try {
    const { slug } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('tenant_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { id: string };
    const body = await request.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get customer with bank info
    const { data: customer } = await supabase
      .from('customers')
      .select('id, credit_balance, bank_code, bank_account_number, bank_account_name')
      .eq('id', decoded.id)
      .eq('tenant_id', tenant.id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (amount > customer.credit_balance) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    if (!customer.bank_account_number) {
      return NextResponse.json({ error: 'No bank account' }, { status: 400 });
    }

    // Create withdraw request
    const { data: withdrawRequest, error } = await supabase
      .from('tenant_withdraw_requests')
      .insert({
        tenant_id: tenant.id,
        customer_id: decoded.id,
        amount,
        bank_code: customer.bank_code,
        account_number: customer.bank_account_number,
        account_name: customer.bank_account_name,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }

    // Deduct balance immediately (hold)
    await supabase
      .from('customers')
      .update({ credit_balance: customer.credit_balance - amount })
      .eq('id', customer.id);

    return NextResponse.json({ success: true, request: withdrawRequest });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
