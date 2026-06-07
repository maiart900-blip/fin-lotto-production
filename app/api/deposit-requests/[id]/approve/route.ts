import { createClient } from '@/lib/supabase/server';
import { addCredit } from '@/lib/wallet-ledger';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { approved_by, admin_note } = body;

    // Get the deposit request
    const { data: depositRequest, error: fetchError } = await supabase
      .from('deposit_requests')
      .select('*, customer:customers(id, name, credit_balance)')
      .eq('id', id)
      .single();

    if (fetchError || !depositRequest) {
      return NextResponse.json({ error: 'Deposit request not found' }, { status: 404 });
    }

    if (depositRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Deposit request already processed' }, { status: 400 });
    }

    // Add credit to customer wallet using wallet-ledger
    const walletResult = await addCredit({
      customerId: depositRequest.customer_id,
      amount: depositRequest.amount,
      type: 'deposit',
      description: `เติมเงิน #${id}`,
      referenceId: id,
      referenceType: 'deposit_request',
      performedBy: approved_by,
    });

    if (!walletResult.success) {
      return NextResponse.json({ error: walletResult.error || 'Failed to add credit' }, { status: 500 });
    }

    // Update deposit request status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('deposit_requests')
      .update({
        status: 'approved',
        approved_by,
        approved_at: new Date().toISOString(),
        admin_note: admin_note || depositRequest.admin_note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Update deposit request error:', updateError);
      return NextResponse.json({ error: 'Failed to update deposit request' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      newBalance: walletResult.newBalance,
      transactionId: walletResult.transactionId,
    });
  } catch (error) {
    console.error('Error approving deposit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
