import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Get active payment accounts
    const { data: accounts } = await supabase
      .from('tenant_payment_accounts')
      .select('id, account_type, bank_code, account_number, account_name, min_deposit, max_deposit')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);

    return NextResponse.json({ accounts: accounts || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
