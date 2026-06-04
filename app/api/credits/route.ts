import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// GET - fetch credit transactions for a customer
export async function GET(request: NextRequest) {
  // SECURITY: Auth guard
  const authResult = await requireAgentOrHigher();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customer_id');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('credit_transactions')
    .select(`
      *,
      customer:customers(id, name),
      created_by_user:users!credit_transactions_created_by_fkey(id, display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[v0] Credits GET error:', error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json(data || []);
}

// POST - create a credit transaction (deposit/withdraw)
export async function POST(request: NextRequest) {
  // SECURITY: Auth guard - only agents or higher can modify credits
  const authResult = await requireAgentOrHigher();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const body = await request.json();
  const { customer_id, type, amount, note, created_by } = body;

  if (!customer_id || !type || !amount) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  if (!['deposit', 'withdraw', 'bonus', 'refund'].includes(type)) {
    return NextResponse.json(
      { error: 'Invalid transaction type' },
      { status: 400 }
    );
  }

  // Get current balance
  // WARNING: Race condition risk - read-then-write pattern
  // TODO: Convert to atomic transaction using Postgres RPC with FOR UPDATE lock
  // For production, create function: process_credit_transaction(customer_id, type, amount)
  const { data: customer, error: fetchError } = await supabase
    .from('customers')
    .select('credit_balance')
    .eq('id', customer_id)
    .single();

  if (fetchError || !customer) {
    return NextResponse.json(
      { error: 'Customer not found' },
      { status: 404 }
    );
  }

  const balanceBefore = parseFloat(customer.credit_balance) || 0;
  const txAmount = parseFloat(amount);
  
  // Calculate new balance
  let balanceAfter: number;
  if (type === 'withdraw') {
    if (balanceBefore < txAmount) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }
    balanceAfter = balanceBefore - txAmount;
  } else {
    balanceAfter = balanceBefore + txAmount;
  }

  // Start transaction - create credit_transaction and update customer balance
  const { data: transaction, error: txError } = await supabase
    .from('credit_transactions')
    .insert({
      customer_id,
      type,
      amount: txAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      note,
      created_by,
    })
    .select()
    .single();

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  // Update customer balance
  const { error: updateError } = await supabase
    .from('customers')
    .update({ credit_balance: balanceAfter })
    .eq('id', customer_id);

  if (updateError) {
    // Rollback transaction
    await supabase.from('credit_transactions').delete().eq('id', transaction.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(transaction);
}
