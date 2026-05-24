import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface AgentNode {
  id: string;
  username: string;
  display_name: string;
  status: string;
  commission_percent: number;
  member_count: number;
  total_sales: number;
  children: AgentNode[];
  level: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Get agents from customers table
    let query = supabase
      .from('customers')
      .select('id, username, name, is_active, upline_id, commission_rate, created_at')
      .not('agent_level', 'is', null)
      .order('created_at', { ascending: true });

    if (search) {
      query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data: agents, error } = await query;
    if (error) throw error;

    const agentIds = agents?.map(a => a.id) || [];

    // Get member counts
    const { data: members } = await supabase
      .from('customers')
      .select('upline_id')
      .in('upline_id', agentIds)
      .is('agent_level', null);

    // Get sales data
    const { data: sales } = await supabase
      .from('entries')
      .select('customer_id, amount')
      .in('customer_id', agentIds);

    // Build tree structure
    const agentMap = new Map<string, AgentNode>();
    const rootAgents: AgentNode[] = [];

    agents?.forEach(agent => {
      const memberCount = members?.filter(m => m.upline_id === agent.id).length || 0;
      const totalSales = sales?.filter(s => s.customer_id === agent.id).reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

      agentMap.set(agent.id, {
        id: agent.id,
        username: agent.username || '',
        display_name: agent.name || '',
        status: agent.is_active ? 'active' : 'suspended',
        commission_percent: agent.commission_rate || 5,
        member_count: memberCount,
        total_sales: totalSales,
        children: [],
        level: 1,
      });
    });

    agents?.forEach(agent => {
      const node = agentMap.get(agent.id);
      if (!node) return;

      if (agent.upline_id && agentMap.has(agent.upline_id)) {
        const parent = agentMap.get(agent.upline_id)!;
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        rootAgents.push(node);
      }
    });

    const totalMembers = members?.length || 0;
    let maxLevel = 1;
    const calculateMaxLevel = (nodes: AgentNode[]) => {
      nodes.forEach(node => {
        if (node.level > maxLevel) maxLevel = node.level;
        if (node.children.length > 0) calculateMaxLevel(node.children);
      });
    };
    calculateMaxLevel(rootAgents);

    const flatAgents = agents?.map(a => ({
      id: a.id,
      username: a.username || '',
      display_name: a.name || '',
    })) || [];

    return NextResponse.json({
      tree: rootAgents,
      agents: flatAgents,
      stats: {
        totalAgents: agents?.length || 0,
        totalMembers,
        totalLevels: maxLevel,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, agentId, targetAgentId } = body;

    if (action === 'move') {
      const newUplineId = targetAgentId === 'root' ? null : targetAgentId;

      const { error } = await supabase
        .from('customers')
        .update({ upline_id: newUplineId })
        .eq('id', agentId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
