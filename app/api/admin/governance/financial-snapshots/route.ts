import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-auth';

// GET - ดึง financial snapshots
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const branchId = searchParams.get('branch_id');
    const limit = parseInt(searchParams.get('limit') || '30');

    let query = supabase
      .from('financial_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(limit);

    if (startDate) {
      query = query.gte('snapshot_date', startDate);
    }
    if (endDate) {
      query = query.lte('snapshot_date', endDate);
    }
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching financial snapshots:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch financial snapshots' },
      { status: 500 }
    );
  }
}

// POST - สร้าง financial snapshot สำหรับวันนี้
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const snapshotDate = body.snapshot_date || new Date().toISOString().split('T')[0];
    const branchId = body.branch_id || null;

    // ดึงข้อมูลสรุปจาก customers
    const { data: customerStats } = await supabase
      .from('customers')
      .select('credit_balance, created_at')
      .eq('is_active', true);

    const totalCreditBalance = customerStats?.reduce((sum, c) => sum + (Number(c.credit_balance) || 0), 0) || 0;
    const today = new Date().toISOString().split('T')[0];
    const newCustomers = customerStats?.filter(c => c.created_at?.startsWith(today)).length || 0;
    const activeCustomers = customerStats?.length || 0;

    // ดึงข้อมูลฝาก/ถอนวันนี้
    const { data: deposits } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'deposit')
      .eq('status', 'approved')
      .gte('created_at', `${snapshotDate}T00:00:00`)
      .lte('created_at', `${snapshotDate}T23:59:59`);

    const { data: withdrawals } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'withdraw')
      .eq('status', 'approved')
      .gte('created_at', `${snapshotDate}T00:00:00`)
      .lte('created_at', `${snapshotDate}T23:59:59`);

    const { data: pendingWithdrawals } = await supabase
      .from('transactions')
      .select('amount')
      .eq('type', 'withdraw')
      .eq('status', 'pending');

    // ดึงข้อมูลยอดแทง/จ่ายวันนี้
    const { data: bets } = await supabase
      .from('entries')
      .select('amount, status')
      .gte('created_at', `${snapshotDate}T00:00:00`)
      .lte('created_at', `${snapshotDate}T23:59:59`);

    const totalDeposits = deposits?.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) || 0;
    const totalWithdrawals = withdrawals?.reduce((sum, w) => sum + (Number(w.amount) || 0), 0) || 0;
    const pendingWithdrawalsAmount = pendingWithdrawals?.reduce((sum, w) => sum + (Number(w.amount) || 0), 0) || 0;
    const pendingWithdrawalsCount = pendingWithdrawals?.length || 0;
    const totalBets = bets?.reduce((sum, b) => sum + (Number(b.amount) || 0), 0) || 0;
    const totalPayouts = bets?.filter(b => b.status === 'won').reduce((sum, b) => sum + (Number(b.amount) || 0), 0) || 0;
    const grossProfit = totalBets - totalPayouts;

    // ดึงข้อมูล credit lines
    const { data: creditLines } = await supabase
      .from('credit_lines')
      .select('credit_limit, credit_used')
      .eq('status', 'active');

    const totalCreditLines = creditLines?.reduce((sum, c) => sum + (Number(c.credit_limit) || 0), 0) || 0;
    const totalCreditUsed = creditLines?.reduce((sum, c) => sum + (Number(c.credit_used) || 0), 0) || 0;

    // Upsert snapshot
    const { data, error } = await supabase
      .from('financial_snapshots')
      .upsert({
        snapshot_date: snapshotDate,
        total_credit_balance: totalCreditBalance,
        total_deposits: totalDeposits,
        total_withdrawals: totalWithdrawals,
        total_bets: totalBets,
        total_payouts: totalPayouts,
        gross_profit: grossProfit,
        pending_withdrawals: pendingWithdrawalsAmount,
        pending_withdrawals_count: pendingWithdrawalsCount,
        total_credit_lines: totalCreditLines,
        total_credit_used: totalCreditUsed,
        active_customers: activeCustomers,
        new_customers: newCustomers,
        branch_id: branchId,
      }, { onConflict: 'snapshot_date' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating financial snapshot:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create financial snapshot' },
      { status: 500 }
    );
  }
}
