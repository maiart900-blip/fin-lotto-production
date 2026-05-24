import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const agentId = searchParams.get('agent_id');
    const branchId = searchParams.get('branch_id');
    const period = searchParams.get('period') || 'today';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Calculate date range
    let dateFrom: string;
    let dateTo: string = new Date().toISOString().split('T')[0];
    
    switch (period) {
      case 'today':
        dateFrom = dateTo;
        break;
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        dateFrom = yesterday.toISOString().split('T')[0];
        dateTo = dateFrom;
        break;
      case '7days':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFrom = weekAgo.toISOString().split('T')[0];
        break;
      case '30days':
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        dateFrom = monthAgo.toISOString().split('T')[0];
        break;
      case 'custom':
        dateFrom = startDate || dateTo;
        dateTo = endDate || dateTo;
        break;
      default:
        dateFrom = dateTo;
    }

    // Get all agents with their hierarchy
    let agentsQuery = supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        role,
        branch_id,
        parent_id,
        hierarchy_level,
        credit_balance
      `)
      .in('role', ['agent', 'partner', 'admin']);

    if (agentId && agentId !== 'all') {
      agentsQuery = agentsQuery.eq('id', agentId);
    }
    
    if (branchId) {
      agentsQuery = agentsQuery.eq('branch_id', branchId);
    }

    const { data: agents, error: agentsError } = await agentsQuery;

    if (agentsError) throw agentsError;

    // Get entries and calculate profit/loss for each agent
    const agentStats = await Promise.all((agents || []).map(async (agent) => {
      // Get entries for this agent's customers
      const { data: entries } = await supabase
        .from('entries')
        .select('total_amount, status, owner_id')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`);

      // Get customers under this agent
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('agent_id', agent.id);

      const customerIds = (customers || []).map(c => c.id);
      
      // Filter entries for this agent's customers
      const agentEntries = (entries || []).filter(e => customerIds.includes(e.owner_id));
      
      // Calculate sales
      const totalSales = agentEntries.reduce((sum, e) => sum + Number(e.total_amount || 0), 0);
      
      // Get winning entries (payouts)
      const { data: winningEntries } = await supabase
        .from('winning_entries')
        .select('payout_amount, entry_id')
        .in('entry_id', agentEntries.map(e => (e as any).id || ''));

      const totalPayout = (winningEntries || []).reduce((sum, w) => sum + Number(w.payout_amount || 0), 0);
      
      // Get commission
      const { data: commissions } = await supabase
        .from('commissions')
        .select('amount')
        .eq('agent_id', agent.id)
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`);

      const totalCommission = (commissions || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
      
      // Calculate profit
      const profit = totalSales - totalPayout - totalCommission;
      
      // Get downline agents
      const { data: downlineAgents } = await supabase
        .from('users')
        .select('id')
        .eq('parent_id', agent.id);

      return {
        id: agent.id,
        username: agent.username,
        display_name: agent.display_name,
        role: agent.role,
        branch_id: agent.branch_id,
        hierarchy_level: agent.hierarchy_level,
        customer_count: customerIds.length,
        downline_count: (downlineAgents || []).length,
        total_sales: totalSales,
        total_payout: totalPayout,
        total_commission: totalCommission,
        profit: profit,
        is_profit: profit >= 0,
        profit_margin: totalSales > 0 ? ((profit / totalSales) * 100).toFixed(2) : 0,
      };
    }));

    // Calculate totals
    const summary = {
      total_agents: agentStats.length,
      total_sales: agentStats.reduce((sum, a) => sum + a.total_sales, 0),
      total_payout: agentStats.reduce((sum, a) => sum + a.total_payout, 0),
      total_commission: agentStats.reduce((sum, a) => sum + a.total_commission, 0),
      total_profit: agentStats.reduce((sum, a) => sum + a.profit, 0),
      profitable_agents: agentStats.filter(a => a.profit >= 0).length,
      loss_agents: agentStats.filter(a => a.profit < 0).length,
    };

    // Sort by profit descending
    const sortedStats = agentStats.sort((a, b) => b.profit - a.profit);

    return NextResponse.json({
      agents: sortedStats,
      summary,
      period: { from: dateFrom, to: dateTo },
    });

  } catch (error) {
    console.error('Agent profit loss error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent profit/loss data' },
      { status: 500 }
    );
  }
}
