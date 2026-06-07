import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Agent {
  id: string;
  code: string;
  name: string;
  level: number;
  parent_id: string | null;
  credit_limit: number;
  credit_used: number;
  commission_rate: number;
  position_taking: number;
  is_active: boolean;
  member_count?: number;
  children?: Agent[];
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all agents
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .order('level', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching agents:', error);
      return NextResponse.json({ agents: [] });
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json({ agents: [] });
    }

    // Build tree structure
    const agentMap = new Map<string, Agent>();
    const rootAgents: Agent[] = [];

    // First pass: create map of all agents
    for (const agent of agents) {
      agentMap.set(agent.id, {
        ...agent,
        children: [],
      });
    }

    // Second pass: build tree
    for (const agent of agents) {
      const agentNode = agentMap.get(agent.id)!;
      
      if (agent.parent_id && agentMap.has(agent.parent_id)) {
        const parent = agentMap.get(agent.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(agentNode);
      } else {
        // Root level agent (no parent or parent not found)
        rootAgents.push(agentNode);
      }
    }

    // Fetch member counts for each agent
    const { data: memberCounts } = await supabase
      .from('customers')
      .select('agent_id')
      .not('agent_id', 'is', null);

    if (memberCounts) {
      const countMap = new Map<string, number>();
      for (const mc of memberCounts) {
        if (mc.agent_id) {
          countMap.set(mc.agent_id, (countMap.get(mc.agent_id) || 0) + 1);
        }
      }
      
      // Apply member counts to agents
      for (const [agentId, count] of countMap) {
        const agent = agentMap.get(agentId);
        if (agent) {
          agent.member_count = count;
        }
      }
    }

    return NextResponse.json({
      agents: rootAgents,
      total: agents.length,
    });
  } catch (error) {
    console.error('Error in agents/tree API:', error);
    return NextResponse.json({ agents: [], error: 'Internal server error' }, { status: 500 });
  }
}
