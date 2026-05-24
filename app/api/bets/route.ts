import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAuditLog, getClientIP, getUserAgent } from '@/lib/audit-log';
import { requireAuth } from '@/lib/api-auth';
import { deepStripSensitiveFields } from '@/lib/api-serializers';

export async function GET(request: NextRequest) {
  // Auth guard - require authentication
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const customer_id = searchParams.get('customer_id');
  const lottery_id = searchParams.get('lottery_id');
  const status = searchParams.get('status');
  const source_type = searchParams.get('source_type'); // Filter by source_type (manual_key/auto)
  
  let query = supabase
    .from('bets')
    .select(`
      *,
      lottery:lotteries(id, name),
      bet_items(*)
    `)
    .order('created_at', { ascending: false });
  
  if (customer_id) query = query.eq('customer_id', customer_id);
  if (lottery_id) query = query.eq('lottery_id', lottery_id);
  if (status) query = query.eq('status', status);
  if (source_type) query = query.eq('source_type', source_type);
  
  const { data, error } = await query.limit(100);
  
  if (error) {
    console.error('[v0] Error fetching bets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Strip sensitive fields but keep all operational data including nested relations
  console.log('[v0] Bets fetched:', data?.length, 'source_type filter:', source_type);
  return NextResponse.json(deepStripSensitiveFields(data || []));
}

export async function POST(request: NextRequest) {
  // Auth guard - require authentication for placing bets
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const supabase = await createClient();
  const cookieStore = await cookies();
  const customerId = cookieStore.get('customer_id')?.value;
  const adminId = cookieStore.get('admin_id')?.value; // แอดมินผู้รับโพย
  
  // Fallback to user.id if no customer_id/admin_id cookie
  const effectiveCustomerId = customerId || user?.id;
  const effectiveAdminId = adminId || (user?.role && ['admin', 'super_admin', 'manager'].includes(user.role) ? user.id : null);
  
  if (!effectiveCustomerId && !effectiveAdminId) {
    return NextResponse.json({ error: 'Unauthorized - no valid session' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { lottery_id, items, customer_name, tenant_id, target_customer_id, source_type, agent_id } = body;
    
    // ใช้ target_customer_id ถ้าแอดมินคีย์ให้ลูกค้า หรือใช้ effectiveCustomerId ปกติ
    const actualCustomerId = target_customer_id || effectiveCustomerId;
    
    // Determine source_type: manual_key (คีย์หวย) or auto (ลูกค้าแทงเอง)
    const betSourceType = source_type || (effectiveAdminId ? 'manual_key' : 'auto');
    
    console.log('[v0] Creating bet:', { lottery_id, actualCustomerId, betSourceType, agent_id, adminId: effectiveAdminId });
    
    if (!lottery_id || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing lottery_id or items' }, { status: 400 });
    }

    // Generate idempotency key for duplicate request protection
    const idempotencyKey = body.idempotency_key;
    if (idempotencyKey) {
      const { data: existingBet } = await supabase
        .from('bets')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .single();
      
      if (existingBet) {
        console.log('[v0] Duplicate bet request detected:', idempotencyKey);
        return NextResponse.json({ 
          success: true, 
          bet_id: existingBet.id,
          duplicate: true,
          message: 'Bet already processed'
        });
      }
    }
    
    // Check lottery exists and is open
    const { data: lottery, error: lotteryError } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', lottery_id)
      .single();
    
    if (lotteryError || !lottery) {
      return NextResponse.json({ error: 'Lottery not found' }, { status: 404 });
    }
    
    if (!lottery.is_active) {
      return NextResponse.json({ error: 'Lottery is closed' }, { status: 400 });
    }
    
    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0);
    }
    
    // Check customer balance with row-level locking (select for update via RPC)
    // Note: Supabase doesn't support SELECT FOR UPDATE directly, so we use a combination of:
    // 1. Check balance first
    // 2. Update with a condition to prevent race conditions
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('credit_balance, name')
      .eq('id', actualCustomerId)
      .single();
    
    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    
    if (customer.credit_balance < totalAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // ATOMIC OPERATION: Deduct balance first with condition check
    // This prevents race conditions by only updating if balance >= totalAmount
    const newBalance = customer.credit_balance - totalAmount;
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({ 
        credit_balance: newBalance, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', actualCustomerId)
      .gte('credit_balance', totalAmount) // Atomic check: only update if balance sufficient
      .select('credit_balance')
      .single();
    
    if (updateError || !updatedCustomer) {
      console.error('[v0] Balance deduction failed - race condition or insufficient balance');
      return NextResponse.json({ 
        error: 'Balance deduction failed. Please try again.',
        code: 'BALANCE_RACE_CONDITION'
      }, { status: 409 });
    }
    
    const finalBalance = updatedCustomer.credit_balance;
    
    // Create bet with new fields
    const cancelDeadline = new Date();
    cancelDeadline.setMinutes(cancelDeadline.getMinutes() + 5); // 5 minutes to cancel
    
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        customer_id: actualCustomerId,
        customer_name: customer_name || customer.name, // ชื่อลูกค้า
        created_by: actualCustomerId, // ใช้ customer_id เนื่องจาก FK ไปยัง customers
        tenant_id: tenant_id || null,
        lottery_id,
        total_amount: totalAmount,
        status: 'confirmed',
        cancel_deadline: cancelDeadline.toISOString(),
        is_checked: false,
        total_win_amount: 0,
        source_type: betSourceType, // 'manual_key' or 'auto'
        idempotency_key: idempotencyKey || null, // For duplicate request protection
        keyed_by: effectiveAdminId || null, // Admin who keyed the bet (if any)
      })
      .select()
      .single();
    
    console.log('[v0] Bet created:', { bet_id: bet?.id, source_type: betSourceType });
    
    if (betError) {
      // ROLLBACK: คืนเงินให้ลูกค้า
      console.error('[v0] Bet creation failed, rolling back balance');
      await supabase
        .from('customers')
        .update({ credit_balance: customer.credit_balance })
        .eq('id', actualCustomerId);
      return NextResponse.json({ error: betError.message }, { status: 500 });
    }
    
    // Map bet_type from frontend format (2_top) to database format (2top)
    const mapBetType = (betType: string): string => {
      const mapping: Record<string, string> = {
        '2_top': '2top',
        '2_bot': '2bot',
        '2_flip': '2flip',
        '3_top': '3top',
        '3_tod': '3tod',
        '3_flip': '3flip',
        '1_top': '1top',
        '1_bot': '1bot',
        'run_top': '1top',
        'run_bot': '1bot',
      };
      return mapping[betType] || betType;
    };
    
    // Get payout rates for this lottery
    const { data: payoutRates } = await supabase
      .from('payout_rates')
      .select('bet_type, rate')
      .eq('lottery_id', lottery_id);
    
    const payoutRateMap = new Map(
      payoutRates?.map(p => [p.bet_type, parseFloat(p.rate)]) || []
    );
    
    console.log('[v0] Payout rates:', Object.fromEntries(payoutRateMap));
    
    // Create bet items with correct payout rates
    const betItems = items.map((item: any) => {
      const dbBetType = mapBetType(item.bet_type);
      const payoutRate = payoutRateMap.get(dbBetType) || 0;
      console.log('[v0] Bet item:', { number: item.number, frontendType: item.bet_type, dbType: dbBetType, payoutRate });
      
      return {
        bet_id: bet.id,
        number: item.number,
        bet_type: dbBetType, // Use mapped bet_type
        amount_top: item.amount_top || 0,
        amount_bottom: item.amount_bottom || 0,
        amount_tod: item.amount_tod || 0,
        is_reverse: item.is_reverse || false,
        original_number: item.original_number || item.number,
        payout_rate: payoutRate, // Use correct payout rate from database
      };
    });
    
    const { error: itemsError } = await supabase
      .from('bet_items')
      .insert(betItems);
    
    if (itemsError) {
      // ROLLBACK: ลบ bet และคืนเงินให้ลูกค้า
      console.error('[v0] Bet items creation failed, rolling back');
      await supabase.from('bets').delete().eq('id', bet.id);
      await supabase
        .from('customers')
        .update({ credit_balance: customer.credit_balance })
        .eq('id', actualCustomerId);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
    
    // ส่งเลขเข้าระบบวิเคราะห์เลขเสี่ยง (non-blocking)
    // ไม่รอผลเพราะไม่ใช่ส่วนสำคัญของการส่งโพย
    const riskNumbers = items.map((item: any) => ({
      lottery_id,
      number: item.number,
      bet_type: item.bet_type,
      total_amount: (item.amount_top || 0) + (item.amount_bottom || 0) + (item.amount_tod || 0),
    }));
    
    // Fire and forget - ไม่ await
    Promise.all(riskNumbers.map(async (risk: any) => {
      try {
        await supabase.from('number_risks').upsert({
          lottery_id: risk.lottery_id,
          number: risk.number,
          bet_type: risk.bet_type,
          total_amount: risk.total_amount,
          bet_count: 1,
        }, { onConflict: 'lottery_id,number,bet_type' });
      } catch {
        // Silently ignore - number_risks is optional
      }
    })).catch(() => {});
    
    // Note: Balance already deducted atomically above
    // Log credit transaction
    await supabase
      .from('credit_transactions')
      .insert({
        customer_id: actualCustomerId,
        amount: -totalAmount,
        type: 'bet',
        description: `แทงหวย ${lottery.name}`,
        balance_after: finalBalance,
        reference_id: bet.id,
        reference_type: 'bet',
      });
    
    // Audit log
    await createAuditLog({
      action: 'bet_place',
      customerId: actualCustomerId,
      targetId: bet.id,
      targetType: 'bet',
      details: {
        lottery_name: lottery.name,
        item_count: items.length,
        total_amount: totalAmount,
        new_balance: finalBalance,
        created_by: effectiveAdminId || actualCustomerId,
        customer_name: customer_name || customer.name,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    });
    
    return NextResponse.json({
      success: true,
      bet_id: bet.id,
      total_amount: totalAmount,
      new_balance: finalBalance,
      item_count: items.length,
    });
    
  } catch (error) {
    console.error('Error creating bet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
