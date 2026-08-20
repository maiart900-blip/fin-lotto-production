import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext } from '@/lib/agent-context';

/**
 * GET /api/agent/sub-agent-profit-loss
 *
 * Fetches Sub-Agent Profit/Loss Summary for Manual Key entries (today only)
 * Strictly isolated from Auto API data - source_type = 'manual_key' filter applied
 *
 * Identity มาจาก session เท่านั้น (parent agent = agent ที่ login).
 * admin/super_admin ระบุ target agent_id ได้ (ตรวจ downline server-side ผ่าน context)
 *
 * Query params:
 *   - agent_id: (admin only) target parent agent id
 *   - source_type: Must be 'manual_key' for data isolation
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id');
    const sourceType = searchParams.get('source_type') || 'manual_key';

    // resolve identity จาก session (admin override + downline check อยู่ใน helper)
    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    // 1. Get all sub-agents under this agent (scope ด้วย tenant)
    let subAgentsQuery = supabase
      .from('agents')
      .select('id, name, code, share_percent, commission_rate')
      .eq('parent_agent_id', agentId)
      .eq('is_active', true);
    subAgentsQuery = context.tenantId === null
      ? subAgentsQuery.is('tenant_id', null)
      : subAgentsQuery.eq('tenant_id', context.tenantId);
    const { data: subAgents, error: subAgentsError } = await subAgentsQuery;

    if (subAgentsError) {
      console.error('[SubAgentProfitLoss] Error fetching sub-agents:', subAgentsError);
      return NextResponse.json({ subAgents: [] });
    }

    if (!subAgents || subAgents.length === 0) {
      return NextResponse.json({ subAgents: [] });
    }

    // 2. For each sub-agent, calculate profit/loss from manual key entries today
    const subAgentIds = subAgents.map(sa => sa.id);

    // Fetch all manual key bets for these sub-agents today
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        agent_id,
        total_amount,
        is_checked,
        bet_items(id, status, win_amount, amount_top, amount_bottom)
      `)
      .in('agent_id', subAgentIds)
      .eq('source_type', sourceType) // STRICT: Manual Key Only
      .gte('created_at', todayISO)
      .lt('created_at', tomorrowISO);

    if (betsError) {
      console.error('[SubAgentProfitLoss] Error fetching bets:', betsError);
      return NextResponse.json({ subAgents: [] });
    }

    // 3. Aggregate data per sub-agent
    const subAgentMap = new Map<string, {
      credits_used: number;
      customer_winnings: number;
      total_tickets: number;
    }>();

    // Initialize map
    subAgentIds.forEach(id => {
      subAgentMap.set(id, { credits_used: 0, customer_winnings: 0, total_tickets: 0 });
    });

    // Process bets
    (bets || []).forEach((bet: {
      agent_id: string;
      total_amount: number;
      is_checked: boolean;
      bet_items: Array<{ status: string; win_amount: number; amount_top: number; amount_bottom: number }> | null;
    }) => {
      const agentData = subAgentMap.get(bet.agent_id);
      if (agentData) {
        // Credits used = total bet amount
        agentData.credits_used += Number(bet.total_amount) || 0;
        agentData.total_tickets += 1;

        // Customer winnings = sum of win_amount from bet_items
        if (bet.is_checked && bet.bet_items) {
          const winnings = bet.bet_items
            .filter(item => item.status === 'won')
            .reduce((sum, item) => sum + (Number(item.win_amount) || 0), 0);
          agentData.customer_winnings += winnings;
        }
      }
    });

    // 4. Build response with profit/loss calculations
    const result = subAgents.map(sa => {
      const data = subAgentMap.get(sa.id) || { credits_used: 0, customer_winnings: 0, total_tickets: 0 };
      // ค่าถือสู้จริงจาก DB (0 = ไม่ถือสู้; ไม่มี fallback ปลอม เช่น 10)
      const sharePercent = Number(sa.share_percent) || 0;
      const shareConfigured = sa.share_percent !== null && sa.share_percent !== undefined;

      // Calculate values
      const creditsUsed = data.credits_used;
      const customerWinnings = data.customer_winnings;
      const customerLosses = creditsUsed - customerWinnings; // Net loss from customers
      const companyShare = Math.round((customerLosses * sharePercent) / 100); // Company cut
      const agentProfit = customerLosses - companyShare; // Agent's remaining profit

      return {
        id: sa.id,
        name: sa.name || sa.code || 'Unknown',
        credits_used: creditsUsed,
        customer_winnings: customerWinnings,
        customer_losses: customerLosses,
        company_share: companyShare,
        agent_profit: agentProfit,
        total_tickets: data.total_tickets,
        share_percent: sharePercent,
        share_configured: shareConfigured,
      };
    });

    // Sort by credits_used descending
    result.sort((a, b) => b.credits_used - a.credits_used);

    return NextResponse.json({ 
      subAgents: result,
      source_type: sourceType,
      date: today.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('[SubAgentProfitLoss] Exception:', error);
    return NextResponse.json({ subAgents: [], error: 'Server error' }, { status: 500 });
  }
}
