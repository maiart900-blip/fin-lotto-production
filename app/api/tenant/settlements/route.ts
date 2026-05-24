import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - ดูยอดสรุปและประวัติการส่งยอดของเว็บลูก
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const action = searchParams.get('action') || 'history';

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id required' }, { status: 400 });
    }

    // ดูยอดสรุปปัจจุบัน (ยังไม่ได้ส่ง)
    if (action === 'summary') {
      const today = new Date();
      const startOfDay = new Date(today.setHours(1, 0, 0, 0)); // Reset 01:00
      
      // ดึงยอดจาก transactions
      const { data: summary } = await supabase.rpc('get_tenant_daily_summary', {
        p_tenant_id: tenantId,
        p_start_date: startOfDay.toISOString()
      });

      // ถ้าไม่มี RPC ให้คำนวณจาก transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay.toISOString());

      const totals = (transactions || []).reduce((acc, t) => {
        if (t.type === 'bet') acc.totalBets += Number(t.amount);
        if (t.type === 'win') acc.totalWins += Number(t.amount);
        if (t.type === 'deposit') acc.totalDeposits += Number(t.amount);
        if (t.type === 'withdraw') acc.totalWithdrawals += Number(t.amount);
        return acc;
      }, { totalBets: 0, totalWins: 0, totalDeposits: 0, totalWithdrawals: 0 });

      const netProfit = totals.totalBets - totals.totalWins;
      const commissionRate = 0.05; // 5% commission
      const commission = netProfit > 0 ? netProfit * commissionRate : 0;
      const settlementAmount = netProfit - commission;

      return NextResponse.json({
        ...totals,
        netProfit,
        commission,
        settlementAmount,
        periodStart: startOfDay.toISOString(),
        periodEnd: new Date().toISOString()
      });
    }

    // ดูประวัติการส่งยอด
    const { data: settlements, error } = await supabase
      .from('tenant_settlements')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ settlements });
  } catch (error) {
    console.error('Error fetching settlements:', error);
    return NextResponse.json({ error: 'Failed to fetch settlements' }, { status: 500 });
  }
}

// POST - ส่งยอดเข้าเว็บกลาง
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      tenant_id,
      period_start,
      period_end,
      total_bets,
      total_wins,
      total_deposits,
      total_withdrawals,
      net_profit,
      commission_amount,
      settlement_amount,
      notes
    } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id required' }, { status: 400 });
    }

    // ตรวจสอบว่ามียอดที่ยังไม่ได้อนุมัติอยู่หรือไม่
    const { data: pending } = await supabase
      .from('tenant_settlements')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('status', 'pending')
      .single();

    if (pending) {
      return NextResponse.json({ 
        error: 'มียอดที่รอการอนุมัติอยู่แล้ว กรุณารอให้อนุมัติก่อน' 
      }, { status: 400 });
    }

    // สร้างรายการส่งยอดใหม่
    const { data, error } = await supabase
      .from('tenant_settlements')
      .insert({
        tenant_id,
        period_start,
        period_end,
        total_bets: total_bets || 0,
        total_wins: total_wins || 0,
        total_deposits: total_deposits || 0,
        total_withdrawals: total_withdrawals || 0,
        net_profit: net_profit || 0,
        commission_amount: commission_amount || 0,
        settlement_amount: settlement_amount || 0,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        notes
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, settlement: data });
  } catch (error) {
    console.error('Error submitting settlement:', error);
    return NextResponse.json({ error: 'Failed to submit settlement' }, { status: 500 });
  }
}
