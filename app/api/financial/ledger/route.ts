/**
 * Financial Ledger API
 * Transaction management and account queries
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { 
  getFinancialLedger, 
  recordDeposit, 
  recordWithdrawal, 
  recordPayout,
  recordBet,
} from '@/lib/financial-ledger';
import { auditLogger } from '@/lib/audit-logger';

export async function GET(request: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'accounts';
    
    const ledger = getFinancialLedger();
    
    switch (action) {
      case 'accounts': {
        // List accounts
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const accountType = searchParams.get('type');
        const entityType = searchParams.get('entity_type');
        
        let query = supabase
          .from('ledger_accounts')
          .select('*')
          .order('code', { ascending: true });
        
        if (accountType) query = query.eq('account_type', accountType);
        if (entityType) query = query.eq('entity_type', entityType);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        return NextResponse.json({ success: true, data });
      }
      
      case 'transactions': {
        // List transactions
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const entityId = searchParams.get('entity_id');
        
        let query = supabase
          .from('ledger_transactions')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (status) query = query.eq('status', status);
        if (type) query = query.eq('transaction_type', type);
        if (entityId) query = query.eq('entity_id', entityId);
        
        const { data, count, error } = await query;
        
        if (error) throw error;
        
        return NextResponse.json({
          success: true,
          data,
          pagination: { total: count, limit, offset },
        });
      }
      
      case 'transaction': {
        // Get single transaction with entries
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json(
            { success: false, error: 'Transaction ID required' },
            { status: 400 }
          );
        }
        
        const result = await ledger.getTransaction(id);
        if (!result) {
          return NextResponse.json(
            { success: false, error: 'Transaction not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({ success: true, data: result });
      }
      
      case 'statement': {
        // Get account statement
        const accountId = searchParams.get('account_id');
        if (!accountId) {
          return NextResponse.json(
            { success: false, error: 'Account ID required' },
            { status: 400 }
          );
        }
        
        const startDate = searchParams.get('start_date')
          ? new Date(searchParams.get('start_date')!)
          : undefined;
        const endDate = searchParams.get('end_date')
          ? new Date(searchParams.get('end_date')!)
          : undefined;
        const limit = parseInt(searchParams.get('limit') || '100');
        
        const statement = await ledger.getAccountStatement(
          accountId,
          startDate,
          endDate,
          limit
        );
        
        return NextResponse.json({ success: true, data: statement });
      }
      
      case 'reconcile': {
        // Run reconciliation
        const result = await ledger.reconcileAccounts();
        return NextResponse.json({ success: true, data: result });
      }
      
      case 'summary': {
        // Daily financial summary
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { data, error } = await supabase
          .from('v_daily_financial_summary')
          .select('*')
          .limit(100);
        
        if (error) throw error;
        
        return NextResponse.json({ success: true, data });
      }
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Financial Ledger API Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;
  
  try {
    const body = await request.json();
    const { action, ...params } = body;
    
    let result;
    
    switch (action) {
      case 'deposit': {
        const { entityType, entityId, amount, referenceId, description, idempotencyKey } = params;
        
        if (!entityType || !entityId || !amount) {
          return NextResponse.json(
            { success: false, error: 'entityType, entityId, and amount required' },
            { status: 400 }
          );
        }
        
        result = await recordDeposit(entityType, entityId, amount, {
          referenceId,
          description,
          createdBy: user?.id,
          idempotencyKey,
        });
        
        await auditLogger.logFinancial(
          user?.id || 'system',
          'deposit',
          amount,
          { entityType, entityId, transactionId: result.id }
        );
        break;
      }
      
      case 'withdrawal': {
        const { entityType, entityId, amount, referenceId, description, idempotencyKey } = params;
        
        if (!entityType || !entityId || !amount) {
          return NextResponse.json(
            { success: false, error: 'entityType, entityId, and amount required' },
            { status: 400 }
          );
        }
        
        result = await recordWithdrawal(entityType, entityId, amount, {
          referenceId,
          description,
          createdBy: user?.id,
          idempotencyKey,
        });
        
        await auditLogger.logFinancial(
          user?.id || 'system',
          'withdrawal',
          amount,
          { entityType, entityId, transactionId: result.id }
        );
        break;
      }
      
      case 'payout': {
        const { entityType, entityId, amount, referenceId, description, idempotencyKey } = params;
        
        if (!entityType || !entityId || !amount) {
          return NextResponse.json(
            { success: false, error: 'entityType, entityId, and amount required' },
            { status: 400 }
          );
        }
        
        result = await recordPayout(entityType, entityId, amount, {
          referenceId,
          description,
          createdBy: user?.id,
          idempotencyKey,
        });
        
        await auditLogger.logFinancial(
          user?.id || 'system',
          'payout',
          amount,
          { entityType, entityId, transactionId: result.id }
        );
        break;
      }
      
      case 'bet': {
        const { entityType, entityId, amount, referenceId, description, idempotencyKey } = params;
        
        if (!entityType || !entityId || !amount) {
          return NextResponse.json(
            { success: false, error: 'entityType, entityId, and amount required' },
            { status: 400 }
          );
        }
        
        result = await recordBet(entityType, entityId, amount, {
          referenceId,
          description,
          createdBy: user?.id,
          idempotencyKey,
        });
        
        await auditLogger.logFinancial(
          user?.id || 'system',
          'bet',
          amount,
          { entityType, entityId, transactionId: result.id }
        );
        break;
      }
      
      case 'reverse': {
        const { transactionId, reason } = params;
        
        if (!transactionId || !reason) {
          return NextResponse.json(
            { success: false, error: 'transactionId and reason required' },
            { status: 400 }
          );
        }
        
        const ledger = getFinancialLedger();
        result = await ledger.reverseTransaction(transactionId, reason, user?.id);
        
        await auditLogger.logFinancial(
          user?.id || 'system',
          'reversal',
          result.amount,
          { originalTransactionId: transactionId, reversalId: result.id, reason }
        );
        break;
      }
      
      case 'snapshot': {
        // Create daily balance snapshot
        const { date } = params;
        const ledger = getFinancialLedger();
        const created = await ledger.createDailySnapshot(date ? new Date(date) : new Date());
        
        result = { snapshots_created: created };
        
        await auditLogger.logAdmin(
          user?.id || 'system',
          'create',
          'balance_snapshot',
          undefined,
          { date, created }
        );
        break;
      }
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Financial Ledger API Error]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
