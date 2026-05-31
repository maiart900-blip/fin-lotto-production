/**
 * Agent-to-SubAgent Credit Transfer API
 * Allows agents to distribute credit to their sub-agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit-logger';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Auth guard - require authenticated user
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { subAgentId, type, amount, note } = body;

    // Get current user info
    const cookieStore = await cookies();
    const adminId = cookieStore.get('admin_id')?.value;
    const adminRole = cookieStore.get('admin_role')?.value;

    // Only agents can use this endpoint
    if (adminRole !== 'agent' && adminRole !== 'agent_key') {
      return NextResponse.json(
        { error: 'Only agents can transfer credit to sub-agents' },
        { status: 403 }
      );
    }

    if (!subAgentId || !type || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: subAgentId, type, amount' },
        { status: 400 }
      );
    }

    if (!['add', 'deduct'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "add" or "deduct"' },
        { status: 400 }
      );
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Find current agent's record
    let currentAgentId: string | null = null;
    
    if (adminId) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('source, username')
        .eq('id', adminId)
        .maybeSingle();

      if (userRecord?.source?.startsWith('agent_')) {
        currentAgentId = userRecord.source.replace('agent_', '');
      } else if (userRecord?.username) {
        const { data: agentRecord } = await supabase
          .from('agents')
          .select('id')
          .eq('code', userRecord.username)
          .maybeSingle();
        if (agentRecord) {
          currentAgentId = agentRecord.id;
        }
      }
    }

    if (!currentAgentId) {
      return NextResponse.json(
        { error: 'Could not identify current agent' },
        { status: 400 }
      );
    }

    // Get current agent's credit balance
    const { data: currentAgent, error: agentError } = await supabase
      .from('agents')
      .select('id, code, name, credit_balance, credit_limit')
      .eq('id', currentAgentId)
      .single();

    if (agentError || !currentAgent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Verify sub-agent belongs to current agent
    const { data: subAgent, error: subAgentError } = await supabase
      .from('agents')
      .select('id, code, name, credit_balance, parent_agent_id, is_active')
      .eq('id', subAgentId)
      .single();

    if (subAgentError || !subAgent) {
      return NextResponse.json(
        { error: 'Sub-agent not found' },
        { status: 404 }
      );
    }

    // Check if sub-agent belongs to current agent
    if (subAgent.parent_agent_id !== currentAgentId) {
      return NextResponse.json(
        { error: 'You can only transfer credit to your own sub-agents' },
        { status: 403 }
      );
    }

    if (!subAgent.is_active) {
      return NextResponse.json(
        { error: 'Sub-agent is inactive' },
        { status: 400 }
      );
    }

    const agentCurrentBalance = currentAgent.credit_balance || 0;
    const subAgentCurrentBalance = subAgent.credit_balance || 0;
    
    let newAgentBalance = agentCurrentBalance;
    let newSubAgentBalance = subAgentCurrentBalance;

    // Calculate new balances
    if (type === 'add') {
      // Deduct from agent, add to sub-agent
      if (agentCurrentBalance < transferAmount) {
        return NextResponse.json(
          { error: 'Insufficient credit balance' },
          { status: 400 }
        );
      }
      newAgentBalance = agentCurrentBalance - transferAmount;
      newSubAgentBalance = subAgentCurrentBalance + transferAmount;
    } else if (type === 'deduct') {
      // Take back from sub-agent to agent
      if (subAgentCurrentBalance < transferAmount) {
        return NextResponse.json(
          { error: 'Sub-agent has insufficient credit balance' },
          { status: 400 }
        );
      }
      newAgentBalance = agentCurrentBalance + transferAmount;
      newSubAgentBalance = subAgentCurrentBalance - transferAmount;
    }

    // Update agent's credit balance
    const { error: updateAgentError } = await supabase
      .from('agents')
      .update({ 
        credit_balance: newAgentBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentAgentId);

    if (updateAgentError) {
      throw updateAgentError;
    }

    // Update sub-agent's credit balance
    const { error: updateSubAgentError } = await supabase
      .from('agents')
      .update({ 
        credit_balance: newSubAgentBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', subAgentId);

    if (updateSubAgentError) {
      // Rollback agent balance
      await supabase
        .from('agents')
        .update({ credit_balance: agentCurrentBalance })
        .eq('id', currentAgentId);
      throw updateSubAgentError;
    }

    // Record transaction for sub-agent
    await supabase.from('credit_transactions').insert({
      customer_id: subAgentId,
      type: type === 'add' ? 'credit_receive' : 'credit_return',
      amount: transferAmount,
      balance_before: subAgentCurrentBalance,
      balance_after: newSubAgentBalance,
      note: note || `Credit ${type === 'add' ? 'received from' : 'returned to'} ${currentAgent.name}`,
      created_at: new Date().toISOString(),
    });

    // Record transaction for agent
    await supabase.from('credit_transactions').insert({
      customer_id: currentAgentId,
      type: type === 'add' ? 'credit_distribute' : 'credit_recall',
      amount: transferAmount,
      balance_before: agentCurrentBalance,
      balance_after: newAgentBalance,
      note: note || `Credit ${type === 'add' ? 'distributed to' : 'recalled from'} ${subAgent.name}`,
      created_at: new Date().toISOString(),
    });

    // Audit log
    await logAudit({
      action: `agent_credit_${type}`,
      actor_id: adminId || currentAgentId,
      actor_type: 'agent',
      target_type: 'agent',
      target_id: subAgentId,
      details: {
        type,
        amount: transferAmount,
        from_agent: currentAgent.code,
        to_agent: subAgent.code,
        agent_balance_before: agentCurrentBalance,
        agent_balance_after: newAgentBalance,
        sub_agent_balance_before: subAgentCurrentBalance,
        sub_agent_balance_after: newSubAgentBalance,
        note,
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Successfully ${type === 'add' ? 'transferred' : 'recalled'} ${transferAmount.toLocaleString()} credit`,
      data: {
        agent: {
          id: currentAgentId,
          name: currentAgent.name,
          previousBalance: agentCurrentBalance,
          newBalance: newAgentBalance,
        },
        subAgent: {
          id: subAgentId,
          name: subAgent.name,
          previousBalance: subAgentCurrentBalance,
          newBalance: newSubAgentBalance,
        },
        amount: transferAmount,
        type,
      },
    });
  } catch (error) {
    console.error('[v0] Agent credit transfer error:', error);
    return NextResponse.json(
      { error: 'Failed to process credit transfer' },
      { status: 500 }
    );
  }
}

// GET - Get agent's sub-agents for credit transfer
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const cookieStore = await cookies();
    const adminId = cookieStore.get('admin_id')?.value;
    const adminRole = cookieStore.get('admin_role')?.value;

    // Only agents can use this endpoint
    if (adminRole !== 'agent' && adminRole !== 'agent_key') {
      return NextResponse.json(
        { error: 'Only agents can access this endpoint' },
        { status: 403 }
      );
    }

    // Find current agent's ID
    let currentAgentId: string | null = null;
    
    if (adminId) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('source, username')
        .eq('id', adminId)
        .maybeSingle();

      if (userRecord?.source?.startsWith('agent_')) {
        currentAgentId = userRecord.source.replace('agent_', '');
      } else if (userRecord?.username) {
        const { data: agentRecord } = await supabase
          .from('agents')
          .select('id')
          .eq('code', userRecord.username)
          .maybeSingle();
        if (agentRecord) {
          currentAgentId = agentRecord.id;
        }
      }
    }

    if (!currentAgentId) {
      return NextResponse.json(
        { error: 'Could not identify current agent' },
        { status: 400 }
      );
    }

    // Get current agent's info
    const { data: currentAgent } = await supabase
      .from('agents')
      .select('id, code, name, credit_balance, credit_limit')
      .eq('id', currentAgentId)
      .single();

    // Get sub-agents
    const { data: subAgents, error } = await supabase
      .from('agents')
      .select('id, code, name, credit_balance, is_active, level, created_at')
      .eq('parent_agent_id', currentAgentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      currentAgent: {
        id: currentAgent?.id,
        code: currentAgent?.code,
        name: currentAgent?.name,
        creditBalance: currentAgent?.credit_balance || 0,
        creditLimit: currentAgent?.credit_limit || 0,
      },
      subAgents: subAgents || [],
    });
  } catch (error) {
    console.error('[v0] Get sub-agents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-agents' },
      { status: 500 }
    );
  }
}
