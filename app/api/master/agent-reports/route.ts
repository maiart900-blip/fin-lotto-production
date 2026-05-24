import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/api-auth';

// API สำหรับเว็บกลาง - ดูรายงานส่วนแบ่งจากทุกเอเย่น
// ไม่แก้ไข API เดิม - สร้างใหม่แยก

export async function GET(request: Request) {
  try {
    // Auth guard - require super_admin for master agent reports
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const agentId = searchParams.get('agent_id');

    const supabase = await createClient();

    // กำหนดช่วงวันที่
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // ดึงข้อมูลเอเย่นทั้งหมด (กรองเฉพาะที่มี name)
    let agentsQuery = supabase
      .from('agents')
      .select('id, name, code, share_percent, status')
      .not('name', 'is', null);

    if (agentId) {
      agentsQuery = agentsQuery.eq('id', agentId);
    }

    const { data: agents } = await agentsQuery;

    // คำนวณส่วนแบ่งแต่ละเอเย่น
    const agentReports = await Promise.all((agents || []).map(async (agent) => {
      const sharePercent = agent.share_percent || 90;
      const masterSharePercent = 100 - sharePercent;

      // ดึง entries ของเอเย่น
      const { data: entries } = await supabase
        .from('entries')
        .select('id, amount')
        .eq('agent_id', agent.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const entryIds = entries?.map(e => e.id) || [];
      let totalPayout = 0;

      if (entryIds.length > 0) {
        const { data: winners } = await supabase
          .from('winning_entries')
          .select('payout')
          .in('entry_id', entryIds);
        
        totalPayout = winners?.reduce((sum, w) => sum + (Number(w.payout) || 0), 0) || 0;
      }

      // ดึงประวัติการส่งยอด
      const { data: settlements } = await supabase
        .from('agent_settlements')
        .select('amount, status')
        .eq('agent_id', agent.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const paidAmount = settlements?.filter(s => s.status === 'paid')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;

      const pendingAmount = settlements?.filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;

      // คำนวณยอด
      const totalBets = entries?.length || 0;
      const totalAmount = entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
      const profit = totalAmount - totalPayout;
      const masterShare = Math.round(profit * (masterSharePercent / 100));
      const agentShare = profit - masterShare;
      const outstanding = masterShare - paidAmount;

      return {
        agent: {
          id: agent.id,
          name: agent.name,
          code: agent.code,
          share_percent: sharePercent,
          master_share_percent: masterSharePercent,
          status: agent.status,
        },
        stats: {
          total_bets: totalBets,
          total_amount: totalAmount,
          total_payout: totalPayout,
          profit,
          agent_share: agentShare,
          master_share: masterShare,
          paid_amount: paidAmount,
          pending_amount: pendingAmount,
          outstanding,
        },
      };
    }));

    // สรุปรวมทุกเอเย่น
    const summary = {
      total_agents: agentReports.length,
      total_bets: agentReports.reduce((sum, r) => sum + r.stats.total_bets, 0),
      total_amount: agentReports.reduce((sum, r) => sum + r.stats.total_amount, 0),
      total_payout: agentReports.reduce((sum, r) => sum + r.stats.total_payout, 0),
      total_profit: agentReports.reduce((sum, r) => sum + r.stats.profit, 0),
      total_master_share: agentReports.reduce((sum, r) => sum + r.stats.master_share, 0),
      total_paid: agentReports.reduce((sum, r) => sum + r.stats.paid_amount, 0),
      total_pending: agentReports.reduce((sum, r) => sum + r.stats.pending_amount, 0),
      total_outstanding: agentReports.reduce((sum, r) => sum + r.stats.outstanding, 0),
    };

    return NextResponse.json({
      period: {
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      },
      summary,
      agents: agentReports,
    });
  } catch (error) {
    console.error('Master agent report error:', error);
    return NextResponse.json({ error: 'Failed to get agent report' }, { status: 500 });
  }
}
