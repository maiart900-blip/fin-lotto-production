import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

// Auto agents are stored in customers table with agent_level set
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';

    // Get agents from customers table with agent_level = 'agent' only
    let query = supabase
      .from('customers')
      .select(`
        id,
        username,
        name,
        phone,
        is_active,
        agent_level,
        credit_balance,
        commission_rate,
        upline_id,
        created_at
      `)
      .eq('agent_level', 'agent')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'suspended') {
      query = query.eq('is_active', false);
    }

    const { data: agents, error } = await query;
    if (error) throw error;

    const agentIds = agents?.map(a => a.id) || [];
    
    // Get downline counts (agents under this agent)
    const { data: downlineCounts } = await supabase
      .from('customers')
      .select('upline_id')
      .in('upline_id', agentIds)
      .not('agent_level', 'is', null);

    // Get member counts (customers under this agent)
    const { data: memberCounts } = await supabase
      .from('customers')
      .select('upline_id')
      .in('upline_id', agentIds)
      .is('agent_level', null);

    // Get sales from entries
    const { data: salesData } = await supabase
      .from('entries')
      .select('customer_id, amount')
      .in('customer_id', agentIds);

    const mappedAgents = agents?.map(agent => {
      const downlines = downlineCounts?.filter(d => d.upline_id === agent.id).length || 0;
      const members = memberCounts?.filter(m => m.upline_id === agent.id).length || 0;
      const sales = salesData?.filter(s => s.customer_id === agent.id).reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

      return {
        id: agent.id,
        username: agent.username,
        display_name: agent.name,
        phone: agent.phone,
        status: agent.is_active ? 'active' : 'suspended',
        credit_balance: agent.credit_balance || 0,
        commission_percent: agent.commission_rate || 5,
        share_percent: 0,
        credit_limit: 10000,
        downline_count: downlines,
        member_count: members,
        total_sales: sales,
        total_commission: 0,
        parent_user_id: agent.upline_id,
        created_at: agent.created_at,
      };
    }) || [];

    const stats = {
      total: mappedAgents.length,
      active: mappedAgents.filter(a => a.status === 'active').length,
      suspended: mappedAgents.filter(a => a.status === 'suspended').length,
      totalSales: mappedAgents.reduce((sum, a) => sum + a.total_sales, 0),
      totalCommission: mappedAgents.reduce((sum, a) => sum + a.total_commission, 0),
    };

    return NextResponse.json({ agents: mappedAgents, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create') {
      const { username, display_name, password, phone, commission_percent, credit_limit, share_percent, parent_agent_id } = data;

      // Check if username exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }, { status: 400 });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create agent in customers table
      const { data: newAgent, error: insertError } = await supabase
        .from('customers')
        .insert({
          username,
          name: display_name,
          password_hash: hashedPassword,
          phone,
          agent_level: 'agent',
          is_active: true,
          commission_rate: commission_percent || 5,
          credit_balance: credit_limit || 10000,
          upline_id: parent_agent_id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return NextResponse.json({ 
        success: true, 
        agent: {
          ...newAgent,
          display_name: newAgent.name,
          status: 'active',
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing agent ID' }, { status: 400 });
    }

    if (action === 'update') {
      const { display_name, phone, commission_percent, credit_limit } = data;

      const { error } = await supabase
        .from('customers')
        .update({ 
          name: display_name, 
          phone,
          commission_rate: commission_percent,
          credit_balance: credit_limit,
        })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_status') {
      const { status } = data;
      const isActive = status === 'active';

      const { error } = await supabase
        .from('customers')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'reset_password') {
      const { password } = data;
      const hashedPassword = await bcrypt.hash(password, 10);

      const { error } = await supabase
        .from('customers')
        .update({ password_hash: hashedPassword })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_2fa') {
      const { two_factor_enabled } = data;

      const { error } = await supabase
        .from('customers')
        .update({ two_factor_enabled: two_factor_enabled })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
