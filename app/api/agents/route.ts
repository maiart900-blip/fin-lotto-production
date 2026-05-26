import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher (agents can see list for their own reference)
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    
    const { user } = authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const includeHierarchy = searchParams.get('include_hierarchy') === 'true';

    // Determine if user can see all agents or only their downline
    const isAdmin = user.role === 'super_admin' || user.role === 'admin';
    
    // For agents/agent_key, get their downline IDs (recursive)
    let downlineIds: string[] = [];
    if (!isAdmin) {
      // Get all agents where parent_id matches current user
      // Use recursive CTE to get full hierarchy
      const { data: downline } = await supabase.rpc('get_agent_downline', { agent_id: user.id });
      if (downline) {
        downlineIds = downline.map((d: { id: string }) => d.id);
      }
      
      // Fallback: if RPC doesn't exist, do simple parent_id check
      if (downlineIds.length === 0) {
        const { data: directDownline } = await supabase
          .from('agents')
          .select('id')
          .eq('parent_id', user.id);
        if (directDownline) {
          downlineIds = directDownline.map(d => d.id);
        }
      }
    }

    // Summary query (count only, no data fetch)
    let countQuery = supabase.from('agents').select('*', { count: 'exact', head: true });
    if (status) countQuery = countQuery.eq('status', status);
    if (!isAdmin && downlineIds.length > 0) {
      countQuery = countQuery.in('id', downlineIds);
    } else if (!isAdmin) {
      // No downline agents - return empty
      return NextResponse.json({
        agents: [],
        summary: { total: 0, active: 0, inactive: 0, totalBets: 0, totalCommission: 0 },
        pagination: { page, limit, total: 0, totalPages: 0 }
      });
    }
    const { count: totalCount } = await countQuery;

    // Active count
    let activeCountQuery = supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'active');
    if (!isAdmin && downlineIds.length > 0) {
      activeCountQuery = activeCountQuery.in('id', downlineIds);
    }
    const { count: activeCount } = await activeCountQuery;

    // Data query with pagination
    let query = supabase
      .from('agents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,phone.ilike.%${search}%,name.ilike.%${search}%,code.ilike.%${search}%`);
    
    // Apply hierarchy filter for non-admin users
    if (!isAdmin && downlineIds.length > 0) {
      query = query.in('id', downlineIds);
    }

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
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
      _debug: { isAdmin, userId: user.id, role: user.role, downlineCount: downlineIds.length }
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
