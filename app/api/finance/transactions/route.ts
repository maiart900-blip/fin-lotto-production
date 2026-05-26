import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { getDataScope, applyFullDataScope, assertNoGlobalFallback } from '@/lib/data-scope';

/**
 * Financial Transactions API
 * ONLY money movement: deposits, withdrawals, transfers, adjustments, settlements
 * NOT betting activity
 * 
 * SECURITY: Data is scoped by tenant_id and agent_id
 */

export type FinancialTransactionType = 
  | 'deposit' 
  | 'withdrawal' 
  | 'transfer' 
  | 'adjustment' 
  | 'settlement' 
  | 'revenue_share' 
  | 'commission_payout' 
  | 'admin_balance_change'
  | 'provider_settlement'
  | 'fee'
  | 'refund'
  | 'bonus';

interface FinancialTransaction {
  id: string;
  type: FinancialTransactionType;
  amount: number;
  status: string;
  description?: string;
  reference_type?: string;
  reference_id?: string;
  customer_id?: string;
  customer_name?: string;
  tenant_id?: string;
  tenant_name?: string;
  bank_name?: string;
  account_number?: string;
  reconciliation_status?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    
    // Get data scope
    const scope = await getDataScope({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });
    
    // Block global fallback for agents
    assertNoGlobalFallback(scope);

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const customerId = searchParams.get('customer_id');
    const tenantId = searchParams.get('tenant_id');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const minAmount = searchParams.get('min_amount');
    const maxAmount = searchParams.get('max_amount');

    const transactions: FinancialTransaction[] = [];

    // 1. Deposits from slip_uploads - SCOPED
    let slipQuery = supabase
      .from('slip_uploads')
      .select(`
        id, amount, status, note, created_at, uploaded_by,
        bank_name, account_number, approved_by, approved_at, tenant_id, agent_id
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    slipQuery = applyFullDataScope(slipQuery, scope, {
      tenantColumn: 'tenant_id',
      agentColumn: 'agent_id',
    });
    
    const { data: slips } = await slipQuery;

    if (slips) {
      transactions.push(...slips.map(s => ({
        id: `slip-${s.id}`,
        type: 'deposit' as FinancialTransactionType,
        amount: Number(s.amount) || 0,
        status: s.status || 'pending',
        description: s.note || 'ฝากเงินผ่านสลิป',
        reference_type: 'slip_upload',
        reference_id: s.id,
        bank_name: s.bank_name,
        account_number: s.account_number,
        approved_by: s.approved_by,
        approved_at: s.approved_at,
        created_at: s.created_at,
      })));
    }

    // 2. Deposits from topup_requests - SCOPED
    let topupQuery = supabase
      .from('topup_requests')
      .select(`
        id, amount, status, note, created_at, agent_id, tenant_id,
        approved_by, approved_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    topupQuery = applyFullDataScope(topupQuery, scope, {
      tenantColumn: 'tenant_id',
      agentColumn: 'agent_id',
    });
    
    const { data: topups } = await topupQuery;

    if (topups) {
      transactions.push(...topups.map(t => ({
        id: `topup-${t.id}`,
        type: 'deposit' as FinancialTransactionType,
        amount: Number(t.amount) || 0,
        status: t.status || 'pending',
        description: t.note || 'ขอเติมเครดิต',
        reference_type: 'topup_request',
        reference_id: t.id,
        approved_by: t.approved_by,
        approved_at: t.approved_at,
        created_at: t.created_at,
      })));
    }

    // 3. Withdrawals from withdraw_requests
    const { data: withdrawRequests } = await supabase
      .from('withdraw_requests')
      .select(`
        id, amount, status, bank_name, account_number, created_at,
        customer_id, approved_by, approved_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (withdrawRequests) {
      transactions.push(...withdrawRequests.map(w => ({
        id: `withdraw-${w.id}`,
        type: 'withdrawal' as FinancialTransactionType,
        amount: Number(w.amount) || 0,
        status: w.status || 'pending',
        description: `ถอนไปยัง ${w.bank_name || 'ธนาคาร'}`,
        reference_type: 'withdraw_request',
        reference_id: w.id,
        customer_id: w.customer_id,
        bank_name: w.bank_name,
        account_number: w.account_number,
        approved_by: w.approved_by,
        approved_at: w.approved_at,
        created_at: w.created_at,
      })));
    }

    // 4. Admin withdrawals
    const { data: adminWithdrawals } = await supabase
      .from('admin_withdrawals')
      .select(`
        id, amount, status, bank_name, account_number, created_at,
        note, approved_by, approved_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (adminWithdrawals) {
      transactions.push(...adminWithdrawals.map(w => ({
        id: `admin-withdraw-${w.id}`,
        type: 'withdrawal' as FinancialTransactionType,
        amount: Number(w.amount) || 0,
        status: w.status || 'pending',
        description: w.note || `ถอนไปยัง ${w.bank_name || 'ธนาคาร'}`,
        reference_type: 'admin_withdrawal',
        reference_id: w.id,
        bank_name: w.bank_name,
        account_number: w.account_number,
        approved_by: w.approved_by,
        approved_at: w.approved_at,
        created_at: w.created_at,
      })));
    }

    // 5. Credit adjustments
    const { data: creditLogs } = await supabase
      .from('credit_logs')
      .select(`
        id, amount, type, reason, created_at, created_by,
        customer_id, previous_balance, new_balance
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (creditLogs) {
      transactions.push(...creditLogs.map(c => ({
        id: `credit-${c.id}`,
        type: 'adjustment' as FinancialTransactionType,
        amount: Number(c.amount) || 0,
        status: 'completed',
        description: c.reason || `ปรับยอดเครดิต: ${c.type}`,
        reference_type: 'credit_log',
        reference_id: c.id,
        customer_id: c.customer_id,
        created_at: c.created_at,
      })));
    }

    // 6. Settlement transactions
    const { data: settlements } = await supabase
      .from('settlement_transactions')
      .select(`
        id, cycle_id, tenant_id, transaction_type, gross_amount,
        net_amount, status, created_at, paid_at
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (settlements) {
      transactions.push(...settlements.map(s => ({
        id: `settlement-${s.id}`,
        type: (s.transaction_type === 'tenant_share' ? 'revenue_share' : 
               s.transaction_type === 'provider_share' ? 'provider_settlement' : 
               'settlement') as FinancialTransactionType,
        amount: Number(s.net_amount) || 0,
        status: s.status || 'pending',
        description: `Settlement: ${s.transaction_type}`,
        reference_type: 'settlement_transaction',
        reference_id: s.id,
        tenant_id: s.tenant_id,
        created_at: s.created_at,
      })));
    }

    // 7. Commission transfers
    const { data: commissions } = await supabase
      .from('commission_transfers')
      .select(`
        id, amount, status, agent_id, created_at, approved_at, bank_name
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (commissions) {
      transactions.push(...commissions.map(c => ({
        id: `commission-${c.id}`,
        type: 'commission_payout' as FinancialTransactionType,
        amount: Number(c.amount) || 0,
        status: c.status || 'pending',
        description: 'จ่ายคอมมิชชั่น',
        reference_type: 'commission_transfer',
        reference_id: c.id,
        bank_name: c.bank_name,
        created_at: c.created_at,
      })));
    }

    // Apply filters
    let filtered = transactions;

    if (type) {
      filtered = filtered.filter(t => t.type === type);
    }
    if (customerId) {
      filtered = filtered.filter(t => t.customer_id === customerId);
    }
    if (tenantId) {
      filtered = filtered.filter(t => t.tenant_id === tenantId);
    }
    if (status) {
      filtered = filtered.filter(t => t.status === status);
    }
    if (dateFrom) {
      filtered = filtered.filter(t => new Date(t.created_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(t => new Date(t.created_at) <= new Date(dateTo));
    }
    if (minAmount) {
      filtered = filtered.filter(t => t.amount >= Number(minAmount));
    }
    if (maxAmount) {
      filtered = filtered.filter(t => t.amount <= Number(maxAmount));
    }

    // Sort by date
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Paginate
    const paginated = filtered.slice(offset, offset + limit);

    // Calculate dashboard stats
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = filtered.filter(t => t.created_at.startsWith(today));

    const stats = {
      totalDeposits: filtered.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
      totalWithdrawals: filtered.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0),
      pendingPayouts: filtered.filter(t => ['withdrawal', 'commission_payout'].includes(t.type) && t.status === 'pending').reduce((sum, t) => sum + t.amount, 0),
      settlementVolume: filtered.filter(t => ['settlement', 'revenue_share', 'provider_settlement'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0),
      todayDeposits: todayTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
      todayWithdrawals: todayTransactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0),
      pendingCount: filtered.filter(t => t.status === 'pending').length,
      completedCount: filtered.filter(t => t.status === 'completed' || t.status === 'approved').length,
    };

    return NextResponse.json({
      success: true,
      transactions: paginated,
      total: filtered.length,
      stats,
    });
  } catch (error) {
    console.error('Financial Transactions API error:', error);
    return NextResponse.json({ 
      success: false,
      transactions: [],
      total: 0,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { action } = body;

    // Export functionality
    if (action === 'export') {
      const { format = 'csv', ...filters } = body;
      
      // Re-fetch with filters for export
      const response = await fetch(`${request.url}?${new URLSearchParams(filters).toString()}`);
      const data = await response.json();
      
      if (format === 'csv') {
        const headers = ['ID', 'Type', 'Amount', 'Status', 'Description', 'Date'];
        const rows = data.transactions.map((t: FinancialTransaction) => [
          t.id,
          t.type,
          t.amount,
          t.status,
          t.description || '',
          t.created_at,
        ]);
        
        const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="financial-transactions-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });
      }
      
      return NextResponse.json(data);
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Financial Transactions POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
