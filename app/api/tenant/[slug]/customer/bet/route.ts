import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { slug } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('tenant_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { id: string };
    const body = await request.json();
    const { lottery_id, bets } = body;

    if (!lottery_id || !bets || bets.length === 0) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, credit_balance')
      .eq('id', decoded.id)
      .eq('tenant_id', tenant.id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Calculate total amount
    const totalAmount = bets.reduce((sum: number, bet: any) => sum + (bet.amount || 0), 0);

    if (totalAmount > customer.credit_balance) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Create bet record (batch)
    const { data: betRecord, error: betError } = await supabase
      .from('bets')
      .insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        lottery_id: lottery_id,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (betError) {
      console.error('Bet insert error:', betError);
      return NextResponse.json({ error: 'Failed to create bet' }, { status: 500 });
    }

    // Map bet types จาก UI เว็บลูก -> ค่ามาตรฐานของ entries (entries_bet_type_check)
    // ค่าที่ entries ยอมรับ: 3top,3tod,3flip,2top,2bot,2flip,1top,1bot,win2,win3
    const ENTRY_BET_TYPE_MAP: Record<string, string> = {
      run3top: '1top', // วิ่งบน
      run3bot: '1bot', // วิ่งล่าง
      runtop: '1top',
      runbot: '1bot',
      '1up': '1top',
      '2up': '2top',
      '3up': '3top',
    };
    const normalizeEntryBetType = (bt: string) => ENTRY_BET_TYPE_MAP[bt] ?? bt;

    // Create entry records for risk management (ส่งขึ้นเว็บแม่)
    const entryRecords = bets.map((bet: any) => ({
      tenant_id: tenant.id, // Critical: scope entries to tenant
      lottery_id: lottery_id,
      customer_id: customer.id,
      number: bet.number,
      bet_type: normalizeEntryBetType(bet.bet_type),
      amount: bet.amount,
      status: 'pending',
      source_type: 'tenant', // ระบุว่ามาจากเว็บลูก
      entry_type: 'tenant_bet',
    }));

    const { error: entriesError } = await supabase
      .from('entries')
      .insert(entryRecords);

    if (entriesError) {
      console.error('Entries insert error:', entriesError);
      // Don't fail the bet, just log the error
    }

    // Deduct balance
    await supabase
      .from('customers')
      .update({ credit_balance: customer.credit_balance - totalAmount })
      .eq('id', customer.id);

    return NextResponse.json({ success: true, total: totalAmount });
  } catch (error) {
    console.error('Bet error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
