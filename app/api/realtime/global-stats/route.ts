import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();

  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // 1. Get total deposits today
    const { data: deposits, error: depositsError } = await supabase
      .from('transactions')
      .select('amount, tenant_id')
      .eq('type', 'deposit')
      .eq('status', 'approved')
      .gte('created_at', todayISO);

    // 2. Get total withdrawals today
    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from('transactions')
      .select('amount, tenant_id')
      .eq('type', 'withdraw')
      .eq('status', 'approved')
      .gte('created_at', todayISO);

    // 3. Get total bets today from entries
    const { data: bets, error: betsError } = await supabase
      .from('entries')
      .select('total_amount, win_amount, status, tenant_id, customer_id, created_at')
      .gte('created_at', todayISO);

    // 4. Get active customers count
    const { count: activeCustomers } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    // 5. Get all tenants for breakdown
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name, domain, is_active')
      .eq('is_active', true);

    // Calculate totals
    const totalDeposits = deposits?.reduce((sum, d) => sum + Number(d.amount || 0), 0) || 0;
    const totalWithdrawals = withdrawals?.reduce((sum, w) => sum + Number(w.amount || 0), 0) || 0;
    const totalBets = bets?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0;
    const totalPayouts = bets?.filter(b => b.status === 'won')
      .reduce((sum, b) => sum + Number(b.win_amount || 0), 0) || 0;

    // Calculate per-tenant breakdown
    const tenantBreakdown = tenants?.map(tenant => {
      const tenantDeposits = deposits?.filter(d => d.tenant_id === tenant.id)
        .reduce((sum, d) => sum + Number(d.amount || 0), 0) || 0;
      const tenantWithdrawals = withdrawals?.filter(w => w.tenant_id === tenant.id)
        .reduce((sum, w) => sum + Number(w.amount || 0), 0) || 0;
      const tenantBets = bets?.filter(b => b.tenant_id === tenant.id)
        .reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0;
      const tenantPayouts = bets?.filter(b => b.tenant_id === tenant.id && b.status === 'won')
        .reduce((sum, b) => sum + Number(b.win_amount || 0), 0) || 0;

      return {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        deposits: tenantDeposits,
        withdrawals: tenantWithdrawals,
        bets: tenantBets,
        payouts: tenantPayouts,
        netProfit: tenantBets - tenantPayouts,
        isActive: tenant.is_active,
      };
    }) || [];

    // Get recent activity (last 50 transactions/bets)
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select(`
        id,
        type,
        amount,
        status,
        created_at,
        tenant_id,
        customer:customers(name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(25);

    const { data: recentBets } = await supabase
      .from('entries')
      .select(`
        id,
        total_amount,
        status,
        created_at,
        tenant_id,
        customer:customers(name, phone),
        lottery:lotteries(name)
      `)
      .order('created_at', { ascending: false })
      .limit(25);

    // Merge and sort activity
    const activity = [
      ...(recentTransactions?.map((t: any) => {
        const customer = Array.isArray(t.customer) ? t.customer[0] : t.customer;
        return {
          id: t.id,
          type: t.type === 'deposit' ? 'deposit' : 'withdraw',
          amount: Number(t.amount),
          status: t.status,
          createdAt: t.created_at,
          tenantId: t.tenant_id,
          customerName: customer?.name || 'ไม่ระบุ',
          customerPhone: customer?.phone,
        };
      }) || []),
      ...(recentBets?.map((b: any) => {
        const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer;
        const lottery = Array.isArray(b.lottery) ? b.lottery[0] : b.lottery;
        return {
          id: b.id,
          type: 'bet',
          amount: Number(b.total_amount),
          status: b.status,
          createdAt: b.created_at,
          tenantId: b.tenant_id,
          customerName: customer?.name || 'ไม่ระบุ',
          lotteryName: lottery?.name,
        };
      }) || []),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return NextResponse.json({
      success: true,
      stats: {
        totalDeposits,
        totalWithdrawals,
        totalBets,
        totalPayouts,
        netProfit: totalBets - totalPayouts,
        activeCustomers: activeCustomers || 0,
        activeTenants: tenants?.length || 0,
      },
      tenantBreakdown,
      activity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch global stats' },
      { status: 500 }
    );
  }
}
