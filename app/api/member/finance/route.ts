import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get entries (betting transactions)
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    // Get slip uploads as transactions
    const { data: slips } = await supabase
      .from('slip_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Get withdrawals
    const { data: withdrawals } = await supabase
      .from('admin_withdrawals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate totals from entries
    const totalEntries = entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

    // Calculate totals from slips and withdrawals
    const approvedSlips = slips?.filter(s => s.status === 'approved') || [];
    const approvedWithdrawals = withdrawals?.filter(w => w.status === 'approved') || [];
    const pendingWithdrawals = withdrawals?.filter(w => w.status === 'pending') || [];

    const totalDeposit = approvedSlips.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const totalWithdraw = approvedWithdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
    const pendingWithdraw = pendingWithdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

    // Commission based on entries (10% of total bets)
    const totalCommission = Math.round(totalEntries * 0.1);
    
    // Calculate balance
    const balance = totalDeposit - totalWithdraw + totalCommission;

    // Combine transactions including entries
    const transactions = [
      ...(entries || []).map(e => ({
        id: e.id,
        type: 'bet' as const,
        amount: Number(e.amount) || 0,
        status: 'completed',
        description: `แทงหวย: ${e.number} (${e.bet_type})`,
        created_at: e.created_at
      })),
      ...(slips || []).map(s => ({
        id: s.id,
        type: 'deposit' as const,
        amount: Number(s.amount) || 0,
        status: s.status,
        description: s.note || 'ฝากเงิน',
        created_at: s.created_at
      })),
      ...(withdrawals || []).map(w => ({
        id: w.id,
        type: 'withdraw' as const,
        amount: Number(w.amount) || 0,
        status: w.status,
        description: `ถอนไปยัง ${w.bank_name}`,
        created_at: w.created_at
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      balance,
      totalDeposit,
      totalWithdraw,
      totalCommission,
      pendingWithdraw,
      totalBets: totalEntries,
      transactions
    });
  } catch (error) {
    console.error('Member finance error:', error);
    return NextResponse.json({
      balance: 0,
      totalDeposit: 0,
      totalWithdraw: 0,
      totalCommission: 0,
      pendingWithdraw: 0,
      totalBets: 0,
      transactions: []
    });
  }
}
