import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สรุปข้อมูลสำหรับ Agent Dashboard
// รองรับ Data Scope: Agent เห็นยอดรวมของตัวเอง + sub-agents

export async function GET(request: Request) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const date = searchParams.get('date');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่น
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const sharePercent = agent.share_percent || 90;

    // กำหนดช่วงวันที่ (วันนี้)
    const now = date ? new Date(date) : new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Data Scope Logic:
    // - Agent (role=agent/agent_key): รวมยอดของตัวเอง + sub-agents ทั้งหมด
    // - Sub-Agent (role=sub_agent): เฉพาะยอดของตัวเอง
    let entriesQuery = supabase
      .from('entries')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

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
    
    // คำนวณส่วนแบ่ง
    const agentShare = Math.round(profit * (sharePercent / 100));
    const masterShare = profit - agentShare;

    // นับจำนวน sub-agents (เฉพาะ agent ไม่ใช่ sub_agent)
    let subAgentsCount = 0;
    if (agent.role !== 'sub_agent') {
      const { count } = await supabase
        .from('agents')
        .select('id', { count: 'exact', head: true })
        .eq('parent_agent_id', agentId);
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
