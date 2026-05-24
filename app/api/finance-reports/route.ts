import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'today':
      default:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    // Fetch deposits
    const { data: deposits } = await supabase
      .from('topup_requests')
      .select('amount, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const depositData = {
      total: deposits?.filter(d => d.status === 'approved').reduce((sum, d) => sum + (d.amount || 0), 0) || 0,
      count: deposits?.filter(d => d.status === 'approved').length || 0,
      pending: deposits?.filter(d => d.status === 'pending').length || 0,
    };

    // Fetch withdrawals
    const { data: withdrawals } = await supabase
      .from('withdraw_requests')
      .select('amount, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const withdrawalData = {
      total: withdrawals?.filter(w => w.status === 'approved' || w.status === 'completed').reduce((sum, w) => sum + (w.amount || 0), 0) || 0,
      count: withdrawals?.filter(w => w.status === 'approved' || w.status === 'completed').length || 0,
      pending: withdrawals?.filter(w => w.status === 'pending').length || 0,
    };

    // Fetch entries (bets)
    const { data: entries } = await supabase
      .from('entries')
      .select('total_amount, status, payout_amount')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const betsData = {
      total: entries?.reduce((sum, e) => sum + (e.total_amount || 0), 0) || 0,
      count: entries?.length || 0,
    };

    const payoutsData = {
      total: entries?.filter(e => e.status === 'won').reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0,
      count: entries?.filter(e => e.status === 'won').length || 0,
    };

    // Calculate profit
    const profit = betsData.total - payoutsData.total;

    // Build recent transactions list
    const transactions: Array<{
      id: string;
      type: string;
      amount: number;
      status: string;
      description: string;
      created_at: string;
    }> = [];

    // Add deposits to transactions
    deposits?.forEach(d => {
      transactions.push({
        id: `dep-${Math.random()}`,
        type: 'deposit',
        amount: d.amount || 0,
        status: d.status === 'approved' ? 'completed' : d.status,
        description: 'เติมเงิน',
        created_at: new Date().toISOString(),
      });
    });

    // Add withdrawals to transactions
    withdrawals?.forEach(w => {
      transactions.push({
        id: `wd-${Math.random()}`,
        type: 'withdraw',
        amount: w.amount || 0,
        status: w.status === 'approved' || w.status === 'completed' ? 'completed' : w.status,
        description: 'ถอนเงิน',
        created_at: new Date().toISOString(),
      });
    });

    // Sort by date (most recent first)
    transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      deposits: depositData,
      withdrawals: withdrawalData,
      bets: betsData,
      payouts: payoutsData,
      profit,
      transactions: transactions.slice(0, 20),
    });
  } catch (error) {
    console.error('Error fetching finance reports:', error);
    return NextResponse.json({
      deposits: { total: 0, count: 0, pending: 0 },
      withdrawals: { total: 0, count: 0, pending: 0 },
      bets: { total: 0, count: 0 },
      payouts: { total: 0, count: 0 },
      profit: 0,
      transactions: [],
    });
  }
}
