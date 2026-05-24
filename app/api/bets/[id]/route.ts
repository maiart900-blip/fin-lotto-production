import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuditLog, getClientIP, getUserAgent } from '@/lib/audit-log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('bets')
    .select(`
      *,
      lottery:lotteries(id, name),
      customer:customers(id, name, phone),
      bet_items(*)
    `)
    .eq('id', id)
    .single();
  
  if (error || !data) {
    return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
  }
  
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  
  if (!customerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get bet
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .select('*, lottery:lotteries(name)')
      .eq('id', id)
      .single();
    
    if (betError || !bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    }
    
    // Check ownership
    if (bet.customer_id !== customerId) {
      return NextResponse.json({ error: 'Not your bet' }, { status: 403 });
    }
    
    // Check if can cancel
    if (bet.status !== 'confirmed') {
      return NextResponse.json({ error: 'Cannot cancel this bet' }, { status: 400 });
    }
    
    const now = new Date();
    const deadline = new Date(bet.cancel_deadline);
    if (now > deadline) {
      return NextResponse.json({ error: 'Cancel deadline passed' }, { status: 400 });
    }
    
    // Update bet status
    await supabase
      .from('bets')
      .update({
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        cancel_reason: 'Cancelled by customer',
        updated_at: now.toISOString(),
      })
      .eq('id', id);
    
    // Refund balance
    const { data: customer } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', customerId)
      .single();
    
    const newBalance = (customer?.credit_balance || 0) + bet.total_amount;
    await supabase
      .from('customers')
      .update({ credit_balance: newBalance, updated_at: now.toISOString() })
      .eq('id', customerId);
    
    // Log refund
    await supabase
      .from('credit_transactions')
      .insert({
        customer_id: customerId,
        amount: bet.total_amount,
        type: 'refund',
        description: `ยกเลิกโพย ${bet.lottery?.name || 'หวย'}`,
        balance_after: newBalance,
        reference_id: id,
        reference_type: 'bet',
      });
    
    // Audit log
    await createAuditLog({
      action: 'bet_cancel',
      customerId,
      targetId: id,
      targetType: 'bet',
      details: {
        total_amount: bet.total_amount,
        refunded: bet.total_amount,
        new_balance: newBalance,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    });
    
    return NextResponse.json({
      success: true,
      refunded: bet.total_amount,
      new_balance: newBalance,
    });
    
  } catch (error) {
    console.error('Error cancelling bet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
