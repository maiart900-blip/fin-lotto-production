import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API คำนวณกำไร/ขาดทุน เฉพาะของเอเย่นตัวเอง
// ไม่ยุ่งกับระบบเดิมของเว็บกลาง

interface ProfitResult {
  date: string;
  lottery_name: string;
  total_bets: number;
  total_amount: number;
  total_payout: number;
  profit: number;
  agent_share: number;
  master_share: number;
}

export async function GET(request: Request) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const lotteryId = searchParams.get('lottery_id');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่นเพื่อหา share_percent
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, share_percent, commission_rate')
      .eq('id', agentId)
      .single();

    const sharePercent = agent?.share_percent || 90; // เอเย่นได้ 90%, เว็บกลางได้ 10%

    // กำหนดช่วงวันที่
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // ดึง entries ของเอเย่น
    let entriesQuery = supabase
      .from('entries')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (lotteryId) {
      entriesQuery = entriesQuery.eq('lottery_id', lotteryId);
    }

    const { data: entries } = await entriesQuery;

    // ดึง winning entries ของเอเย่น
    const entryIds = entries?.map(e => e.id) || [];
    let winningEntries: any[] = [];
    
    if (entryIds.length > 0) {
      const { data: winners } = await supabase
        .from('winning_entries')
        .select('*')
        .in('entry_id', entryIds);
      winningEntries = winners || [];
    }

    // ดึงข้อมูลหวย
    const { data: lotteries } = await supabase
      .from('lotteries')
      .select('id, name');

    const lotteryMap = new Map(lotteries?.map(l => [l.id, l.name]) || []);

    // คำนวณกำไร/ขาดทุนแยกตามหวย
    const profitByLottery: Record<string, ProfitResult> = {};

    entries?.forEach(entry => {
      const lotteryName = lotteryMap.get(entry.lottery_id) || 'ไม่ระบุ';
      const dateKey = new Date(entry.created_at).toISOString().split('T')[0];
      const key = `${dateKey}_${entry.lottery_id}`;

      if (!profitByLottery[key]) {
        profitByLottery[key] = {
          date: dateKey,
          lottery_name: lotteryName,
          total_bets: 0,
          total_amount: 0,
          total_payout: 0,
          profit: 0,
          agent_share: 0,
          master_share: 0,
        };
      }

      profitByLottery[key].total_bets += 1;
      profitByLottery[key].total_amount += Number(entry.amount) || 0;
    });

    // เพิ่มยอดจ่ายรางวัล
    winningEntries.forEach(winner => {
      const entry = entries?.find(e => e.id === winner.entry_id);
      if (entry) {
        const dateKey = new Date(entry.created_at).toISOString().split('T')[0];
        const key = `${dateKey}_${entry.lottery_id}`;
        if (profitByLottery[key]) {
          profitByLottery[key].total_payout += Number(winner.payout) || 0;
        }
      }
    });

    // คำนวณกำไรและส่วนแบ่ง
    Object.values(profitByLottery).forEach(item => {
      item.profit = item.total_amount - item.total_payout;
      item.agent_share = Math.round(item.profit * (sharePercent / 100));
      item.master_share = item.profit - item.agent_share;
    });

    // สรุปรวม
    const summary = {
      total_bets: entries?.length || 0,
      total_amount: entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0,
      total_payout: winningEntries.reduce((sum, w) => sum + (Number(w.payout) || 0), 0),
      total_profit: 0,
      agent_total_share: 0,
      master_total_share: 0,
      share_percent: sharePercent,
    };

    summary.total_profit = summary.total_amount - summary.total_payout;
    summary.agent_total_share = Math.round(summary.total_profit * (sharePercent / 100));
    summary.master_total_share = summary.total_profit - summary.agent_total_share;

    return NextResponse.json({
      agent: {
        id: agent?.id,
        name: agent?.name,
        share_percent: sharePercent,
      },
      summary,
      details: Object.values(profitByLottery).sort((a, b) => b.date.localeCompare(a.date)),
    });
  } catch (error) {
    console.error('Agent profit error:', error);
    return NextResponse.json({ error: 'Failed to calculate profit' }, { status: 500 });
  }
}
