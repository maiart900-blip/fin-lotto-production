import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-auth';

// =====================================================
// MASTER AGENT FINANCIAL PERFORMANCE API
// =====================================================
// Endpoint: GET /api/master/agent-financial-performance
// Purpose: Fetch financial performance of all Agents under Master
// Data Source: STRICT - source_type='manual_key' ONLY (no Auto API)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    // Auth guard - require admin (Master Agent or above)
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) {
      console.error('[MasterPerformance] Auth failed');
      return authResult;
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('source_type') || 'manual_key';
    const masterId = searchParams.get('master_id');

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    console.log('[MasterPerformance] Fetching data for today:', todayISO, 'source:', sourceType);

    // =====================================================
    // STRICT DATA ISOLATION: source_type = 'manual_key'
    // =====================================================

    // 1. Fetch all agents (sub-agents under master)
    let agentsQuery = supabase
      .from('agents')
      .select('id, name, code, role, share_percent, commission_rate, parent_agent_id')
      .in('role', ['agent', 'agent_key', 'sub_agent'])
      .eq('is_active', true);

    if (masterId) {
      agentsQuery = agentsQuery.eq('parent_agent_id', masterId);
    }

    const { data: agents, error: agentsError } = await agentsQuery;

    if (agentsError) {
      console.error('[MasterPerformance] Error fetching agents:', agentsError);
      return NextResponse.json({ 
        agents: [], 
        summary: {
          total_active_agents: 0,
          global_master_profit: 0,
          is_global_profitable: true,
          total_pending_transfers: 0,
          total_volume: 0,
          total_customer_winnings: 0,
        }
      });
    }

    const agentIds = agents?.map(a => a.id) || [];

    if (agentIds.length === 0) {
      return NextResponse.json({ 
        agents: [], 
        summary: {
          total_active_agents: 0,
          global_master_profit: 0,
          is_global_profitable: true,
          total_pending_transfers: 0,
          total_volume: 0,
          total_customer_winnings: 0,
        },
        lastUpdated: new Date().toISOString()
      });
    }

    // 2. Fetch today's bets (STRICT: source_type = 'manual_key')
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id, 
        agent_id, 
        total_amount, 
        is_checked, 
        created_at,
        bet_items(id, status, win_amount)
      `)
      .eq('source_type', sourceType) // STRICT: Manual key only
      .in('agent_id', agentIds)
      .gte('created_at', todayISO)
      .order('created_at', { ascending: false });

    if (betsError) {
      console.error('[MasterPerformance] Error fetching bets:', betsError);
    }

    // 3. Fetch customer counts per agent
    const { data: customerCounts } = await supabase
      .from('customers')
      .select('agent_id')
      .eq('source', 'manual_key') // STRICT: Manual key customers only
      .in('agent_id', agentIds);

    // 4. Calculate performance per agent
    const agentPerformance = agents?.map(agent => {
      const agentBets = (bets || []).filter(b => b.agent_id === agent.id);
      const agentCustomers = (customerCounts || []).filter(c => c.agent_id === agent.id);
      
      // Calculate totals
      const totalVolume = agentBets.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
      const totalTickets = agentBets.length;
      
      // Calculate customer winnings from checked bets
      let customerWinnings = 0;
      agentBets.forEach(bet => {
        if (bet.is_checked && bet.bet_items) {
          (bet.bet_items as Array<{ status: string; win_amount: number }>).forEach(item => {
            if (item.status === 'won') {
              customerWinnings += Number(item.win_amount) || 0;
            }
          });
        }
      });

      // Calculate net profit/loss (volume - winnings)
      const netProfitLoss = totalVolume - customerWinnings;
      const isProfitable = netProfitLoss >= 0;

      // Calculate company share (percentage of profit to Mother Web)
      const sharePercent = agent.share_percent || 30; // Default 30%
      const companyShare = isProfitable ? netProfitLoss * (sharePercent / 100) : 0;

      // Calculate master's net share (profit after company cut)
      const masterNetShare = netProfitLoss - companyShare;

      return {
        id: agent.id,
        name: agent.name || agent.code,
        total_volume: totalVolume,
        net_profit_loss: netProfitLoss,
        customer_winnings: customerWinnings,
        company_share: companyShare,
        master_net_share: masterNetShare,
        total_tickets: totalTickets,
        total_customers: agentCustomers.length,
        share_percent: sharePercent,
        is_profitable: isProfitable,
      };
    }) || [];

    // Sort by total volume descending
    agentPerformance.sort((a, b) => b.total_volume - a.total_volume);

    // 5. Calculate global summary
    const totalVolume = agentPerformance.reduce((sum, a) => sum + a.total_volume, 0);
    const totalCustomerWinnings = agentPerformance.reduce((sum, a) => sum + a.customer_winnings, 0);
    const totalCompanyShare = agentPerformance.reduce((sum, a) => sum + a.company_share, 0);
    const globalMasterProfit = agentPerformance.reduce((sum, a) => sum + a.master_net_share, 0);

    const summary = {
      total_active_agents: agentPerformance.filter(a => a.total_tickets > 0).length,
      global_master_profit: globalMasterProfit,
      is_global_profitable: globalMasterProfit >= 0,
      total_pending_transfers: totalCompanyShare,
      total_volume: totalVolume,
      total_customer_winnings: totalCustomerWinnings,
    };

    console.log('[MasterPerformance] Summary:', {
      agents: agentPerformance.length,
      activeAgents: summary.total_active_agents,
      totalVolume: summary.total_volume,
      masterProfit: summary.global_master_profit,
    });

    return NextResponse.json({
      agents: agentPerformance,
      summary,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MasterPerformance] Exception:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch performance data',
      agents: [], 
      summary: {
        total_active_agents: 0,
        global_master_profit: 0,
        is_global_profitable: true,
        total_pending_transfers: 0,
        total_volume: 0,
        total_customer_winnings: 0,
      }
    }, { status: 500 });
  }
}
