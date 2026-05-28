import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createAuditLog, getClientIP, getUserAgent } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();
    
    // Get customer_id from cookie
    const customer_id = cookieStore.get('customer_id')?.value;
    
    if (!customer_id) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบก่อน', code: 'NOT_LOGGED_IN' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { lottery_id, entries, items } = body;
    
    // Support both 'entries' and 'items' keys for backwards compatibility
    const entryItems = entries || items;

    if (!lottery_id || !entryItems || entryItems.length === 0) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Get customer balance and tenant_id
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('credit_balance, is_active, tenant_id, current_turnover, total_bets')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลลูกค้า', code: 'CUSTOMER_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!customer.is_active) {
      return NextResponse.json(
        { error: 'บัญชีของคุณถูกระงับ กรุณาติดต่อแอดมิน', code: 'ACCOUNT_SUSPENDED' },
        { status: 403 }
      );
    }

    // Check if lottery is open
    const { data: lottery, error: lotteryError } = await supabase
      .from('lotteries')
      .select('id, name, is_active, is_closed_temp')
      .eq('id', lottery_id)
      .single();

    if (lotteryError || !lottery) {
      return NextResponse.json(
        { error: 'ไม่พบหวยที่เลือก', code: 'LOTTERY_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!lottery.is_active || lottery.is_closed_temp) {
      return NextResponse.json(
        { error: 'หวยปิดรับแล้ว', code: 'LOTTERY_CLOSED' },
        { status: 400 }
      );
    }

    // Calculate total
    const total = entryItems.reduce((sum: number, item: { amount: number }) => sum + (item.amount || 0), 0);

    if (total <= 0) {
      return NextResponse.json(
        { error: 'ยอดแทงไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    if (total > customer.credit_balance) {
      return NextResponse.json(
        { error: 'เครดิตไม่เพียงพอ', code: 'INSUFFICIENT_CREDIT' },
        { status: 400 }
      );
    }

    // Create entries (auto system - ลูกค้าแทงเอง)
    const entriesToInsert = entryItems.map((item: { number: string; bet_type?: string; betType?: string; amount: number }) => ({
      lottery_id,
      customer_id,
      tenant_id: customer.tenant_id, // Include tenant_id for stats queries
      number: item.number,
      bet_type: item.bet_type || item.betType,
      amount: item.amount,
      total_amount: item.amount, // Also set total_amount for stats
      source_type: 'auto', // ลูกค้าแทงเองผ่านระบบออโต้
    }));

    const { data: createdEntries, error: entriesError } = await supabase
      .from('entries')
      .insert(entriesToInsert)
      .select();

    if (entriesError) {
      console.error('Error creating entries:', entriesError);
      return NextResponse.json(
        { error: 'บันทึกรายการไม่สำเร็จ', details: entriesError.message },
        { status: 500 }
      );
    }

    // Deduct credit and create transaction
    const newBalance = customer.credit_balance - total;

    // Create credit transaction
    const { error: txError } = await supabase.from('credit_transactions').insert({
      customer_id,
      type: 'bet',
      amount: total,
      balance_before: customer.credit_balance,
      balance_after: newBalance,
      reference_type: 'entry',
      note: `ซื้อเลข ${lottery.name} จำนวน ${entryItems.length} รายการ`,
    });

    if (txError) {
      console.error('Error creating transaction:', txError);
    }

    // Update customer balance
    const { error: updateError } = await supabase
      .from('customers')
      .update({ 
        credit_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer_id);

    // Update turnover using RPC (atomic increment to avoid race condition)
    const { error: turnoverError } = await supabase.rpc('increment_turnover', { 
      p_customer_id: customer_id, 
      p_amount: total 
    });
    
    if (turnoverError) {
      console.error('Turnover RPC error, using fallback:', turnoverError);
      // Fallback: direct increment if RPC fails
      await supabase
        .from('customers')
        .update({ 
          current_turnover: (customer.current_turnover || 0) + total,
          total_bets: (customer.total_bets || 0) + total,
        })
        .eq('id', customer_id);
    }

    if (updateError) {
      console.error('Error updating balance:', updateError);
    }

    // Audit log
    await createAuditLog({
      action: 'bet_place',
      customerId: customer_id,
      targetId: lottery_id,
      targetType: 'lottery',
      details: { 
        lottery_name: lottery.name,
        entry_count: entryItems.length, 
        total_amount: total,
        new_balance: newBalance,
      },
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      entries: createdEntries,
      new_balance: newBalance,
      total_amount: total,
      entry_count: entryItems.length,
    });
  } catch (error) {
    console.error('Buy API error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
