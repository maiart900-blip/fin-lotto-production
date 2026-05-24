import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  // Get tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Get payment accounts
  const { data: accounts, error } = await supabase
    .from('tenant_payment_accounts')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: accounts || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const body = await request.json();

  // Get tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('tenant_payment_accounts')
    .insert({
      tenant_id: tenant.id,
      account_type: body.account_type,
      bank_code: body.bank_code,
      account_number: body.account_number,
      account_name: body.account_name,
      is_active: body.is_active ?? true,
      min_deposit: body.min_deposit || 100,
      max_deposit: body.max_deposit || 50000,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
