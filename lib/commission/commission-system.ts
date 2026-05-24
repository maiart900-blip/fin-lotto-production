/**
 * Commission System Library
 * Automated calculation and distribution of agent commissions
 * Based on downline's total bets with multi-tier support
 */

import { createClient } from '@/lib/supabase/server';

// Commission tier configuration
export interface CommissionTier {
  id: string;
  name: string;
  minBetVolume: number;      // Minimum bet volume to qualify
  commissionRate: number;    // Commission percentage (e.g., 5 = 5%)
  bonusRate: number;         // Bonus percentage for hitting targets
}

// Default commission tiers
export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  { id: 'bronze', name: 'Bronze', minBetVolume: 0, commissionRate: 3, bonusRate: 0 },
  { id: 'silver', name: 'Silver', minBetVolume: 100000, commissionRate: 5, bonusRate: 1 },
  { id: 'gold', name: 'Gold', minBetVolume: 500000, commissionRate: 7, bonusRate: 2 },
  { id: 'platinum', name: 'Platinum', minBetVolume: 1000000, commissionRate: 10, bonusRate: 3 },
  { id: 'diamond', name: 'Diamond', minBetVolume: 5000000, commissionRate: 12, bonusRate: 5 },
];

// Commission calculation result
export interface CommissionResult {
  agentId: string;
  agentCode: string;
  agentName: string;
  period: string;
  totalBetVolume: number;
  totalWinLoss: number;
  tier: CommissionTier;
  baseCommission: number;
  bonusCommission: number;
  totalCommission: number;
  downlineCount: number;
  breakdown: {
    directBets: number;
    downlineBets: number;
    directCommission: number;
    downlineCommission: number;
  };
}

// Multi-level commission rates (for downline levels)
export const MULTILEVEL_RATES = {
  level1: 100,  // 100% of commission rate for direct downline
  level2: 50,   // 50% of commission rate for level 2
  level3: 25,   // 25% of commission rate for level 3
};

/**
 * Calculate commission for a single agent
 */
export async function calculateAgentCommission(
  agentId: string,
  startDate: string,
  endDate: string,
  customTiers?: CommissionTier[]
): Promise<CommissionResult> {
  const supabase = await createClient();
  const tiers = customTiers || DEFAULT_COMMISSION_TIERS;

  // Get agent info
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (!agent) {
    throw new Error('Agent not found');
  }

  // Get direct bet volume (customers directly under this agent)
  const { data: directBets } = await supabase
    .from('entries')
    .select('total_amount')
    .eq('agent_id', agentId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const directBetVolume = directBets?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  // Get downline agents
  const { data: downlineAgents } = await supabase
    .from('agents')
    .select('id')
    .eq('parent_agent_id', agentId);

  // Calculate downline bet volume
  let downlineBetVolume = 0;
  if (downlineAgents && downlineAgents.length > 0) {
    const downlineIds = downlineAgents.map(a => a.id);
    const { data: downlineBets } = await supabase
      .from('entries')
      .select('total_amount')
      .in('agent_id', downlineIds)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    downlineBetVolume = downlineBets?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
  }

  const totalBetVolume = directBetVolume + downlineBetVolume;

  // Get win/loss for the period
  const { data: results } = await supabase
    .from('entries')
    .select('total_amount, payout_amount')
    .eq('agent_id', agentId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const totalBets = results?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;
  const totalPayout = results?.reduce((sum, r) => sum + (r.payout_amount || 0), 0) || 0;
  const totalWinLoss = totalBets - totalPayout;

  // Determine commission tier based on volume
  const tier = tiers.reduce((currentTier, t) => {
    if (totalBetVolume >= t.minBetVolume) {
      return t;
    }
    return currentTier;
  }, tiers[0]);

  // Calculate commissions
  const directCommission = directBetVolume * (tier.commissionRate / 100);
  const downlineCommission = downlineBetVolume * (tier.commissionRate / 100) * (MULTILEVEL_RATES.level1 / 100);
  const baseCommission = directCommission + downlineCommission;

  // Calculate bonus (if win/loss is positive for the house)
  const bonusCommission = totalWinLoss > 0 ? totalWinLoss * (tier.bonusRate / 100) : 0;

  const totalCommission = baseCommission + bonusCommission;

  return {
    agentId,
    agentCode: agent.code,
    agentName: agent.name,
    period: `${startDate} - ${endDate}`,
    totalBetVolume,
    totalWinLoss,
    tier,
    baseCommission,
    bonusCommission,
    totalCommission,
    downlineCount: downlineAgents?.length || 0,
    breakdown: {
      directBets: directBetVolume,
      downlineBets: downlineBetVolume,
      directCommission,
      downlineCommission,
    },
  };
}

/**
 * Calculate commission for all agents
 */
export async function calculateAllAgentsCommission(
  startDate: string,
  endDate: string
): Promise<CommissionResult[]> {
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from('agents')
    .select('id')
    .eq('status', 'active');

  if (!agents || agents.length === 0) {
    return [];
  }

  const results = await Promise.all(
    agents.map(agent => calculateAgentCommission(agent.id, startDate, endDate))
  );

  // Sort by total commission descending
  return results.sort((a, b) => b.totalCommission - a.totalCommission);
}

/**
 * Distribute commission to agents (credit their wallets)
 */
export async function distributeCommissions(
  results: CommissionResult[],
  adminId: string
): Promise<{ success: number; failed: number; totalDistributed: number }> {
  const supabase = await createClient();

  let success = 0;
  let failed = 0;
  let totalDistributed = 0;

  for (const result of results) {
    if (result.totalCommission <= 0) continue;

    try {
      // Start transaction - update agent credit balance
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          credit_balance: supabase.rpc('increment_credit', { amount: result.totalCommission }),
          total_commission: supabase.rpc('increment_commission', { amount: result.totalCommission }),
        })
        .eq('id', result.agentId);

      if (updateError) throw updateError;

      // Record the commission transaction
      await supabase.from('transactions').insert({
        agent_id: result.agentId,
        transaction_type: 'commission',
        amount: result.totalCommission,
        process_type: 'auto',
        status: 'completed',
        description: `Commission for period ${result.period}`,
        reference_type: 'commission',
        verified_by: adminId,
        verified_at: new Date().toISOString(),
      });

      // Log to audit
      await supabase.from('audit_logs').insert({
        user_id: adminId,
        action: 'commission_distribution',
        entity_type: 'agent',
        entity_id: result.agentId,
        changes: {
          period: result.period,
          totalBetVolume: result.totalBetVolume,
          tier: result.tier.name,
          commission: result.totalCommission,
        },
      });

      success++;
      totalDistributed += result.totalCommission;
    } catch (error) {
      console.error(`Failed to distribute commission to agent ${result.agentId}:`, error);
      failed++;
    }
  }

  return { success, failed, totalDistributed };
}

/**
 * Get commission history for an agent
 */
export async function getAgentCommissionHistory(
  agentId: string,
  limit: number = 12
): Promise<any[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('agent_id', agentId)
    .eq('transaction_type', 'commission')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get network commission summary
 */
export async function getNetworkCommissionSummary(
  startDate: string,
  endDate: string
): Promise<{
  totalAgents: number;
  totalCommission: number;
  totalBetVolume: number;
  avgCommissionRate: number;
  topAgents: CommissionResult[];
  tierDistribution: Record<string, number>;
}> {
  const results = await calculateAllAgentsCommission(startDate, endDate);

  const tierDistribution: Record<string, number> = {};
  results.forEach(r => {
    tierDistribution[r.tier.name] = (tierDistribution[r.tier.name] || 0) + 1;
  });

  const totalCommission = results.reduce((sum, r) => sum + r.totalCommission, 0);
  const totalBetVolume = results.reduce((sum, r) => sum + r.totalBetVolume, 0);

  return {
    totalAgents: results.length,
    totalCommission,
    totalBetVolume,
    avgCommissionRate: totalBetVolume > 0 ? (totalCommission / totalBetVolume) * 100 : 0,
    topAgents: results.slice(0, 10),
    tierDistribution,
  };
}
