import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

/**
 * Manual Key Agents API
 * - Agent Key จะถูกเก็บใน agents table (ไม่ใช่ customers)
 * - ใช้ code เป็น username สำหรับ login
 * - password เก็บใน password column (hashed)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';

    // Get agents from agents table with system_type = 'manual_key' or enable_manual_key = true
    let query = supabase
      .from('agents')
      .select(`
        id,
        code,
        name,
        phone,
        status,
        level,
        credit_balance,
        credit_limit,
        commission_rate,
        share_percent,
        parent_id,
        parent_agent_id,
        system_type,
        enable_manual_key,
        enable_auto,
        created_at
      `)
      .or('system_type.eq.manual_key,enable_manual_key.eq.true')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    
    if (status === 'active') {
      query = query.eq('status', 'active');
    } else if (status === 'suspended' || status === 'inactive') {
      query = query.neq('status', 'active');
    }

    const { data: agents, error } = await query;
    if (error) throw error;

    const agentIds = agents?.map(a => a.id) || [];
    
    // Get downline counts (sub-agents)
    const { data: downlineCounts } = await supabase
      .from('agents')
      .select('parent_id')
      .in('parent_id', agentIds);

    // Get customer/member counts
    const { data: memberCounts } = await supabase
      .from('customers')
      .select('agent_id')
      .in('agent_id', agentIds);

    // Get sales from entries
    const { data: salesData } = await supabase
      .from('entries')
      .select('agent_id, amount')
      .in('agent_id', agentIds);

    const mappedAgents = agents?.map(agent => {
      const downlines = downlineCounts?.filter(d => d.parent_id === agent.id).length || 0;
      const members = memberCounts?.filter(m => m.agent_id === agent.id).length || 0;
      const sales = salesData?.filter(s => s.agent_id === agent.id).reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

      return {
        id: agent.id,
        username: agent.code, // code is used as username
        display_name: agent.name,
        phone: agent.phone,
        status: agent.status || 'active',
        credit_balance: agent.credit_balance || 0,
        credit_limit: agent.credit_limit || 0,
        commission_percent: agent.commission_rate || 5,
        share_percent: agent.share_percent || 70,
        downline_count: downlines,
        member_count: members,
        total_sales: sales,
        total_commission: 0,
        parent_user_id: agent.parent_id || agent.parent_agent_id,
        system_type: agent.system_type,
        enable_manual_key: agent.enable_manual_key,
        enable_auto: agent.enable_auto,
        created_at: agent.created_at,
      };
    }) || [];

    const stats = {
      total: mappedAgents.length,
      active: mappedAgents.filter(a => a.status === 'active').length,
      suspended: mappedAgents.filter(a => a.status !== 'active').length,
      totalSales: mappedAgents.reduce((sum, a) => sum + a.total_sales, 0),
      totalCommission: mappedAgents.reduce((sum, a) => sum + a.total_commission, 0),
    };

    return NextResponse.json({ agents: mappedAgents, stats });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'create') {
      const { 
        username, 
        display_name, 
        password, 
        phone, 
        commission_percent, 
        credit_limit, 
        share_percent, 
        parent_agent_id,
        system_type = 'manual_key',
        enable_manual_key = true,
        enable_auto = false,
      } = data;

      // Check if username (code) exists in agents
      const { data: existingAgent } = await supabase
        .from('agents')
        .select('id')
        .eq('code', username)
        .maybeSingle();

      if (existingAgent) {
        return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }, { status: 400 });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Get parent level
      let agentLevel = 1;
      if (parent_agent_id) {
        const { data: parent } = await supabase
          .from('agents')
          .select('level')
          .eq('id', parent_agent_id)
          .single();
        agentLevel = (parent?.level || 0) + 1;
      }

      // Create agent in agents table
      const { data: newAgent, error: insertError } = await supabase
        .from('agents')
        .insert({
          code: username,
          name: display_name,
          password: hashedPassword,
          phone: phone || null,
          level: agentLevel,
          status: 'active',
          commission_rate: commission_percent || 5,
          credit_limit: credit_limit || 100000,
          credit_balance: 0,
          share_percent: share_percent || 70,
          parent_id: parent_agent_id || null,
          parent_agent_id: parent_agent_id || null,
          system_type: system_type,
          enable_manual_key: enable_manual_key,
          enable_auto: enable_auto,
          role: 'agent_key',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return NextResponse.json({ 
        success: true, 
        agent: {
          id: newAgent.id,
          username: newAgent.code,
          display_name: newAgent.name,
          status: newAgent.status,
          system_type: newAgent.system_type,
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
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
      const { display_name, phone, commission_percent, credit_limit, share_percent } = data;

      const { error } = await supabase
        .from('agents')
        .update({ 
          name: display_name, 
          phone: phone || null,
          commission_rate: commission_percent,
          credit_limit: credit_limit,
          share_percent: share_percent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_status') {
      const { status } = data;

      const { error } = await supabase
        .from('agents')
        .update({ 
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'reset_password') {
      const { password } = data;
      const hashedPassword = await bcrypt.hash(password, 10);

      const { error } = await supabase
        .from('agents')
        .update({ 
          password: hashedPassword,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
