import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Transaction Lock Map
 * Prevents concurrent credit operations on the same customer/agent
 * In production, use Redis SETNX or database advisory locks
 */
const transactionLocks = new Map<string, Promise<any>>();

async function withTransactionLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any existing transaction to complete
  const existingLock = transactionLocks.get(lockKey);
  if (existingLock) {
    await existingLock.catch(() => {}); // Ignore errors from previous transaction
  }

  // Create new lock
  const lockPromise = fn();
  transactionLocks.set(lockKey, lockPromise);

  try {
    const result = await lockPromise;
    return result;
  } finally {
    // Clean up lock after completion
    if (transactionLocks.get(lockKey) === lockPromise) {
      transactionLocks.delete(lockKey);
    }
  }
}

// POST - ระบบคีย์เลขอัตโนมัติพร้อมตัดเครดิตทันที (Transaction Lock)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerId,
      agentId,
      lotteryId,
      entries, // Array of { number, betType, amount }
      source = 'auto'
    } = body;

    // Validation
    if (!customerId || !lotteryId || !entries?.length) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Use transaction lock to prevent double-spending
    const lockKey = `entry-${customerId}-${agentId || 'none'}`;
    
    const result = await withTransactionLock(lockKey, async () => {
    const supabase = await createClient();

    // 1. ตรวจสอบเลขอั้น/เลขเต็ม
    const { data: blockedNumbers } = await supabase
      .from('blocked_numbers')
      .select('number, bet_type, lottery_id')
      .or(`lottery_id.eq.${lotteryId},lottery_id.is.null`);

    const blockedSet = new Set(
      blockedNumbers?.map(b => `${b.number}-${b.bet_type || 'all'}`) || []
    );

    // ตรวจสอบแต่ละรายการ
    const validEntries: typeof entries = [];
    const rejectedEntries: Array<{ number: string; reason: string }> = [];

    for (const entry of entries) {
      const blockKey1 = `${entry.number}-${entry.betType}`;
      const blockKey2 = `${entry.number}-all`;
      
      if (blockedSet.has(blockKey1) || blockedSet.has(blockKey2)) {
        rejectedEntries.push({ number: entry.number, reason: 'เลขอั้น' });
        continue;
      }

      // ตรวจสอบ exposure limit
      const { data: exposure } = await supabase
        .from('entries')
        .select('amount')
        .eq('number', entry.number)
        .eq('bet_type', entry.betType)
        .eq('lottery_id', lotteryId);

      const currentExposure = exposure?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      
      // ดึง limit setting
      const { data: limitSetting } = await supabase
        .from('bet_limits')
        .select('max_amount')
        .eq('bet_type', entry.betType)
        .single();

      const maxLimit = limitSetting?.max_amount || 100000;

      if (currentExposure + entry.amount > maxLimit) {
        const remaining = maxLimit - currentExposure;
        if (remaining > 0) {
          validEntries.push({ ...entry, amount: remaining });
          rejectedEntries.push({ 
            number: entry.number, 
            reason: `เกิน limit - รับได้ ${remaining} บาท` 
          });
        } else {
          rejectedEntries.push({ number: entry.number, reason: 'เลขเต็ม' });
        }
        continue;
      }

      validEntries.push(entry);
    }

    if (validEntries.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ไม่มีรายการที่ผ่านการตรวจสอบ',
        rejectedEntries
      }, { status: 400 });
    }

    // 2. คำนวณยอดรวม
    const totalAmount = validEntries.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

    // 3. ตรวจสอบเครดิตลูกค้า
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, credit_balance, agent_id')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลลูกค้า' }, { status: 404 });
    }

    if ((customer.credit_balance || 0) < totalAmount) {
      return NextResponse.json({ 
        error: 'เครดิตไม่เพียงพอ',
        required: totalAmount,
        available: customer.credit_balance
      }, { status: 400 });
    }

    // 4. ตรวจสอบเครดิต Agent (ถ้ามี)
    const effectiveAgentId = agentId || customer.agent_id;
    if (effectiveAgentId) {
      const { data: agentCredit } = await supabase
        .from('credit_lines')
        .select('credit_balance')
        .eq('user_id', effectiveAgentId)
        .single();

      if (agentCredit && (agentCredit.credit_balance || 0) < totalAmount) {
        return NextResponse.json({ 
          error: 'เครดิต Agent ไม่เพียงพอ',
          required: totalAmount,
          available: agentCredit.credit_balance
        }, { status: 400 });
      }
    }

    // 5. สร้าง Ticket ID
    const ticketId = `AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 6. บันทึกรายการ entries ทั้งหมด
    const entryRecords = validEntries.map((entry: { number: string; betType: string; amount: number }) => ({
      ticket_id: ticketId,
      customer_id: customerId,
      agent_id: effectiveAgentId,
      lottery_id: lotteryId,
      number: entry.number,
      bet_type: entry.betType,
      amount: entry.amount,
      source_type: source,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    const { data: insertedEntries, error: entriesError } = await supabase
      .from('entries')
      .insert(entryRecords)
      .select();

    if (entriesError) throw entriesError;

    // 7. ตัดเครดิตลูกค้า
    const newCustomerBalance = (customer.credit_balance || 0) - totalAmount;
    await supabase
      .from('customers')
      .update({ credit_balance: newCustomerBalance })
      .eq('id', customerId);

    // 8. บันทึก credit transaction สำหรับลูกค้า
    await supabase.from('credit_transactions').insert({
      user_id: customerId,
      user_type: 'customer',
      type: 'debit',
      amount: totalAmount,
      balance_after: newCustomerBalance,
      reference_id: ticketId,
      note: `ซื้อหวย ${validEntries.length} รายการ`,
      created_at: new Date().toISOString()
    });

    // 9. ตัดเครดิต Agent (ถ้ามี)
    if (effectiveAgentId) {
      const { data: agentCreditLine } = await supabase
        .from('credit_lines')
        .select('credit_balance')
        .eq('user_id', effectiveAgentId)
        .single();

      if (agentCreditLine) {
        const newAgentBalance = (agentCreditLine.credit_balance || 0) - totalAmount;
        await supabase
          .from('credit_lines')
          .update({ credit_balance: newAgentBalance })
          .eq('user_id', effectiveAgentId);

        await supabase.from('credit_transactions').insert({
          user_id: effectiveAgentId,
          user_type: 'agent',
          type: 'debit',
          amount: totalAmount,
          balance_after: newAgentBalance,
          reference_id: ticketId,
          note: `ยอดขายจากลูกค้า ${customer.name}`,
          created_at: new Date().toISOString()
        });
      }
    }

    // 10. บันทึก Audit Log
    await supabase.from('audit_logs').insert({
      action: 'auto_entry_created',
      entity_type: 'entry',
      entity_id: ticketId,
      details: {
        customerId,
        agentId: effectiveAgentId,
        lotteryId,
        totalAmount,
        entriesCount: validEntries.length,
        rejectedCount: rejectedEntries.length
      },
      created_at: new Date().toISOString()
    });

    // 11. สร้างข้อมูลใบเสร็จ
    const receipt = {
      ticketId,
      customerName: customer.name,
      lotteryId,
      entries: validEntries,
      totalAmount,
      creditBefore: customer.credit_balance,
      creditAfter: newCustomerBalance,
      createdAt: new Date().toISOString()
    };

    return {
      success: true,
      ticketId,
      receipt,
      entriesCount: validEntries.length,
      totalAmount,
      newBalance: newCustomerBalance,
      rejectedEntries: rejectedEntries.length > 0 ? rejectedEntries : undefined
    };
    }); // End of withTransactionLock

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Auto entry error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message,
      code: 'TRANSACTION_FAILED'
    }, { status: 500 });
  }
}

// GET - ดึงสถานะ blocked numbers และ limits
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');

    // ดึงเลขอั้น
    let blockedQuery = supabase.from('blocked_numbers').select('*');
    if (lotteryId) {
      blockedQuery = blockedQuery.or(`lottery_id.eq.${lotteryId},lottery_id.is.null`);
    }
    const { data: blockedNumbers } = await blockedQuery;

    // ดึง bet limits
    const { data: betLimits } = await supabase
      .from('bet_limits')
      .select('*');

    // ดึง exposure ปัจจุบัน
    let exposureQuery = supabase
      .from('entries')
      .select('number, bet_type, amount')
      .eq('status', 'pending');
    
    if (lotteryId) {
      exposureQuery = exposureQuery.eq('lottery_id', lotteryId);
    }
    const { data: currentExposure } = await exposureQuery;

    // Group exposure by number-betType
    const exposureMap: Record<string, number> = {};
    currentExposure?.forEach(e => {
      const key = `${e.number}-${e.bet_type}`;
      exposureMap[key] = (exposureMap[key] || 0) + (e.amount || 0);
    });

    return NextResponse.json({
      blockedNumbers: blockedNumbers || [],
      betLimits: betLimits || [],
      currentExposure: exposureMap
    });
  } catch (error: any) {
    console.error('Error fetching validation data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
