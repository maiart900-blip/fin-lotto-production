import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Get withdraw request
  const { data: withdrawRequest } = await supabase
    .from('tenant_withdraw_requests')
    .select('*, customer:customers(id, credit_balance)')
    .eq('id', id)
    .single();

  if (!withdrawRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (withdrawRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Already processed' }, { status: 400 });
  }

  // Check customer has enough balance
  const customerBalance = withdrawRequest.customer?.credit_balance || 0;
  if (customerBalance < withdrawRequest.amount) {
    return NextResponse.json({ error: 'ยอดเครดิตไม่เพียงพอ' }, { status: 400 });
  }

  // Update withdraw request status
  const { error: updateError } = await supabase
    .from('tenant_withdraw_requests')
    .update({ 
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Deduct credit from customer
  const newBalance = customerBalance - withdrawRequest.amount;
  await supabase
    .from('customers')
    .update({ credit_balance: newBalance })
    .eq('id', withdrawRequest.customer_id);

  // Create transaction record
  await supabase.from('transactions').insert({
    customer_id: withdrawRequest.customer_id,
    tenant_id: withdrawRequest.tenant_id,
    type: 'withdraw',
    amount: -withdrawRequest.amount,
    balance_after: newBalance,
    status: 'completed',
    description: 'ถอนเงิน (อนุมัติ)',
    reference_id: id,
  });

  return NextResponse.json({ success: true });
}
