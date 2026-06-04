/**
 * Agent Network Settlement API
 * Handles settlement calculations and processing for agent network
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMasterSession } from '@/lib/master-platform';

interface AgentSettlement {
  agentId: string;
  agentCode: string;
  agentName: string;
  level: 'master' | 'senior' | 'agent';
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  ptPercent: number;
  commission: number;
  period: string;
  totalBets: number;
  totalWins: number;
  grossProfit: number;
  ptShare: number;
  commissionAmount: number;
  netSettlement: number;
  memberCount: number;
  downlineCount: number;
  status: 'pending' | 'settled' | 'disputed';
  settledAt?: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getMasterSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || getCurrentWeekRange();
    const [startDate, endDate] = period.split('_');

    const supabase = await createClient();

    // Get all agents with their settings
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        name,
        role,
        credit_limit,
        credit_balance,
        commission_rate,
        position_taking,
        is_active,
        parent_agent_id
      `)
      .in('role', ['master', 'senior', 'agent'])
      .eq('is_active', true)
      .order('role', { ascending: true });

    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    // Get bet data for each agent within the period
    const agentSettlements: AgentSettlement[] = [];
    let totalBets = 0;
    let totalWins = 0;
    let totalGrossProfit = 0;
    let totalPTShare = 0;
    let totalCommission = 0;
    let pendingSettlements = 0;

    for (const agent of agents || []) {
      // Get entries/bets for this agent's customers
      const { data: bets } = await supabase
        .from('entries')
        .select('total_amount, total_payout, status')
        .eq('agent_id', agent.id)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      const agentTotalBets = bets?.reduce((sum, b) => sum + Number(b.total_amount || 0), 0) || 0;
      const agentTotalWins = bets?.reduce((sum, b) => sum + Number(b.total_payout || 0), 0) || 0;
      const agentGrossProfit = agentTotalBets - agentTotalWins;

      // Calculate PT share (Position Taking)
      const ptPercent = agent.position_taking || 0;
      const ptShare = agentGrossProfit * (ptPercent / 100);

      // Calculate commission (based on total bets)
      const commissionRate = agent.commission_rate || 0;
      const commissionAmount = agentTotalBets * (commissionRate / 100);

      // Net settlement = PT share + Commission
      // Positive = agent receives money
      // Negative = agent pays money
      const netSettlement = ptShare + commissionAmount;

      // Get member count
      const { count: memberCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agent.id)
        .eq('role', 'customer');

      // Get downline agent count
      const { count: downlineCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('parent_agent_id', agent.id)
        .in('role', ['senior', 'agent']);

      // Check if already settled
      const { data: existingSettlement } = await supabase
        .from('agent_settlements')
        .select('status, settled_at')
        .eq('agent_id', agent.id)
        .eq('period_start', startDate)
        .eq('period_end', endDate)
        .single();

      const status = existingSettlement?.status || 'pending';
      const settledAt = existingSettlement?.settled_at;

      if (status === 'pending' && netSettlement !== 0) {
        pendingSettlements++;
      }

      agentSettlements.push({
        agentId: agent.id,
        agentCode: agent.username,
        agentName: agent.name || agent.username,
        level: agent.role as 'master' | 'senior' | 'agent',
        creditLimit: Number(agent.credit_limit) || 0,
        creditUsed: Number(agent.credit_balance) || 0,
        creditAvailable: (Number(agent.credit_limit) || 0) - (Number(agent.credit_balance) || 0),
        ptPercent,
        commission: commissionRate,
        period,
        totalBets: agentTotalBets,
        totalWins: agentTotalWins,
        grossProfit: agentGrossProfit,
        ptShare,
        commissionAmount,
        netSettlement,
        memberCount: memberCount || 0,
        downlineCount: downlineCount || 0,
        status,
        settledAt,
      });

      // Accumulate totals
      totalBets += agentTotalBets;
      totalWins += agentTotalWins;
      totalGrossProfit += agentGrossProfit;
      totalPTShare += ptShare;
      totalCommission += commissionAmount;
    }

    // Net platform profit = Gross profit - PT shares - Commission
    const netPlatformProfit = totalGrossProfit - totalPTShare - totalCommission;

    return NextResponse.json({
      agents: agentSettlements.sort((a, b) => {
        // Sort by level priority then by total bets
        const levelOrder = { master: 0, senior: 1, agent: 2 };
        if (levelOrder[a.level] !== levelOrder[b.level]) {
          return levelOrder[a.level] - levelOrder[b.level];
        }
        return b.totalBets - a.totalBets;
      }),
      summary: {
        totalAgents: agentSettlements.length,
        totalBets,
        totalWins,
        totalGrossProfit,
        totalPTShare,
        totalCommission,
        netPlatformProfit,
        pendingSettlements,
      },
      period,
    });

  } catch (error) {
    console.error('Agent settlement API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getMasterSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, period, amount, action } = body;

    if (!agentId || !period || action !== 'settle') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const [startDate, endDate] = period.split('_');
    const supabase = await createClient();

    // Check if already settled
    const { data: existingSettlement } = await supabase
      .from('agent_settlements')
      .select('id, status')
      .eq('agent_id', agentId)
      .eq('period_start', startDate)
      .eq('period_end', endDate)
      .single();

    if (existingSettlement?.status === 'settled') {
      return NextResponse.json({ error: 'Already settled' }, { status: 400 });
    }

    // Create or update settlement record
    const settlementData = {
      agent_id: agentId,
      period_start: startDate,
      period_end: endDate,
      settlement_amount: amount,
      status: 'settled',
      settled_by: session.userId,
      settled_at: new Date().toISOString(),
    };

    if (existingSettlement) {
      await supabase
        .from('agent_settlements')
        .update(settlementData)
        .eq('id', existingSettlement.id);
    } else {
      await supabase
        .from('agent_settlements')
        .insert(settlementData);
    }

    // Record transaction
    await supabase.from('transactions').insert({
      user_id: agentId,
      transaction_type: 'settlement',
      amount: Math.abs(amount),
      process_type: amount > 0 ? 'credit' : 'debit',
      status: 'completed',
      description: `Weekly settlement for ${startDate} to ${endDate}`,
      reference_type: 'agent_settlement',
      verified_by: session.userId,
      verified_at: new Date().toISOString(),
    });

    // Log to audit
    await supabase.from('audit_logs').insert({
      user_id: session.userId,
      action: 'agent_settlement',
      entity_type: 'agent',
      entity_id: agentId,
      changes: {
        period,
        amount,
        action: 'settle',
      },
    });

    return NextResponse.json({ success: true, message: 'Settlement completed' });

  } catch (error) {
    console.error('Agent settlement POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function
function getCurrentWeekRange(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return `${monday.toISOString().split('T')[0]}_${sunday.toISOString().split('T')[0]}`;
}
