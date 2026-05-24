import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
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

  // Build query
  let query = supabase
    .from('tenant_topup_requests')
    .select(`
      *,
      customer:customers(id, name, username, phone)
    `)
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: requests, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get stats
  const { data: pendingCount } = await supabase
    .from('tenant_topup_requests')
    .select('id, amount')
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending');

  const { data: approvedToday } = await supabase
    .from('tenant_topup_requests')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('status', 'approved')
    .gte('updated_at', new Date().toISOString().split('T')[0]);

  const { data: rejectedToday } = await supabase
    .from('tenant_topup_requests')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('status', 'rejected')
    .gte('updated_at', new Date().toISOString().split('T')[0]);

  return NextResponse.json({
    requests: requests || [],
    stats: {
      pending: pendingCount?.length || 0,
      approved: approvedToday?.length || 0,
      rejected: rejectedToday?.length || 0,
      total_pending_amount: pendingCount?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0,
    }
  });
}
