import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { getCustomerScopeForUser, applyCustomerScope } from '@/lib/customer-scope';

/**
 * API สำหรับจัดการลูกค้าคีย์หวย (Manual Key Customers)
 * - GET: ดึงรายการลูกค้าคีย์หวย (source_type = 'manual_key')
 * - POST: สร้างลูกค้าคีย์หวยใหม่
 *
 * SECURITY: Customer scope is enforced based on user's tenant_id and agent downline
 */

export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    // requireAgentOrHigher() returns { user: AuthenticatedUser }
    const session = authResult.user;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const search = searchParams.get('search') || '';

    // Get customer scope for current user
    const scope = await getCustomerScopeForUser({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });

    // Query customers with source_type = 'manual_key' only
    let query = supabase
      .from('customers')
      .select('*')
      .eq('source_type', 'manual_key')
      .order('created_at', { ascending: false });

    // SECURITY: Apply customer scope filters
    query = applyCustomerScope(query, scope);

    // Additional filter by agent_id (only if within user's scope)
    if (agentId) {
      if (
        scope.canAccessAll ||
        scope.isAdmin ||
        scope.agentIds.includes(agentId)
      ) {
        query = query.eq('agent_id', agentId);
      }
    }

    // Search
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching manual-key customers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      customers: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('GET manual-key customers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    // requireAgentOrHigher() returns { user: AuthenticatedUser }
    const session = authResult.user;

    const supabase = await createClient();
    const body = await request.json();

    const {
      name,
      phone,
      line_id,
      agent_id,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อลูกค้า' },
        { status: 400 }
      );
    }

    // SECURITY: Validate agent_id is in user's downline if specified
    const scope = await getCustomerScopeForUser({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });

    // Determine the agent_id to use
    let finalAgentId = agent_id;

    if (scope.isAgent) {
      // Agent can only create customers under their own downline
      if (agent_id && !scope.agentIds.includes(agent_id)) {
        return NextResponse.json(
          { error: 'ไม่สามารถสร้างลูกค้าให้เอเย่นต์อื่นได้' },
          { status: 403 }
        );
      }

      // If no agent_id specified, use the current user's id
      finalAgentId = agent_id || session.id;
    }

    // Create customer with source_type = 'manual_key'
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        name: name.trim(),
        phone: phone?.trim() || null,
        line_id: line_id?.trim() || null,
        source_type: 'manual_key',
        system_type: 'manual_key',
        agent_id: finalAgentId || null,
        parent_agent_id: finalAgentId || null,
        tenant_id: session.tenant_id || null,
        credit_balance: 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating manual-key customer:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: newCustomer,
      message: 'สร้างลูกค้าคีย์หวยสำเร็จ',
    });
  } catch (error) {
    console.error('POST manual-key customers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}