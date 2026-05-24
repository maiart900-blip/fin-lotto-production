import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    
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

    // Get customers
    let query = supabase
      .from('customers')
      .select('id, name, phone, username, credit_balance, is_active, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data: customers, error } = await query.limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({ customers: customers || [] });
  } catch (error) {
    console.error('Get tenant customers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
