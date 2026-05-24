import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch entries (betting transactions)
    const { data: entries } = await supabase
      .from('entries')
      .select('id, number, bet_type, amount, status, created_at, customer_id')
      .order('created_at', { ascending: false })
      .limit(100);

    // Fetch slip uploads (deposits)
    const { data: slips } = await supabase
      .from('slip_uploads')
      .select('id, amount, status, note, created_at, uploaded_by')
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch admin withdrawals
    const { data: withdrawals } = await supabase
      .from('admin_withdrawals')
      .select('id, amount, status, bank_name, account_number, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch topup requests
    const { data: topups } = await supabase
      .from('topup_requests')
      .select('id, amount, status, note, created_at, agent_id')
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch withdraw requests
    const { data: withdrawRequests } = await supabase
      .from('withdraw_requests')
      .select('id, amount, status, bank_name, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    // Combine all transactions
    const transactions = [
      // Entries as betting transactions
      ...(entries || []).map(e => ({
        id: e.id,
        type: 'entry',
        amount: Number(e.amount) || 0,
        status: e.status || 'completed',
        description: `${e.bet_type}: ${e.number}`,
        customer_name: null,
        created_at: e.created_at
      })),
      // Slip uploads as deposits
      ...(slips || []).map(s => ({
        id: s.id,
        type: 'deposit',
        amount: Number(s.amount) || 0,
        status: s.status || 'pending',
        description: s.note || 'ฝากเงินผ่านสลิป',
        customer_name: null,
        created_at: s.created_at
      })),
      // Admin withdrawals
      ...(withdrawals || []).map(w => ({
        id: w.id,
        type: 'withdraw',
        amount: Number(w.amount) || 0,
        status: w.status || 'pending',
        description: `ถอนไปยัง ${w.bank_name || 'ธนาคาร'}`,
        customer_name: null,
        created_at: w.created_at
      })),
      // Topup requests as deposits
      ...(topups || []).map(t => ({
        id: t.id,
        type: 'deposit',
        amount: Number(t.amount) || 0,
        status: t.status || 'pending',
        description: t.note || 'ขอเติมเครดิต',
        customer_name: null,
        created_at: t.created_at
      })),
      // Withdraw requests
      ...(withdrawRequests || []).map(w => ({
        id: w.id,
        type: 'withdraw',
        amount: Number(w.amount) || 0,
        status: w.status || 'pending',
        description: `ถอนไปยัง ${w.bank_name || 'ธนาคาร'}`,
        customer_name: null,
        created_at: w.created_at
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Calculate stats
    const stats = {
      total: transactions.length,
      deposits: transactions.filter(t => t.type === 'deposit').length,
      withdrawals: transactions.filter(t => t.type === 'withdraw').length,
      entries: transactions.filter(t => t.type === 'entry').length,
    };

    return NextResponse.json({
      transactions,
      stats
    });
  } catch (error) {
    console.error('Transactions all API error:', error);
    return NextResponse.json({
      transactions: [],
      stats: { total: 0, deposits: 0, withdrawals: 0, entries: 0 }
    });
  }
}
