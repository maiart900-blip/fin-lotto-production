import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext } from '@/lib/agent-context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const targetAgentId = searchParams.get('agent_id'); // admin only

    // identity จาก session (ไม่รับ agent_id เป็น identity)
    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;

    const supabase = await createClient();

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

    // Get commission logs (คอลัมน์จริง: amount, rate, base_amount, commission_type)
    let query = supabase
      .from('commission_logs')
      .select(`
        id,
        base_amount,
        commission_type,
        rate,
        amount,
        status,
        created_at,
        customers!commission_logs_customer_id_fkey(name)
      `, { count: 'exact' })
      .gte('created_at', startDate)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Scope: agent ธรรมดาเห็นเฉพาะของตน; admin ที่ไม่ระบุ target เห็นภาพรวม
    const scopeToAgent = !context.isAdmin || Boolean(targetAgentId);
    if (scopeToAgent) {
      query = query.eq('agent_id', context.agentId);
    }

    const { data: logs, error, count } = await query;

    if (error) {
      throw error;
    }

    // Transform data
    const transformedLogs = logs?.map((log: any) => ({
      id: log.id,
      customer_name: log.customers?.name || 'Unknown',
      bet_amount: log.base_amount,
      commission_type: log.commission_type,
      commission_rate: log.rate,
      commission_amount: log.amount,
      status: log.status,
      created_at: log.created_at,
    })) || [];

    return NextResponse.json({
      logs: transformedLogs,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('Commission logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission logs' },
      { status: 500 }
    );
  }
}
