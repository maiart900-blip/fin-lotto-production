import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  // Auth guard - require admin
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  // Get filter parameters
  const dateFrom = searchParams.get('dateFrom') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dateTo = searchParams.get('dateTo') || new Date().toISOString().split('T')[0];
  const sourceType = searchParams.get('sourceType') || 'all'; // manual_key, auto, all
  const agentId = searchParams.get('agentId');
  const partnerId = searchParams.get('partnerId');
  const lotteryId = searchParams.get('lotteryId');

  try {
    // Build query for entries with source_type filtering
    let query = supabase
      .from('entries')
      .select(`
        id,
        amount,
        source_type,
        status,
        is_winner,
        payout_amount,
        lottery_id,
        agent_id,
        partner_id,
        created_at,
        lotteries(name)
      `)
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`);

    // Apply filters
    if (sourceType !== 'all') {
      query = query.eq('source_type', sourceType);
    }
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }
    if (partnerId) {
      query = query.eq('partner_id', partnerId);
    }
    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('[v0] Error fetching entries:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary by source_type
    const summary = {
      total: {
        totalBet: 0,
        totalWin: 0,
        profit: 0,
        entryCount: 0,
      },
      manual_key: {
        totalBet: 0,
        totalWin: 0,
        profit: 0,
        entryCount: 0,
      },
      auto: {
        totalBet: 0,
        totalWin: 0,
        profit: 0,
        entryCount: 0,
      },
    };

    // Daily breakdown for chart
    const dailyData: Record<string, { date: string; manual_key: number; auto: number; profit_manual: number; profit_auto: number }> = {};

    // Lottery breakdown
    const lotteryData: Record<string, { name: string; manual_key: number; auto: number; total: number }> = {};

    entries?.forEach((entry) => {
      const amount = Number(entry.amount) || 0;
      const payout = Number(entry.payout_amount) || 0;
      const sourceKey = entry.source_type === 'manual_key' ? 'manual_key' : 'auto';
      const date = new Date(entry.created_at).toISOString().split('T')[0];
      const lotteryObj = entry.lotteries as { name: string } | { name: string }[] | null;
      const lotteryName = Array.isArray(lotteryObj) ? lotteryObj[0]?.name : lotteryObj?.name || 'ไม่ระบุ';

      // Summary
      summary.total.totalBet += amount;
      summary.total.totalWin += payout;
      summary.total.entryCount += 1;
      summary[sourceKey].totalBet += amount;
      summary[sourceKey].totalWin += payout;
      summary[sourceKey].entryCount += 1;

      // Daily data
      if (!dailyData[date]) {
        dailyData[date] = { date, manual_key: 0, auto: 0, profit_manual: 0, profit_auto: 0 };
      }
      dailyData[date][sourceKey] += amount;
      if (sourceKey === 'manual_key') {
        dailyData[date].profit_manual += amount - payout;
      } else {
        dailyData[date].profit_auto += amount - payout;
      }

      // Lottery data
      if (!lotteryData[entry.lottery_id]) {
        lotteryData[entry.lottery_id] = { name: lotteryName, manual_key: 0, auto: 0, total: 0 };
      }
      lotteryData[entry.lottery_id][sourceKey] += amount;
      lotteryData[entry.lottery_id].total += amount;
    });

    // Calculate profits
    summary.total.profit = summary.total.totalBet - summary.total.totalWin;
    summary.manual_key.profit = summary.manual_key.totalBet - summary.manual_key.totalWin;
    summary.auto.profit = summary.auto.totalBet - summary.auto.totalWin;

    // Sort daily data
    const chartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    // Sort lottery data by total
    const lotteryBreakdown = Object.values(lotteryData).sort((a, b) => b.total - a.total);

    // Get detailed entries for table (limited)
    const tableData = entries?.slice(0, 100).map((entry: any) => ({
      id: entry.id,
      date: new Date(entry.created_at).toLocaleDateString('th-TH'),
      sourceType: entry.source_type,
      lottery: (entry.lotteries as any)?.name || 'ไม่ระบุ',
      amount: Number(entry.amount) || 0,
      payout: Number(entry.payout_amount) || 0,
      profit: (Number(entry.amount) || 0) - (Number(entry.payout_amount) || 0),
      status: entry.status,
    }));

    return NextResponse.json({
      summary,
      chartData,
      lotteryBreakdown,
      tableData,
      filters: {
        dateFrom,
        dateTo,
        sourceType,
        agentId,
        partnerId,
        lotteryId,
      },
    });
  } catch (err) {
    console.error('[v0] Report error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
