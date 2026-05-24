import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get settlement report for a specific tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // Period params: daily, weekly, monthly, custom
    const period = searchParams.get('period') || 'daily';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status'); // pending, settled, negative
    
    // Calculate date range based on period
    let dateFrom: Date, dateTo: Date;
    const now = new Date();
    
    if (startDate && endDate) {
      dateFrom = new Date(startDate);
      dateTo = new Date(endDate);
    } else {
      dateTo = now;
      switch (period) {
        case 'weekly':
          dateFrom = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'monthly':
          dateFrom = new Date(now.setMonth(now.getMonth() - 1));
          break;
        default: // daily - last 30 days
          dateFrom = new Date(now.setDate(now.getDate() - 30));
      }
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, slug, domain')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'ไม่พบเว็บลูก' }, { status: 404 });
    }

    // Get existing settlement records
    let settlementsQuery = supabase
      .from('tenant_settlements')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('period_start', dateFrom.toISOString().split('T')[0])
      .lte('period_end', dateTo.toISOString().split('T')[0])
      .order('period_start', { ascending: false });

    if (status && status !== 'all') {
      settlementsQuery = settlementsQuery.eq('status', status);
    }

    const { data: existingSettlements } = await settlementsQuery;

    // Generate daily reports from real data
    const reports: Array<{
      date: string;
      deposits: number;
      withdrawals: number;
      betsAmount: number;
      winAmount: number;
      profitLoss: number;
      settlementAmount: number;
      status: 'pending' | 'settled' | 'negative';
      settlementId?: string;
      settledAt?: string;
      settledBy?: string;
      notes?: string;
    }> = [];

    // Loop through each day in range
    const currentDate = new Date(dateFrom);
    while (currentDate <= dateTo) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      // Get deposits for this day
      const { data: dayDeposits } = await supabase
        .from('transactions')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('type', 'deposit')
        .eq('status', 'completed')
        .gte('created_at', dateStr)
        .lt('created_at', nextDateStr);

      const deposits = dayDeposits?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

      // Get withdrawals for this day
      const { data: dayWithdrawals } = await supabase
        .from('transactions')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('type', 'withdrawal')
        .eq('status', 'completed')
        .gte('created_at', dateStr)
        .lt('created_at', nextDateStr);

      const withdrawals = dayWithdrawals?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

      // Get bets for this day
      const { data: dayBets } = await supabase
        .from('bets')
        .select('total_amount, total_win_amount')
        .eq('tenant_id', tenantId)
        .gte('created_at', dateStr)
        .lt('created_at', nextDateStr);

      const betsAmount = dayBets?.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) || 0;
      const winAmount = dayBets?.reduce((sum, b) => sum + (Number(b.total_win_amount) || 0), 0) || 0;

      // Calculate
      const profitLoss = betsAmount - winAmount;
      const settlementAmount = deposits - winAmount;
      
      // Check if there's an existing settlement for this day
      const existingSettlement = existingSettlements?.find(
        s => s.period_start === dateStr || s.period_end === dateStr
      );

      // Only add if there's activity or existing settlement
      if (deposits > 0 || withdrawals > 0 || betsAmount > 0 || existingSettlement) {
        let reportStatus: 'pending' | 'settled' | 'negative' = 'pending';
        if (existingSettlement?.status === 'approved') {
          reportStatus = 'settled';
        } else if (settlementAmount < 0) {
          reportStatus = 'negative';
        }

        reports.push({
          date: dateStr,
          deposits,
          withdrawals,
          betsAmount,
          winAmount,
          profitLoss,
          settlementAmount,
          status: reportStatus,
          settlementId: existingSettlement?.id,
          settledAt: existingSettlement?.approved_at,
          settledBy: existingSettlement?.approved_by,
          notes: existingSettlement?.notes,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Filter by status if specified
    let filteredReports = reports;
    if (status && status !== 'all') {
      filteredReports = reports.filter(r => r.status === status);
    }

    // Calculate totals
    const totals = filteredReports.reduce((acc, r) => ({
      deposits: acc.deposits + r.deposits,
      withdrawals: acc.withdrawals + r.withdrawals,
      betsAmount: acc.betsAmount + r.betsAmount,
      winAmount: acc.winAmount + r.winAmount,
      profitLoss: acc.profitLoss + r.profitLoss,
      settlementAmount: acc.settlementAmount + r.settlementAmount,
      pendingCount: acc.pendingCount + (r.status === 'pending' ? 1 : 0),
      settledCount: acc.settledCount + (r.status === 'settled' ? 1 : 0),
      negativeCount: acc.negativeCount + (r.status === 'negative' ? 1 : 0),
    }), {
      deposits: 0,
      withdrawals: 0,
      betsAmount: 0,
      winAmount: 0,
      profitLoss: 0,
      settlementAmount: 0,
      pendingCount: 0,
      settledCount: 0,
      negativeCount: 0,
    });

    return NextResponse.json({
      success: true,
      tenant,
      reports: filteredReports,
      totals,
      dateRange: {
        from: dateFrom.toISOString().split('T')[0],
        to: dateTo.toISOString().split('T')[0],
      },
      period,
    });
  } catch (err) {
    console.error('Settlement report API error:', err);
    return NextResponse.json({ error: 'ไม่สามารถโหลดรายงานได้' }, { status: 500 });
  }
}

// POST - Confirm settlement (ยืนยันส่งยอด)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const supabase = await createClient();
    const body = await request.json();
    
    const {
      date, // วันที่ต้องการยืนยัน
      settlement_amount,
      deposits,
      withdrawals,
      bets_amount,
      win_amount,
      profit_loss,
      notes,
      approved_by, // ID ผู้ยืนยัน
    } = body;

    if (!date || settlement_amount === undefined) {
      return NextResponse.json({ error: 'กรุณาระบุวันที่และยอดส่ง' }, { status: 400 });
    }

    // Check if already settled
    const { data: existing } = await supabase
      .from('tenant_settlements')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('period_start', date)
      .single();

    if (existing?.status === 'approved') {
      return NextResponse.json({ error: 'รายการนี้ยืนยันไปแล้ว ไม่สามารถยืนยันซ้ำได้' }, { status: 400 });
    }

    // Create or update settlement record
    const settlementData = {
      tenant_id: tenantId,
      period_start: date,
      period_end: date,
      total_bets: bets_amount || 0,
      total_wins: win_amount || 0,
      total_deposits: deposits || 0,
      total_withdrawals: withdrawals || 0,
      net_profit: profit_loss || 0,
      settlement_amount: settlement_amount,
      status: 'approved' as const,
      submitted_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: approved_by || null,
      notes: notes || null,
    };

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('tenant_settlements')
        .update(settlementData)
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from('tenant_settlements')
        .insert(settlementData)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      message: 'ยืนยันส่งยอดสำเร็จ',
      settlement: result,
    });
  } catch (err) {
    console.error('Confirm settlement API error:', err);
    return NextResponse.json({ error: 'ไม่สามารถยืนยันส่งยอดได้' }, { status: 500 });
  }
}
