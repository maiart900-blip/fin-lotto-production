import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const supabase = await createClient();

  // Get topup request
  const { data: topupRequest } = await supabase
    .from('tenant_topup_requests')
    .select('*, customer:customers(id, credit_balance)')
    .eq('id', id)
    .single();

  if (!topupRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (topupRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Already processed' }, { status: 400 });
  }

  // Update topup request status
  const { error: updateError } = await supabase
    .from('tenant_topup_requests')
    .update({ 
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Add credit to customer
  const newBalance = (topupRequest.customer?.credit_balance || 0) + topupRequest.amount;
  await supabase
    .from('customers')
    .update({ credit_balance: newBalance })
    .eq('id', topupRequest.customer_id);

  // Create transaction record
  await supabase.from('transactions').insert({
    customer_id: topupRequest.customer_id,
    tenant_id: topupRequest.tenant_id,
    type: 'deposit',
    amount: topupRequest.amount,
    balance_after: newBalance,
    status: 'completed',
    description: 'เติมเงิน (อนุมัติ)',
    reference_id: id,
  });

  return NextResponse.json({ success: true });
}
