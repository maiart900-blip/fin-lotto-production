import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import {
  createAuditLog,
  getClientIP,
  getUserAgent,
} from '@/lib/audit-log';
import {
  applyRateLimit,
  customerBuySchema,
  validateRequestBody,
  logSecurityEvent,
} from '@/lib/security/api-security';
import {
  resolveCustomerAgentChain,
  buildAgentSnapshotFields,
} from '@/lib/agent-snapshot';

type BuyEntryInput = {
  number: string;
  amount?: number;
  bet_type?: string;
  betType?: string;
  original_number?: string;
};

type NormalizedBuyEntry = {
  number: string;
  amount: number;
  bet_type?: string;
  betType?: string;
  original_number?: string;
};

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit financial operations (10 per minute)
    const rateLimitResponse = await applyRateLimit(
      'financial',
      'customer_buy'
    );

    if (rateLimitResponse) {
      await logSecurityEvent('rate_limit', {
        endpoint: '/api/customer/buy',
        reason: 'Buy operation rate limited',
      });

      return rateLimitResponse;
    }

    const supabase = await createClient();
    const cookieStore = await cookies();

    // Get customer_id from cookie
    const customer_id =
      cookieStore.get('customer_id')?.value;

    if (!customer_id) {
      return NextResponse.json(
        {
          error: 'กรุณาเข้าสู่ระบบก่อน',
          code: 'NOT_LOGGED_IN',
        },
        { status: 401 }
      );
    }

    // SECURITY: Validate input with Zod schema (Anti-SQL Injection)
    const validation = await validateRequestBody(
      request,
      customerBuySchema
    );

    if (!validation.success) {
      await logSecurityEvent('validation_failure', {
        endpoint: '/api/customer/buy',
        customer_id,
        reason: 'Invalid buy request format',
      });

      return validation.response;
    }

    const { lottery_id, entries, items } = validation.data;

    // Support both 'entries' and 'items' keys for backwards compatibility
    const rawEntryItems = (entries || items || []) as BuyEntryInput[];

    if (rawEntryItems.length === 0) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // Normalize amount so every item is guaranteed to have number amount.
    const entryItems: NormalizedBuyEntry[] =
      rawEntryItems.map((item) => ({
        ...item,
        number: String(item.number || ''),
        amount: Number(item.amount ?? 0),
      }));

    // Reject invalid items before any database write.
    const hasInvalidEntry = entryItems.some(
      (item) =>
        !item.number ||
        !Number.isFinite(item.amount) ||
        item.amount <= 0
    );

    if (hasInvalidEntry) {
      return NextResponse.json(
        { error: 'ข้อมูลรายการแทงไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Get customer balance and tenant_id
    const { data: customer, error: customerError } =
      await supabase
        .from('customers')
        .select(
          'credit_balance, is_active, tenant_id, current_turnover, total_bets'
        )
        .eq('id', customer_id)
        .single();

    if (customerError || !customer) {
      return NextResponse.json(
        {
          error: 'ไม่พบข้อมูลลูกค้า',
          code: 'CUSTOMER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (!customer.is_active) {
      return NextResponse.json(
        {
          error:
            'บัญชีของคุณถูกระงับ กรุณาติดต่อแอดมิน',
          code: 'ACCOUNT_SUSPENDED',
        },
        { status: 403 }
      );
    }

    // Check if lottery is open
    const { data: lottery, error: lotteryError } =
      await supabase
        .from('lotteries')
        .select('id, name, is_active, is_closed_temp')
        .eq('id', lottery_id)
        .single();

    if (lotteryError || !lottery) {
      return NextResponse.json(
        {
          error: 'ไม่พบหวยที่เลือก',
          code: 'LOTTERY_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (!lottery.is_active || lottery.is_closed_temp) {
      return NextResponse.json(
        {
          error: 'หวยปิดรับแล้ว',
          code: 'LOTTERY_CLOSED',
        },
        { status: 400 }
      );
    }

    // Calculate total from normalized numeric amounts.
    const total = entryItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    if (total <= 0) {
      return NextResponse.json(
        { error: 'ยอดแทงไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const currentBalance =
      Number(customer.credit_balance) || 0;

    if (total > currentBalance) {
      return NextResponse.json(
        {
          error: 'เครดิตไม่เพียงพอ',
          code: 'INSUFFICIENT_CREDIT',
        },
        { status: 400 }
      );
    }

    // Resolve สายงานเอเย่นต์ของลูกค้าครั้งเดียว
    const agentChain =
      await resolveCustomerAgentChain(
        supabase,
        customer_id
      );

    // Create entries (auto system - ลูกค้าแทงเอง)
    const entriesToInsert = entryItems.map((item) => ({
      lottery_id,
      customer_id,
      tenant_id: customer.tenant_id,
      number: item.number,
      bet_type: item.bet_type || item.betType,
      amount: item.amount,
      source_type: 'auto',
      product_type: 'lottery',
      ...(agentChain
        ? buildAgentSnapshotFields(
            agentChain,
            item.amount
          )
        : {}),
    }));

    const {
      data: createdEntries,
      error: entriesError,
    } = await supabase
      .from('entries')
      .insert(entriesToInsert)
      .select();

    if (entriesError) {
      console.error(
        'Error creating entries:',
        entriesError
      );

      return NextResponse.json(
        {
          error: 'บันทึกรายการไม่สำเร็จ',
          details: entriesError.message,
        },
        { status: 500 }
      );
    }

    // Deduct credit and create transaction
    const newBalance = currentBalance - total;

    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        customer_id,
        type: 'bet',
        amount: total,
        balance_before: currentBalance,
        balance_after: newBalance,
        reference_type: 'entry',
        note: `ซื้อเลข ${lottery.name} จำนวน ${entryItems.length} รายการ`,
      });

    if (txError) {
      console.error(
        'Error creating transaction:',
        txError
      );
    }

    // Update customer balance
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        credit_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer_id);

    // Update turnover using RPC
    const { error: turnoverError } =
      await supabase.rpc('increment_turnover', {
        p_customer_id: customer_id,
        p_amount: total,
      });

    if (turnoverError) {
      console.error(
        'Turnover RPC error, using fallback:',
        turnoverError
      );

      const currentTurnover =
        Number(customer.current_turnover) || 0;
      const currentTotalBets =
        Number(customer.total_bets) || 0;

      await supabase
        .from('customers')
        .update({
          current_turnover:
            currentTurnover + total,
          total_bets:
            currentTotalBets + total,
        })
        .eq('id', customer_id);
    }

    if (updateError) {
      console.error(
        'Error updating balance:',
        updateError
      );
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