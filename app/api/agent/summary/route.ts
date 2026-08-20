import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext, applyTenantScope } from '@/lib/agent-context';

// API สรุปข้อมูลสำหรับ Agent Dashboard
// Data Scope: Agent เห็นยอดรวมของตัวเอง + sub-agents (scope ด้วย tenant + identity จาก session)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    // admin เท่านั้นที่ระบุ target agent ได้ (agent ธรรมดาถูก scope เป็นตัวเองเสมอ)
    const targetAgentId = searchParams.get('agent_id');

    // Identity มาจาก session เท่านั้น (กัน IDOR)
    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่น (scope ด้วย tenant)
    let agentQuery = supabase.from('agents').select('*').eq('id', agentId);
    agentQuery = applyTenantScope(agentQuery, context);
    const { data: agent } = await agentQuery.single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ค่าถือสู้จริงจาก DB (ไม่มี fallback ปลอม) — null = ยังไม่ตั้งค่า
    const sharePercent: number | null = agent.share_percent ?? null;
    const shareConfigured = sharePercent !== null;

    // กำหนดช่วงวันที่ (วันนี้)
    const now = date ? new Date(date) : new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Data Scope: agent เห็นตัวเอง + sub-agents / sub_agent เห็นเฉพาะตัวเอง — ทั้งหมด scope ด้วย tenant
    let entriesQuery = supabase
      .from('entries')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    entriesQuery = applyTenantScope(entriesQuery, context);

    if (agent.role === 'sub_agent') {
      entriesQuery = entriesQuery.eq('agent_id', agentId);
    } else {
      entriesQuery = entriesQuery.or(`agent_id.eq.${agentId},parent_agent_id.eq.${agentId}`);
    }

    const { data: entries } = await entriesQuery;

    // ดึง winning entries
    const entryIds = entries?.map(e => e.id) || [];
    let totalPayout = 0;

    if (entryIds.length > 0) {
      const { data: winners } = await supabase
        .from('winning_entries')
        .select('payout')
        .in('entry_id', entryIds);

      totalPayout = winners?.reduce((sum, w) => sum + (Number(w.payout) || 0), 0) || 0;
    }

    // คำนวณยอด
    const totalBets = entries?.length || 0;
    const totalAmount = entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
    const profit = totalAmount - totalPayout;

    // คำนวณส่วนแบ่งเฉพาะเมื่อมีการตั้งค่า share จริง
    const agentShare = shareConfigured ? Math.round(profit * (sharePercent! / 100)) : 0;
    const masterShare = shareConfigured ? profit - agentShare : 0;

    // นับจำนวน sub-agents (scope ด้วย tenant)
    let subAgentsCount = 0;
    if (agent.role !== 'sub_agent') {
      let subCountQuery = supabase
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('parent_agent_id', agentId);
      subCountQuery = applyTenantScope(subCountQuery, context);
      const { count } = await subCountQuery;
      subAgentsCount = count || 0;
    }

    // สถิติ entries
    const pendingCount = entries?.filter(e => e.status === 'pending').length || 0;
    const wonCount = entries?.filter(e => e.status === 'won').length || 0;
    const lostCount = entries?.filter(e => e.status === 'lost').length || 0;

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        code: agent.code,
        role: agent.role,
        share_percent: sharePercent,
        share_configured: shareConfigured,
        credit_limit: agent.credit_limit || 0,
        credit_balance: agent.credit_balance || 0,
      },
      summary: {
        total_bets: totalBets,
        total_amount: totalAmount,
        total_payout: totalPayout,
        profit: profit,
        agent_share: agentShare,
        master_share: masterShare,
        sub_agents_count: subAgentsCount,
        share_configured: shareConfigured,
      },
      entries_stats: {
        pending: pendingCount,
        won: wonCount,
        lost: lostCount,
      },
      period: {
        date: now.toISOString().split('T')[0],
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Agent summary error:', error);
    return NextResponse.json({ error: 'Failed to get summary' }, { status: 500 });
  }
}
