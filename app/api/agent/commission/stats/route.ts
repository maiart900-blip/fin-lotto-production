import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext } from '@/lib/agent-context';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const targetAgentId = request.nextUrl.searchParams.get('agent_id'); // admin only

    // identity จาก session
    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;

    const supabase = await createClient();

    // helper: query commission_logs ที่ scope ตาม agent เสมอ
    const scopeToAgent = !context.isAdmin || Boolean(targetAgentId);
    const scoped = () => {
      const q = supabase.from('commission_logs');
      return q;
    };
    const applyScope = (q: any) => (scopeToAgent ? q.eq('agent_id', context.agentId) : q);

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const yesterdayStart = new Date(now.setDate(now.getDate() - 1)).toISOString();
    const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString();
    const monthStart = new Date(now.setDate(1)).toISOString();

    const sumAmount = (rows: any[] | null) =>
      rows?.reduce((sum, log) => sum + Number(log.amount || 0), 0) || 0;

    // Today
    const { data: todayData } = await applyScope(
      scoped().select('amount').gte('created_at', todayStart)
    );
    const today = sumAmount(todayData);

    // Yesterday
    const { data: yesterdayData } = await applyScope(
      scoped().select('amount').gte('created_at', yesterdayStart).lt('created_at', todayStart)
    );
    const yesterday = sumAmount(yesterdayData);

    // Week
    const { data: weekData } = await applyScope(
      scoped().select('amount').gte('created_at', weekStart)
    );
    const thisWeek = sumAmount(weekData);

    // Month
    const { data: monthData } = await applyScope(
      scoped().select('amount').gte('created_at', monthStart)
    );
    const thisMonth = sumAmount(monthData);

    // Total
    const { data: totalData } = await applyScope(scoped().select('amount'));
    const total = sumAmount(totalData);

    // Pending
    const { data: pendingData } = await applyScope(
      scoped().select('amount').eq('status', 'pending')
    );
    const pending = sumAmount(pendingData);

    // Trend (last 7 days)
    const trend: Array<{ date: string; amount: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0)).toISOString();
      const dayEnd = new Date(date.setHours(23, 59, 59, 999)).toISOString();

      const { data: dayData } = await applyScope(
        scoped().select('amount').gte('created_at', dayStart).lte('created_at', dayEnd)
      );
      trend.push({
        date: date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        amount: sumAmount(dayData),
      });
    }

    // แยกตามประเภทคอมมิชชั่น (commission_logs ไม่มี lottery_id จึงจัดกลุ่มด้วย commission_type)
    const { data: byTypeData } = await applyScope(
      scoped().select('amount, commission_type').gte('created_at', monthStart)
    );
    const byTypeMap: Record<string, number> = {};
    byTypeData?.forEach((log: any) => {
      const name = log.commission_type || 'อื่นๆ';
      byTypeMap[name] = (byTypeMap[name] || 0) + Number(log.amount || 0);
    });
    const byType = Object.entries(byTypeMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return NextResponse.json({
      today,
      yesterday,
      thisWeek,
      thisMonth,
      total,
      pending,
      trend,
      byType,
    });
  } catch (error) {
    console.error('Commission stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission stats' },
      { status: 500 }
    );
  }
}
