import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auditLogger } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { agent_id, action, amount, note } = await request.json();

    if (!agent_id || !action || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['add', 'deduct'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "add" or "deduct"' },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Get agent (from customers table with is_agent = true)
    const { data: agent, error: agentError } = await supabase
      .from('customers')
      .select('id, name, username, credit_balance, is_active')
      .eq('id', agent_id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const currentBalance = agent.credit_balance || 0;

    // Check if deducting more than available
    if (action === 'deduct' && numAmount > currentBalance) {
      return NextResponse.json(
        {
          error: `ไม่สามารถตัดเครดิตได้ เครดิตคงเหลือ ฿${currentBalance.toLocaleString()} น้อยกว่าจำนวนที่ต้องการตัด ฿${numAmount.toLocaleString()}`,
        },
        { status: 400 }
      );
    }

    // Calculate new balance
    const newBalance =
      action === 'add'
        ? currentBalance + numAmount
        : currentBalance - numAmount;

    // Update balance using optimistic locking
    const { data: updateResult, error: updateError } = await supabase
      .from('customers')
      .update({
        credit_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id)
      .eq('credit_balance', currentBalance)
      .select()
      .single();

    if (updateError || !updateResult) {
      // Retry read for race-condition response
      const { data: freshAgent } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', agent_id)
        .single();

      return NextResponse.json(
        {
          error: 'เกิดข้อผิดพลาดในการอัปเดตเครดิต กรุณาลองใหม่อีกครั้ง',
          currentBalance: freshAgent?.credit_balance,
        },
        { status: 409 }
      );
    }

    // Log the credit transaction
    try {
      await supabase.from('credit_transactions').insert({
        customer_id: agent_id,
        type: action === 'add' ? 'agent_credit_add' : 'agent_credit_deduct',
        amount: action === 'add' ? numAmount : -numAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        description:
          note ||
          `${action === 'add' ? 'เติม' : 'ตัด'}เครดิตโดยผู้ดูแลระบบ`,
        status: 'completed',
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('[Credit] Failed to log transaction:', logError);
    }

    // Audit log
    // Use the generic logger here because agent_credit_add / agent_credit_deduct
    // are custom audit actions and do not match logFinancial()'s fixed signature.
    await auditLogger.log({
      userId: 'system',
      action: action === 'add' ? 'agent_credit_add' : 'agent_credit_deduct',
      actorType: 'admin',
      tableName: 'customers',
      recordId: agent_id,
      description: `${action === 'add' ? 'เติม' : 'ตัด'}เครดิตเอเย่นต์ ${
        agent.name || agent.username
      } จำนวน ฿${numAmount.toLocaleString()}`,
      oldData: {
        credit_balance: currentBalance,
      },
      newData: {
        credit_balance: newBalance,
        amount: numAmount,
        action,
      },
      metadata: {
        agent_id,
        agent_name: agent.name,
        agent_username: agent.username,
        action,
        amount: numAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        note: note || null,
      },
    });

    return NextResponse.json({
      success: true,
      agent_id,
      action,
      amount: numAmount,
      balance_before: currentBalance,
      balance_after: newBalance,
    });
  } catch (error) {
    console.error('[Credit API] Error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}