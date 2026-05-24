import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// API สำหรับดึงรายการเอเย่นต์จาก agents table (ตามโครงสร้าง Multi-Level)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const systemType = searchParams.get('system_type'); // manual_key, auto
    const status = searchParams.get('status'); // active, inactive

    // ดึงเอเย่นต์ทั้งหมด
    let query = supabase
      .from('agents')
      .select('*')
      .not('name', 'is', null);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,code.ilike.%${search}%`);
    }

    if (systemType) {
      query = query.eq('system_type', systemType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: agents, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // สร้าง tree structure
    const agentMap = new Map();
    const rootAgents: any[] = [];

    // First pass: create map
    (agents || []).forEach(agent => {
      agentMap.set(agent.id, {
        ...agent,
        display_name: agent.name,
        children: [],
      });
    });

    // Second pass: build tree
    (agents || []).forEach(agent => {
      const node = agentMap.get(agent.id);
      if (agent.parent_id && agentMap.has(agent.parent_id)) {
        agentMap.get(agent.parent_id).children.push(node);
      } else {
        rootAgents.push(node);
      }
    });

    // คำนวณ stats
    const allAgents = agents || [];
    const stats = {
      totalAgents: allAgents.length,
      autoOnly: allAgents.filter(a => a.system_type === 'auto').length,
      keyOnly: allAgents.filter(a => a.system_type === 'manual_key').length,
      both: allAgents.filter(a => a.system_type === 'both').length,
      active: allAgents.filter(a => a.status === 'active').length,
      totalLevels: Math.max(...allAgents.map(a => a.level || 1), 0),
    };

    return NextResponse.json({
      tree: rootAgents,
      agents: allAgents.map(a => ({
        ...a,
        display_name: a.name,
      })),
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
