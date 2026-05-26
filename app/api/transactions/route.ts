import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { getDataScope, applyFullDataScope, assertNoGlobalFallback } from '@/lib/data-scope';
import { requireCustomerAccess } from '@/lib/customer-scope';

/**
 * Transactions API - AGENT OR HIGHER
 * Manages financial transactions (deposits, withdrawals, bets, wins)
 * 
 * SECURITY: Data is scoped by tenant_id and agent_id
 */
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher for viewing transactions
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
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type');
    const customer_id = searchParams.get('customer_id');
    
    // If specific customer, verify access
    if (customer_id) {
      const accessCheck = await requireCustomerAccess(customer_id, {
        id: session.id,
        role: session.role,
        user_type: session.user_type,
        tenant_id: session.tenant_id,
      });
      if (!accessCheck.allowed) {
        return NextResponse.json({ transactions: [], total: 0 });
      }
    }
    
    // Build query
    let query = supabase
      .from('transactions')
      .select(`
        *,
        customer:customers(id, name, phone, tenant_id, agent_id)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // SECURITY: Apply data scope
    query = applyFullDataScope(query, scope, {
      tenantColumn: 'tenant_id',
      agentColumn: 'agent_id',
      excludeNullTenant: true,
      excludeNullAgent: scope.isAgent,
    });
    
    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    
    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }
    
    const { data: transactions, error, count } = await query;
    
    if (error) {
      return NextResponse.json({ 
        transactions: [],
        total: 0,
        error: error.message 
      });
    }
    
    // Calculate summary - also scoped
    let summaryQuery = supabase
      .from('transactions')
      .select('type, amount');
    
    summaryQuery = applyFullDataScope(summaryQuery, scope, {
      tenantColumn: 'tenant_id',
      agentColumn: 'agent_id',
    });
    
    const { data: summaryData } = await summaryQuery;
    
    const summary = {
      totalDeposits: 0,
      totalWithdraws: 0,
      totalBets: 0,
      totalWins: 0,
    };
    
    if (summaryData) {
      summaryData.forEach((t: any) => {
        const amount = Number(t.amount);
        switch (t.type) {
          case 'deposit':
            summary.totalDeposits += amount;
            break;
          case 'withdraw':
            summary.totalWithdraws += amount;
            break;
          case 'bet':
            summary.totalBets += amount;
            break;
          case 'win':
            summary.totalWins += amount;
            break;
        }
      });
    }
    
    return NextResponse.json({
      transactions: transactions || [],
      total: count || transactions?.length || 0,
      summary,
    });
  } catch (error) {
    console.error('Transactions API error:', error);
    return NextResponse.json({ 
      transactions: [],
      total: 0,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth guard - require agent or higher for creating transactions
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    
    const { customer_id, type, amount, description, reference_id, status = 'completed' } = body;
    
    if (!customer_id || !type || !amount) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: customer_id, type, amount' 
      }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        customer_id,
        type,
        amount,
        description,
        reference_id,
        status,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating transaction:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      transaction: data,
    });
  } catch (error) {
    console.error('Transactions POST error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
