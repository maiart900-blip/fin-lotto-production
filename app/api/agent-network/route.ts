import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

/**
 * Agent Network API - AGENT OR HIGHER
 * Manages agent hierarchy and share percentages
 * Queries from 'agents' table (not 'users' table)
 */
export async function GET(request: Request) {
  try {
    // Auth guard
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parent_id');
    
    const supabase = await createClient();
    
    // Query from agents table (where actual agents are stored)
    let query = supabase
      .from('agents')
      .select(`
        id,
        code,
        name,
        role,
        status,
        parent_agent_id,
        hierarchy_level,
        share_percent,
        commission_rate,
        max_bet_per_number,
        max_bet_per_round,
        credit_limit,
        credit_balance,
        created_at
      `)
      .order('hierarchy_level', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (parentId) {
      query = query.eq('parent_agent_id', parentId);
    }
    
    const { data: agents, error } = await query;
    
    if (error) {
      console.error('[v0] Agent network GET error:', error);
      return NextResponse.json([]);
    }
    
    // Also get super_admin users to include in the network view
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id, username, display_name, role, hierarchy_level, parent_id, created_at')
      .eq('role', 'super_admin');
    
    // Get stats for each agent
    const agentsWithStats = await Promise.all((agents || []).map(async (agent) => {
      // Count customers under this agent
      const { count: customerCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agent.id);
      
      // Count bets by this agent's customers
      const { count: entryCount } = await supabase
        .from('bets')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agent.id);
      
      // Sum total amount from bets
      const { data: betData } = await supabase
        .from('bets')
        .select('total_amount')
        .eq('agent_id', agent.id);
      
      const totalAmount = betData?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
      
      // Count sub-agents
      const { count: subAgentCount } = await supabase
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('parent_agent_id', agent.id);
      
      // Map to frontend expected structure
      return {
        id: agent.id,
        username: agent.code,
        display_name: agent.name || agent.code,
        role: agent.role || 'agent',
        is_unlimited_credit: false,
        credit_balance: agent.credit_balance || 0,
        parent_id: agent.parent_agent_id,
        hierarchy_level: agent.hierarchy_level || 1,
        created_at: agent.created_at,
        settings: {
          id: agent.id,
          agent_share_percent: agent.share_percent || 100,
          parent_share_percent: 100 - (agent.share_percent || 100),
          max_accept_limit: agent.max_bet_per_round || agent.max_bet_per_number,
          is_active: agent.status === 'active',
        },
        stats: {
          customerCount: customerCount || 0,
          entryCount: entryCount || 0,
          totalAmount,
          subAgentCount: subAgentCount || 0,
        },
      };
    }));
    
    // Add super admins at the top level
    const adminWithStats = (adminUsers || []).map(admin => ({
      id: admin.id,
      username: admin.username,
      display_name: admin.display_name || admin.username,
      role: admin.role,
      is_unlimited_credit: true,
      credit_balance: 0,
      parent_id: admin.parent_id,
      hierarchy_level: admin.hierarchy_level || 0,
      created_at: admin.created_at,
      settings: {
        id: admin.id,
        agent_share_percent: 100,
        parent_share_percent: 0,
        max_accept_limit: null,
        is_active: true,
      },
      stats: {
        customerCount: 0,
        entryCount: 0,
        totalAmount: 0,
        subAgentCount: agentsWithStats.filter(a => !a.parent_id).length,
      },
    }));
    
    return NextResponse.json([...adminWithStats, ...agentsWithStats]);
  } catch (err) {
    console.error('[v0] Agent network GET exception:', err);
    return NextResponse.json([]);
  }
}

// POST - Create or update agent settings
export async function POST(request: Request) {
  try {
    // Auth guard
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    
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
    // Auth guard
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    
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
