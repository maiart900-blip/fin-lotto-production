import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get forwarding entries
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    const supabase = await createClient();
    
    let query = supabase
      .from('forwarding_entries')
      .select(`
        *,
        agent:agent_id (id, username, display_name),
        parent:parent_id (id, username, display_name),
        customer:customer_id (id, name, phone),
        lottery:lottery_id (id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (agentId) {
      query = query.or(`agent_id.eq.${agentId},parent_id.eq.${agentId}`);
    }
    
    if (status) {
      query = query.eq('forwarding_status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[v0] Forwarding GET error:', error);
      return NextResponse.json([]);
    }
    
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[v0] Forwarding GET exception:', err);
    return NextResponse.json([]);
  }
}

// POST - Create forwarding entry when a bet is placed
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      entry_id,
      customer_id,
      agent_id,
      lottery_id,
      number,
      entry_type,
      total_amount,
    } = body;
    
    if (!entry_id || !agent_id || !total_amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    // Get agent and their settings
    const { data: agent } = await supabase
      .from('users')
      .select(`
        id,
        parent_id,
        agent_settings (
          agent_share_percent,
          parent_share_percent
        )
      `)
      .eq('id', agent_id)
      .single();
    
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    
    const settings = agent.agent_settings?.[0] || { agent_share_percent: 100, parent_share_percent: 0 };
    const agentSharePercent = settings.agent_share_percent || 100;
    const parentSharePercent = settings.parent_share_percent || 0;
    
    const agentShareAmount = (total_amount * agentSharePercent) / 100;
    const parentShareAmount = (total_amount * parentSharePercent) / 100;
    
    // Create forwarding entry
    const { data, error } = await supabase
      .from('forwarding_entries')
      .insert({
        entry_id,
        customer_id,
        agent_id,
        parent_id: agent.parent_id,
        lottery_id,
        number,
        entry_type,
        total_amount,
        agent_share_percent: agentSharePercent,
        parent_share_percent: parentSharePercent,
        agent_share_amount: agentShareAmount,
        parent_share_amount: parentShareAmount,
        forwarding_status: 'pending',
      })
      .select()
      .single();
    
    if (error) {
      console.error('[v0] Forwarding create error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Update entry with share info
    await supabase
      .from('entries')
      .update({
        agent_id,
        parent_agent_id: agent.parent_id,
        agent_share_amount: agentShareAmount,
        parent_share_amount: parentShareAmount,
        agent_share_percent: agentSharePercent,
        parent_share_percent: parentSharePercent,
      })
      .eq('id', entry_id);
    
    // Create commission transactions
    if (agentShareAmount > 0) {
      await supabase.from('commission_transactions').insert({
        user_id: agent_id,
        source_entry_id: entry_id,
        amount: agentShareAmount,
        percent: agentSharePercent,
        transaction_type: 'agent_share',
        note: `ส่วนแบ่ง ${agentSharePercent}% จากโพย #${entry_id.slice(0, 8)}`,
      });
    }
    
    if (parentShareAmount > 0 && agent.parent_id) {
      await supabase.from('commission_transactions').insert({
        user_id: agent.parent_id,
        source_entry_id: entry_id,
        amount: parentShareAmount,
        percent: parentSharePercent,
        transaction_type: 'parent_share',
        note: `ส่วนแบ่งจากลูกข่าย ${parentSharePercent}% โพย #${entry_id.slice(0, 8)}`,
      });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Forwarding POST exception:', err);
    return NextResponse.json({ error: 'Failed to create forwarding entry' }, { status: 500 });
  }
}

// PUT - Update forwarding status
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, forwarding_status } = body;
    
    if (!id || !forwarding_status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('forwarding_entries')
      .update({ forwarding_status })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[v0] Forwarding update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Forwarding PUT exception:', err);
    return NextResponse.json({ error: 'Failed to update forwarding entry' }, { status: 500 });
  }
}
