import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext, applyTenantScope } from '@/lib/agent-context';
import { buildPayoutMap, effectiveSharePercent } from '@/lib/agent-financials';

// API คำนวณกำไร/ขาดทุน เฉพาะของเอเย่นตัวเอง (identity จาก session, scope ด้วย tenant)
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
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id'); // admin only
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const lotteryId = searchParams.get('lottery_id');

    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่นเพื่อหา share_percent (scope ด้วย tenant)
    let agentQuery = supabase
      .from('agents')
      .select('id, name, share_percent, commission_rate')
      .eq('id', agentId);
    agentQuery = applyTenantScope(agentQuery, context);
    const { data: agent } = await agentQuery.single();

    // ค่าถือสู้จริงจาก DB (ไม่มี fallback ปลอม) — null = ยังไม่ตั้งค่า
    const sharePercent: number | null = agent?.share_percent ?? null;
    const shareConfigured = sharePercent !== null;

    // กำหนดช่วงวันที่
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // ดึง entries ของเอเย่น (scope ด้วย tenant)
    let entriesQuery = supabase
      .from('entries')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());
    entriesQuery = applyTenantScope(entriesQuery, context);

    if (lotteryId) {
      entriesQuery = entriesQuery.eq('lottery_id', lotteryId);
    }

    const { data: entries } = await entriesQuery;

    // ดึง winning entries ของเอเย่น
    const entryIds = entries?.map(e => e.id) || [];
    let winningEntries: Array<{ entry_id: string; payout: number | null }> = [];

    if (entryIds.length > 0) {
      const { data: winners } = await supabase
        .from('winning_entries')
        .select('entry_id, payout')
        .in('entry_id', entryIds);
      winningEntries = winners || [];
    }

    // ดึงข้อมูลหวย
    const { data: lotteries } = await supabase
      .from('lotteries')
      .select('id, name');

    const lotteryMap = new Map(lotteries?.map(l => [l.id, l.name]) || []);
    const payoutMap = buildPayoutMap(winningEntries);

    // คำนวณกำไร/ขาดทุนแยกตามหวย — คิดส่วนแบ่งจาก snapshot ที่ freeze ต่อ entry
    // (source of truth) live sharePercent = fallback เฉพาะ entry เก่าที่ไม่มี snapshot
    const profitByLottery: Record<string, ProfitResult> = {};

    // สรุปรวม (accumulate แบบ per-entry เพื่อ reconcile ตรงกับ detail)
    const summary = {
      total_bets: entries?.length || 0,
      total_amount: 0,
      total_payout: 0,
      total_profit: 0,
      agent_total_share: 0,
      master_total_share: 0,
      share_percent: sharePercent,
      share_configured: shareConfigured,
    };

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

      const amount = Number(entry.amount) || 0;
      const payout = payoutMap.get(entry.id) || 0;
      const entryProfit = amount - payout;

      // frozen rate จาก snapshot ของ entry นี้ (fallback เป็น live เฉพาะ legacy ที่ไม่มี snapshot)
      const { percent } = effectiveSharePercent(
        entry,
        agentId,
        shareConfigured ? sharePercent : null,
      );
      const entryAgentShare = percent !== null ? Math.round(entryProfit * (percent / 100)) : 0;
      const entryMasterShare = percent !== null ? entryProfit - entryAgentShare : 0;

      const g = profitByLottery[key];
      g.total_bets += 1;
      g.total_amount += amount;
      g.total_payout += payout;
      g.profit += entryProfit;
      g.agent_share += entryAgentShare;
      g.master_share += entryMasterShare;

      summary.total_amount += amount;
      summary.total_payout += payout;
      summary.total_profit += entryProfit;
      summary.agent_total_share += entryAgentShare;
      summary.master_total_share += entryMasterShare;
    });

    return NextResponse.json({
      agent: {
        id: agent?.id,
        name: agent?.name,
        share_percent: sharePercent,
        share_configured: shareConfigured,
      },
      summary,
      details: Object.values(profitByLottery).sort((a, b) => b.date.localeCompare(a.date)),
    });
  } catch (error) {
    console.error('Agent profit error:', error);
    return NextResponse.json({ error: 'Failed to calculate profit' }, { status: 500 });
  }
}
