import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get all agents with their network info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parent_id');
    
    const supabase = await createClient();
    
    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        role,
        is_unlimited_credit,
        credit_balance,
        parent_id,
        hierarchy_level,
        created_at,
        agent_settings (
          id,
          agent_share_percent,
          parent_share_percent,
          max_accept_limit,
          is_active
        )
      `)
      .in('role', ['admin', 'agent', 'partner'])
      .order('hierarchy_level', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (parentId) {
      query = query.eq('parent_id', parentId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[v0] Agent network GET error:', error);
      return NextResponse.json([]);
    }
    
    // Get stats for each agent
    const agentsWithStats = await Promise.all((data || []).map(async (agent) => {
      // Count customers under this agent
      const { count: customerCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', agent.id);
      
      // Count entries by this agent
      const { count: entryCount } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agent.id);
      
      // Sum total amount
      const { data: sumData } = await supabase
        .from('entries')
        .select('amount')
        .eq('agent_id', agent.id);
      
      const totalAmount = sumData?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      
      // Count sub-agents
      const { count: subAgentCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', agent.id);
      
      return {
        ...agent,
        settings: agent.agent_settings?.[0] || null,
        stats: {
          customerCount: customerCount || 0,
          entryCount: entryCount || 0,
          totalAmount,
          subAgentCount: subAgentCount || 0,
        },
      };
    }));
    
    return NextResponse.json(agentsWithStats);
  } catch (err) {
    console.error('[v0] Agent network GET exception:', err);
    return NextResponse.json([]);
  }
}

// POST - Create or update agent settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, agent_share_percent, parent_share_percent, max_accept_limit, is_active } = body;
    
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    
    // Validate percentages
    const agentPercent = parseFloat(agent_share_percent) || 100;
    const parentPercent = parseFloat(parent_share_percent) || 0;
    
    if (agentPercent + parentPercent !== 100) {
      return NextResponse.json({ error: 'Share percentages must total 100%' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    // Upsert agent settings
    const { data, error } = await supabase
      .from('agent_settings')
      .upsert({
        user_id,
        agent_share_percent: agentPercent,
        parent_share_percent: parentPercent,
        max_accept_limit: max_accept_limit || null,
        is_active: is_active !== false,
      }, { onConflict: 'user_id' })
      .select()
      .single();
    
    if (error) {
      console.error('[v0] Agent settings upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Agent network POST exception:', err);
    return NextResponse.json({ error: 'Failed to save agent settings' }, { status: 500 });
  }
}

// PUT - Update user parent relationship
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { user_id, parent_id, hierarchy_level } = body;
    
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    // Update user's parent
    const { data, error } = await supabase
      .from('users')
      .update({
        parent_id: parent_id || null,
        hierarchy_level: hierarchy_level || 0,
      })
      .eq('id', user_id)
      .select()
      .single();
    
    if (error) {
      console.error('[v0] Agent parent update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Agent network PUT exception:', err);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}
