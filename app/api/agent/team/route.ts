import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// API สำหรับดึงข้อมูลทีมของ Agent (Scoped Data - เฉพาะสายงานของตัวเอง)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const range = searchParams.get('range') || 'today';

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Get all users under this agent's downline (recursive)
    const { data: downlineUsers, error: downlineError } = await supabase
      .from('users')
      .select('id, username, display_name, role, credit_balance, is_active, created_at, upline_id')
      .eq('upline_id', agentId)
      .order('created_at', { ascending: false });

    if (downlineError) {
      console.error('Downline fetch error:', downlineError);
    }

    const members = downlineUsers || [];

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

    // 2. Get betting stats for this agent and their downline
    let totalBets = 0;
    let totalCommission = 0;
    let todayTurnover = 0;
    let todayCommission = 0;

    // Get entries where agent_id matches (entries created by this agent or their staff)
    const { data: entries } = await supabase
      .from('entries')
      .select('amount, created_at, agent_id, created_by')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString());

    if (entries && entries.length > 0) {
      totalBets = entries.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      // Assume 10% commission rate for demo
      totalCommission = totalBets * 0.1;

      // Today's stats
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEntries = entries.filter((e: any) => new Date(e.created_at) >= todayStart);
      todayTurnover = todayEntries.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      todayCommission = todayTurnover * 0.1;
    }

    // Get commission transactions for this agent
    const { data: commissions } = await supabase
      .from('credit_transactions')
      .select('amount')
      .eq('user_id', agentId)
      .eq('type', 'commission')
      .gte('created_at', startDate.toISOString());

    if (commissions && commissions.length > 0) {
      totalCommission = commissions.reduce((sum: number, c: any) => sum + Math.abs(Number(c.amount) || 0), 0);
    }

    // 3. Calculate member stats
    const activeMembers = members.filter((m: any) => m.is_active).length;
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const newMembersThisWeek = members.filter((m: any) => new Date(m.created_at) >= weekAgo).length;

    // 4. Get per-member betting stats
    const membersWithStats = await Promise.all(
      members.map(async (member: any) => {
        const { data: memberEntries } = await supabase
          .from('entries')
          .select('amount')
          .eq('user_id', member.id);

        const totalMemberBets = memberEntries?.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0) || 0;

        return {
          ...member,
          total_bets: totalMemberBets,
          total_commission: totalMemberBets * 0.1,
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
      weeklyTurnover: totalBets, // Same as range if week
      weeklyCommission: totalCommission,
      monthlyTurnover: totalBets,
      monthlyCommission: totalCommission,
      profitLoss: totalCommission, // Agent's profit is their commission
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
