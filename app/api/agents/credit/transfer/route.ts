/**
 * Agent Credit Transfer API
 * Master Admin tool for instant credit distribution
 * Works with customers table (agents are stored in customers with agent_level)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { agentId, type, amount, note } = body;

    if (!agentId || !type || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, type, amount' },
        { status: 400 }
      );
    }

    if (!['add', 'deduct', 'clear_debt'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "add", "deduct", or "clear_debt"' },
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

    // Get current agent data from customers table
    const { data: agent, error: agentError } = await supabase
      .from('customers')
      .select('id, name, phone, credit_balance, is_active, agent_level, outstanding_balance')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check if agent is active
    if (!agent.is_active) {
      return NextResponse.json(
        { error: 'Agent is inactive' },
        { status: 400 }
      );
    }

    const currentBalance = agent.credit_balance || 0;
    const currentOutstanding = agent.outstanding_balance || 0;
    let newBalance = currentBalance;
    let newOutstanding = currentOutstanding;

    // Calculate new balance based on type
    if (type === 'add') {
      newBalance = currentBalance + transferAmount;
    } else if (type === 'deduct') {
      newBalance = currentBalance - transferAmount;
      // Check if deduction would exceed available balance
      if (newBalance < 0) {
        return NextResponse.json(
          { error: 'Insufficient credit balance' },
          { status: 400 }
        );
      }
    } else if (type === 'clear_debt') {
      newOutstanding = Math.max(0, currentOutstanding - transferAmount);
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (type === 'clear_debt') {
      updateData.outstanding_balance = newOutstanding;
    } else {
      updateData.credit_balance = newBalance;
    }

    // Update agent/customer credit balance
    const { error: updateError } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', agentId);

    if (updateError) {
      throw updateError;
    }

    // Record the transaction in credit_transactions
    const transactionData = {
      customer_id: agentId,
      type: type === 'add' ? 'credit_add' : type === 'deduct' ? 'credit_deduct' : 'clear_debt',
      amount: transferAmount,
      balance_before: type === 'clear_debt' ? currentOutstanding : currentBalance,
      balance_after: type === 'clear_debt' ? newOutstanding : newBalance,
      note: note || `Credit ${type === 'add' ? 'added' : type === 'deduct' ? 'deducted' : 'debt cleared'} by Admin`,
      created_at: new Date().toISOString(),
    };

    // Try to insert into credit_transactions
    await supabase.from('credit_transactions').insert(transactionData);

    return NextResponse.json({
      success: true,
      message: `Successfully ${type === 'add' ? 'added' : type === 'deduct' ? 'deducted' : 'cleared debt'} ${transferAmount.toLocaleString()} credit`,
      data: {
        agentId,
        agentName: agent.name,
        previousBalance: type === 'clear_debt' ? currentOutstanding : currentBalance,
        newBalance: type === 'clear_debt' ? newOutstanding : newBalance,
        amount: transferAmount,
        type,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process credit transfer' },
      { status: 500 }
    );
  }
}

// GET - Get credit history for an agent
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing agentId parameter' },
        { status: 400 }
      );
    }

    const { data: transactions, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('customer_id', agentId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ transactions: [] });
    }

    return NextResponse.json({ transactions: transactions || [] });
  } catch {
    return NextResponse.json({ transactions: [] });
  }
}
