import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = getSupabase();
  try {
    const { slug } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get(`tenant_${slug}_token`)?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };

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

    // Get customer
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, username, phone, credit_balance, bank_code, bank_account_number, bank_account_name, referral_code, created_at')
      .eq('id', decoded.id)
      .eq('tenant_id', tenant.id)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
