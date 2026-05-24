import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get detailed stats for a specific tenant (from real data)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // Date range params
    const startDate = searchParams.get('start_date') || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'ไม่พบเว็บลูก' }, { status: 404 });
    }

    // Get customer count for this tenant
    const { count: customerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Get total deposits for this tenant
    const { data: depositsData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59');

    const totalDeposits = depositsData?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

    // Get total withdrawals for this tenant
    const { data: withdrawalsData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('type', 'withdrawal')
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59');

    const totalWithdrawals = withdrawalsData?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

    // Get total bets amount for this tenant from bets table
    const { data: betsData } = await supabase
      .from('bets')
      .select('total_amount, total_win_amount, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59');

    const totalBetsAmount = betsData?.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) || 0;
    const totalWinAmount = betsData?.reduce((sum, b) => sum + (Number(b.total_win_amount) || 0), 0) || 0;

    // Calculate profit/loss and settlement amount
    // กำไร/ขาดทุน = ยอดแทงรวม - ยอดถูกรางวัลรวม
    const profitLoss = totalBetsAmount - totalWinAmount;
    
    // ยอดส่งเว็บแม่ = ยอดฝากรวม - ยอดถูกรางวัลรวม
    const settlementAmount = totalDeposits - totalWinAmount;

    // Get recent transactions
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent bets
    const { data: recentBets } = await supabase
      .from('bets')
      .select(`
        id, customer_name, total_amount, total_win_amount, status, created_at,
        lottery:lotteries(name)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get pending settlement amount (unsettled)
    const { data: pendingSettlements } = await supabase
      .from('tenant_settlements')
      .select('settlement_amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');

    const pendingSettlementAmount = pendingSettlements?.reduce((sum, s) => sum + (Number(s.settlement_amount) || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      tenant,
      stats: {
        customerCount: customerCount || 0,
        totalDeposits,
        totalWithdrawals,
        totalBetsAmount,
        totalWinAmount,
        profitLoss,
        settlementAmount,
        pendingSettlementAmount,
        // Status flags
        isNegative: settlementAmount < 0,
        statusText: settlementAmount >= 0 ? 'ยอดต้องส่งเว็บแม่' : 'เว็บแม่ต้องจ่ายคืนเว็บลูก',
      },
      recentTransactions: recentTransactions || [],
      recentBets: recentBets || [],
      dateRange: { startDate, endDate },
    });
  } catch (err) {
    console.error('Tenant stats API error:', err);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}

// POST - Update tenant stats (called from sub-sites)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      total_bets,
      total_payouts,
      total_deposits,
      total_withdrawals,
      active_users,
      new_users
    } = body;

    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // Upsert stats for today
    const { data, error } = await supabase
      .from('tenant_stats')
      .upsert({
        tenant_id: id,
        stat_date: today,
        total_bets: total_bets || 0,
        total_payouts: total_payouts || 0,
        total_deposits: total_deposits || 0,
        total_withdrawals: total_withdrawals || 0,
        profit_loss: (total_bets || 0) - (total_payouts || 0),
        active_users: active_users || 0,
        new_users: new_users || 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,stat_date'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Update tenant stats error:', err);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตสถิติได้' }, { status: 500 });
  }
}
