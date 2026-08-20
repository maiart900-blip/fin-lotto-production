/**
 * Agent Network Settlement API
 * Handles settlement calculations and processing for agent network
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/api-auth';

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
    const auth = await requireRole(['super_admin', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || getCurrentWeekRange();
    const [startDate, endDate] = period.split('_');

    const supabase = await createClient();

    // Get all agents with their settings
    // Real schema: users has display_name (not name), credit_balance + is_unlimited_credit
    // (no credit_limit), share_percent = ถือสู้/PT (no position_taking),
    // commission_percent/commission_rate, and agent tiers live in agent_tier.
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        role,
        agent_tier,
        credit_balance,
        is_unlimited_credit,
        commission_percent,
        commission_rate,
        share_percent,
        is_active,
        parent_agent_id
      `)
      .or('role.eq.agent,agent_tier.eq.master,agent_tier.eq.senior')
      .eq('is_active', true)
      .order('agent_tier', { ascending: true });

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
      // Get entries/bets for this agent within the period.
      // Real schema: entries.amount (bet stake), entries.payout_amount (win payout),
      // and status excludes archived rows.
      const { data: bets } = await supabase
        .from('entries')
        .select('amount, payout_amount, status')
        .eq('agent_id', agent.id)
        .neq('status', 'archived')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      const agentTotalBets = bets?.reduce((sum, b) => sum + Number(b.amount || 0), 0) || 0;
      const agentTotalWins = bets?.reduce((sum, b) => sum + Number(b.payout_amount || 0), 0) || 0;
      const agentGrossProfit = agentTotalBets - agentTotalWins;

      // Calculate PT share (ถือสู้ / Position Taking) from users.share_percent
      const ptPercent = Number(agent.share_percent) || 0;
      const ptShare = agentGrossProfit * (ptPercent / 100);

      // Calculate commission (based on total bets) — commission_percent, fallback commission_rate
      const commissionRate = Number(agent.commission_percent ?? agent.commission_rate) || 0;
      const commissionAmount = agentTotalBets * (commissionRate / 100);

      // Net settlement = PT share + Commission
      // Positive = agent receives money
      // Negative = agent pays money
      const netSettlement = ptShare + commissionAmount;

      // Get member (customer) count — customers live in the customers table, linked by agent_id
      const { count: memberCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', agent.id);

      // Get downline agent count — users.parent_agent_id points to the upline
      const { count: downlineCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('parent_agent_id', agent.id);

      // Check if already settled (agent_settlements uses paid_at, not settled_at)
      const { data: existingSettlement } = await supabase
        .from('agent_settlements')
        .select('status, paid_at')
        .eq('agent_id', agent.id)
        .eq('period_start', startDate)
        .eq('period_end', endDate)
        .maybeSingle();

      const status = existingSettlement?.status || 'pending';
      const settledAt = existingSettlement?.paid_at;

      if (status === 'pending' && netSettlement !== 0) {
        pendingSettlements++;
      }

      // Derive display level from agent_tier (master/senior) falling back to agent
      const level: 'master' | 'senior' | 'agent' =
        agent.agent_tier === 'master' ? 'master' : agent.agent_tier === 'senior' ? 'senior' : 'agent';
      // Real schema has no credit_limit/credit_used split — only credit_balance
      // (available balance) and an is_unlimited_credit flag.
      const creditBalance = Number(agent.credit_balance) || 0;

      agentSettlements.push({
        agentId: agent.id,
        agentCode: agent.username,
        agentName: agent.display_name || agent.username,
        level,
        creditLimit: agent.is_unlimited_credit ? 0 : creditBalance,
        creditUsed: 0,
        creditAvailable: creditBalance,
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
    const auth = await requireRole(['super_admin', 'admin']);
    if (auth instanceof NextResponse) return auth;
    const actorId = auth.user.id;

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
      .maybeSingle();

    if (existingSettlement?.status === 'settled') {
      return NextResponse.json({ error: 'Already settled' }, { status: 400 });
    }

    // Create or update settlement record.
    // Real agent_settlements schema: agent_id, amount, period_start, period_end,
    // note, status, paid_at (no settlement_amount/settled_by/settled_at columns).
    const settlementData = {
      agent_id: agentId,
      period_start: startDate,
      period_end: endDate,
      amount,
      status: 'settled',
      note: `Settled by ${actorId} on ${new Date().toISOString()}`,
      paid_at: new Date().toISOString(),
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

    // Record transaction (transactions is keyed by agent_id, not user_id)
    await supabase.from('transactions').insert({
      agent_id: agentId,
      transaction_type: 'settlement',
      amount: Math.abs(amount),
      process_type: amount > 0 ? 'credit' : 'debit',
      status: 'completed',
      description: `Weekly settlement for ${startDate} to ${endDate}`,
      reference_type: 'agent_settlement',
      verified_by: actorId,
      verified_at: new Date().toISOString(),
    });

    // Log to audit (real schema: table_name/record_id/new_data, no entity_type/entity_id/changes)
    await supabase.from('audit_logs').insert({
      user_id: actorId,
      actor_type: 'user',
      action: 'agent_settlement',
      table_name: 'agent_settlements',
      record_id: agentId,
      new_data: {
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
