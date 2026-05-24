import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const yesterdayStart = new Date(now.setDate(now.getDate() - 1)).toISOString();
    const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString();
    const monthStart = new Date(now.setDate(1)).toISOString();

    // Get today's commission
    const { data: todayData } = await supabase
      .from('commission_logs')
      .select('commission_amount')
      .gte('created_at', todayStart);

    const today = todayData?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;

    // Get yesterday's commission
    const { data: yesterdayData } = await supabase
      .from('commission_logs')
      .select('commission_amount')
      .gte('created_at', yesterdayStart)
      .lt('created_at', todayStart);

    const yesterday = yesterdayData?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;

    // Get week's commission
    const { data: weekData } = await supabase
      .from('commission_logs')
      .select('commission_amount')
      .gte('created_at', weekStart);

    const thisWeek = weekData?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;

    // Get month's commission
    const { data: monthData } = await supabase
      .from('commission_logs')
      .select('commission_amount')
      .gte('created_at', monthStart);

    const thisMonth = monthData?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;

    // Get total commission
    const { data: totalData } = await supabase
      .from('commission_logs')
      .select('commission_amount');

    const total = totalData?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;

    // Get pending commission
    const { data: pendingData } = await supabase
      .from('commission_logs')
      .select('commission_amount')
      .eq('status', 'pending');

    const pending = pendingData?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;

    // Get trend data (last 7 days)
    const trend: Array<{ date: string; amount: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0)).toISOString();
      const dayEnd = new Date(date.setHours(23, 59, 59, 999)).toISOString();

      const { data: dayData } = await supabase
        .from('commission_logs')
        .select('commission_amount')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd);

      const dayAmount = dayData?.reduce((sum, log) => sum + Number(log.commission_amount), 0) || 0;
      trend.push({
        date: date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        amount: dayAmount
      });
    }

    // Get commission by lottery
    const { data: byLotteryData } = await supabase
      .from('commission_logs')
      .select(`
        commission_amount,
        lottery_id,
        lotteries!inner(name)
      `)
      .gte('created_at', monthStart);

    const byLotteryMap: Record<string, number> = {};
    byLotteryData?.forEach((log: any) => {
      const name = log.lotteries?.name || 'Unknown';
      byLotteryMap[name] = (byLotteryMap[name] || 0) + Number(log.commission_amount);
    });

    const byLottery = Object.entries(byLotteryMap)
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
      byLottery
    });
  } catch (error) {
    console.error('Commission stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commission stats' },
      { status: 500 }
    );
  }
}
