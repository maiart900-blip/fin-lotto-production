import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สำหรับดึงข้อมูลทีมของ Agent (Scoped Data - เฉพาะสายงานของตัวเอง)
// Identity มาจาก session เท่านั้น — admin/super_admin override ดู agent อื่นได้
// โครงจริง: สมาชิกทีม = customers ที่ agent_id = agent นี้, ยอดเล่น = entries.customer_id,
//           คอมมิชชั่น = commission_logs (agent_id, commission_type, amount) — ไม่มีอัตราปลอม
export async function GET(request: Request) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const requestedAgentId = searchParams.get('agent_id');
    const range = searchParams.get('range') || 'today';

    // IDOR guard: เฉพาะ admin/super_admin ที่ระบุ agent_id คนอื่นได้
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const agentId = isAdmin && requestedAgentId ? requestedAgentId : user.id;
    const tenantId = user.tenant_id ?? null;

    const supabase = await createClient();

    // 1. สมาชิกในสายงาน = customers ที่อยู่ใต้ agent นี้ (scope ด้วย tenant)
    let membersQuery = supabase
      .from('customers')
      .select('id, name, credit_balance, is_active, created_at, agent_level')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });
    membersQuery = tenantId === null
      ? membersQuery.is('tenant_id', null)
      : membersQuery.eq('tenant_id', tenantId);
    const { data: downlineCustomers, error: downlineError } = await membersQuery;

    if (downlineError) {
      console.error('Downline fetch error:', downlineError);
    }

    const members = downlineCustomers || [];

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (range) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // 2. ยอดเล่นของ agent (entries.agent_id) — turnover จริง
    let totalBets = 0;
    let todayTurnover = 0;

    const { data: entries } = await supabase
      .from('entries')
      .select('amount, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString());

    if (entries && entries.length > 0) {
      totalBets = entries.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      todayTurnover = entries
        .filter((e: any) => new Date(e.created_at) >= todayStart)
        .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    }

    // 3. คอมมิชชั่นจริงจาก commission_logs ของ agent นี้ (ไม่มีอัตราปลอม)
    let totalCommission = 0;
    let todayCommission = 0;

    const { data: commissions } = await supabase
      .from('commission_logs')
      .select('amount, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString());

    if (commissions && commissions.length > 0) {
      totalCommission = commissions.reduce((sum: number, c: any) => sum + Math.abs(Number(c.amount) || 0), 0);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      todayCommission = commissions
        .filter((c: any) => new Date(c.created_at) >= todayStart)
        .reduce((sum: number, c: any) => sum + Math.abs(Number(c.amount) || 0), 0);
    }

    // 4. member stats — ยอดเล่นต่อ customer (entries.customer_id)
    const activeMembers = members.filter((m: any) => m.is_active).length;
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newMembersThisWeek = members.filter((m: any) => new Date(m.created_at) >= weekAgo).length;

    const membersWithStats = await Promise.all(
      members.map(async (member: any) => {
        const { data: memberEntries } = await supabase
          .from('entries')
          .select('amount')
          .eq('customer_id', member.id);

        const totalMemberBets = memberEntries?.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0) || 0;

        return {
          id: member.id,
          name: member.name,
          credit_balance: member.credit_balance,
          is_active: member.is_active,
          created_at: member.created_at,
          agent_level: member.agent_level,
          total_bets: totalMemberBets,
        };
      })
    );

    // 5. Build response
    const stats = {
      totalMembers: members.length,
      activeMembers,
      totalTurnover: totalBets,
      totalCommission,
      todayTurnover,
      todayCommission,
      newMembersThisWeek,
    };

    return NextResponse.json({
      stats,
      members: membersWithStats,
      range,
      agentId,
    });
  } catch (err) {
    console.error('Agent team API error:', err);
    return NextResponse.json({ error: 'Failed to fetch team data' }, { status: 500 });
  }
}
