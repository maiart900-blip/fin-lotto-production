import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const range = searchParams.get('range') || 'today';
    
    const offset = (page - 1) * limit;
    
    // Calculate date range
    let startDate: string;
    const now = new Date();
    
    switch (range) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
        break;
      case 'month':
        startDate = new Date(now.setDate(1)).toISOString();
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    }

    // Get commission logs with customer and lottery info
    const { data: logs, error, count } = await supabase
      .from('commission_logs')
      .select(`
        id,
        bet_amount,
        bet_type,
        commission_rate,
        commission_amount,
        status,
        created_at,
        customers!inner(name),
        lotteries!inner(name)
      `, { count: 'exact' })
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Transform data
    const transformedLogs = logs?.map((log: any) => ({
      id: log.id,
      customer_name: log.customers?.name || 'Unknown',
      lottery_name: log.lotteries?.name || 'Unknown',
      bet_amount: log.bet_amount,
      bet_type: log.bet_type,
      commission_rate: log.commission_rate,
      commission_amount: log.commission_amount,
      status: log.status,
      created_at: log.created_at
    })) || [];

    return NextResponse.json({
      logs: transformedLogs,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    console.error('Commission logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission logs' },
      { status: 500 }
    );
  }
}
