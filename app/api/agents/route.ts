import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher (agents can see list for their own reference)
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';

    // Summary query (count only, no data fetch)
    let countQuery = supabase.from('agents').select('*', { count: 'exact', head: true });
    if (status) countQuery = countQuery.eq('status', status);
    const { count: totalCount } = await countQuery;

    // Active count
    const { count: activeCount } = await supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'active');

    // Data query with pagination
    let query = supabase
      .from('agents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      console.error('Agents fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const summary = {
      total: totalCount || 0,
      active: activeCount || 0,
      inactive: (totalCount || 0) - (activeCount || 0),
      totalBets: data?.reduce((sum, a) => sum + (Number(a.total_bets) || 0), 0) || 0,
      totalCommission: data?.reduce((sum, a) => sum + (Number(a.total_commission) || 0), 0) || 0,
    };

    return NextResponse.json({
      agents: data || [],
      summary,
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
    });
  } catch (error) {
    console.error('Agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('agents')
      .insert({
        code: body.code || `AG${Date.now()}`,
        name: body.name,
        phone: body.phone,
        password: body.password,
        role: body.role || 'agent',
        parent_id: body.parent_id || null,
        site_url: body.site_url,
        contact_name: body.contact_name,
        contact_phone: body.contact_phone || body.phone,
        contact_line: body.contact_line,
        credit_limit: body.credit_limit || 100000,
        commission_rate: body.commission_rate || 5,
        share_percent: body.share_percent || 50,
        settlement_type: body.settlement_type || 'daily',
        status: body.status || 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Create agent error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agent: data });
  } catch (error) {
    console.error('Create agent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
