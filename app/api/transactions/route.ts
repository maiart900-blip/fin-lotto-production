import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

/**
 * Transactions API - AGENT OR HIGHER
 * Manages financial transactions (deposits, withdrawals, bets, wins)
 */
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher for viewing transactions
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // deposit, withdraw, bet, win
    const customer_id = searchParams.get('customer_id');
    
    // Build query
    let query = supabase
      .from('transactions')
      .select(`
        *,
        customer:customers(id, name, phone)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    
    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }
    
    const { data: transactions, error, count } = await query;
    
    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ 
        transactions: [],
        total: 0,
        error: error.message 
      });
    }
    
    // Calculate summary
    const { data: summaryData } = await supabase
      .from('transactions')
      .select('type, amount');
    
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
