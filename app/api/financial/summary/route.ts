import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึง summary ตาม period_type
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodType = searchParams.get('period_type') || 'daily';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const agentId = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '30');

    const supabase = await createClient();

    let query = supabase
      .from('financial_summary')
      .select('*')
      .eq('period_type', periodType)
      .order('period_date', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('period_date', startDate);
    }
    if (endDate) {
      query = query.lte('period_date', endDate);
    }
    if (agentId) {
      query = query.eq('agent_id', agentId);
    } else {
      query = query.is('agent_id', null); // ยอดรวมทั้งระบบ
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ summaries: data || [] });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}

// POST - Aggregate และบันทึก summary
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { period_type, date } = body;

    if (!period_type || !date) {
      return NextResponse.json({ error: 'period_type and date are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const targetDate = new Date(date);

    // คำนวณ period_date และ period_label ตาม period_type
    let periodDate: string;
    let periodLabel: string;
    let startDate: Date;
    let endDate: Date;

    switch (period_type) {
      case 'daily':
        periodDate = date;
        periodLabel = date;
        startDate = new Date(date);
        endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'weekly':
        // หาวันจันทร์ของสัปดาห์
        const dayOfWeek = targetDate.getDay();
        const monday = new Date(targetDate);
        monday.setDate(targetDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        periodDate = monday.toISOString().split('T')[0];
        
        const weekNum = getWeekNumber(targetDate);
        periodLabel = `${targetDate.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
        
        startDate = monday;
        endDate = new Date(monday);
        endDate.setDate(monday.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        periodDate = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}-01`;
        periodLabel = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`;
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'yearly':
        periodDate = `${targetDate.getFullYear()}-01-01`;
        periodLabel = `${targetDate.getFullYear()}`;
        startDate = new Date(targetDate.getFullYear(), 0, 1);
        endDate = new Date(targetDate.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        return NextResponse.json({ error: 'Invalid period_type' }, { status: 400 });
    }

    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    // ดึงยอดจาก entries
    const { data: betsData } = await supabase
      .from('entries')
      .select('amount, status, payout_amount')
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    // ดึงยอดจาก transactions (deposits/withdrawals)
    const { data: transData } = await supabase
      .from('transactions')
      .select('type, amount, status')
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .eq('status', 'completed');

    // คำนวณยอด
    const totalBets = betsData?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0;
    const betCount = betsData?.length || 0;
    
    const wonEntries = betsData?.filter(e => e.status === 'won' || e.status === 'paid') || [];
    const totalPayouts = wonEntries.reduce((sum, e) => sum + (parseFloat(e.payout_amount) || 0), 0);
    const payoutCount = wonEntries.length;

    const deposits = transData?.filter(t => t.type === 'deposit') || [];
    const withdrawals = transData?.filter(t => t.type === 'withdrawal') || [];
    
    const totalDeposits = deposits.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const depositCount = deposits.length;
    
    const totalWithdrawals = withdrawals.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const withdrawalCount = withdrawals.length;

    // ดึงคอมมิชชั่น
    const { data: commData } = await supabase
      .from('commissions')
      .select('amount')
      .gte('created_at', startStr)
      .lte('created_at', endStr);

    const totalCommissions = commData?.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) || 0;

    // คำนวณกำไรสุทธิ
    const netProfit = totalBets - totalPayouts - totalCommissions;

    // Upsert summary
    const { data, error } = await supabase
      .from('financial_summary')
      .upsert({
        period_type,
        period_date: periodDate,
        period_label: periodLabel,
        total_deposits: totalDeposits,
        total_withdrawals: totalWithdrawals,
        total_bets: totalBets,
        total_payouts: totalPayouts,
        total_commissions: totalCommissions,
        deposit_count: depositCount,
        withdrawal_count: withdrawalCount,
        bet_count: betCount,
        payout_count: payoutCount,
        net_profit: netProfit,
        agent_id: null,
        tenant_id: null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'period_type,period_date,agent_id,tenant_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving summary:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      summary: data,
      period: { periodDate, periodLabel, startStr, endStr }
    });
  } catch (error) {
    console.error('Error aggregating summary:', error);
    return NextResponse.json({ error: 'Failed to aggregate summary' }, { status: 500 });
  }
}

// Helper: หาเลขสัปดาห์ของปี
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
