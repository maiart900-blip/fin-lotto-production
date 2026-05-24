/**
 * Data Flow Integration Hub for FIN LOTTO R+
 * ============================================
 * Central orchestrator that ensures all systems work together:
 * - Agent -> Master data sync
 * - Auto-Payout processing
 * - Commission calculation
 * - Real-time notifications
 */

import { createClient } from '@/lib/supabase/server';
import { redis, REDIS_KEYS, TTL, PUBSUB_CHANNELS } from '@/lib/redis';
import { CommandPipe, DataPipe } from '@/lib/double-pipe';
import { calculateAgentCommission, distributeCommissions } from '@/lib/commission/commission-system';
import { sendLineAlert, sendRiskWarning } from '@/lib/notifications/line-notify';

// Integration Status Types
export interface IntegrationStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'error';
  latency: number;
  lastCheck: string;
  details?: string;
}

export interface DataFlowMetrics {
  betsTodayCount: number;
  betsTodayVolume: number;
  pendingPayouts: number;
  pendingCommissions: number;
  activeAgents: number;
  avgLatencyMs: number;
}

/**
 * Process bet from Agent site -> Master
 * This is the main entry point when a bet is confirmed
 */
export async function processBetFromAgent(betData: {
  entryId: string;
  agentId: string;
  customerId: string;
  lotteryId: string;
  number: string;
  betType: string;
  amount: number;
  rate: number;
}): Promise<{
  success: boolean;
  commissionProcessed: boolean;
  riskChecked: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let commissionProcessed = false;
  let riskChecked = false;

  try {
    const supabase = await createClient();

    // 1. Update bet volume in Redis (for real-time risk tracking)
    const volumeKey = REDIS_KEYS.BET_VOLUME(betData.lotteryId, betData.number);
    await redis.incrby(volumeKey, Math.round(betData.amount));
    
    // 2. Check liability limit
    const limitKey = REDIS_KEYS.LIABILITY_LIMIT(betData.lotteryId, betData.number);
    const currentLimit = await redis.get(limitKey);
    const currentVolume = await redis.get(volumeKey);
    
    if (currentLimit && Number(currentVolume) > Number(currentLimit) * 0.8) {
      // Send warning if approaching limit
      const usagePercent = (Number(currentVolume) / Number(currentLimit)) * 100;
      await sendRiskWarning(
        betData.number,
        betData.lotteryId, // marketName
        Number(currentVolume),
        Number(currentLimit),
        usagePercent
      );
    }
    riskChecked = true;

    // 3. Process commission (idempotent - uses entry_id as unique key)
    try {
      const { data: commResult } = await supabase.rpc('process_entry_commission', {
        p_entry_id: betData.entryId,
        p_agent_id: betData.agentId,
        p_customer_id: betData.customerId,
        p_lottery_id: betData.lotteryId,
        p_bet_amount: betData.amount,
        p_bet_type: betData.betType,
      });

      if (commResult?.status === 'success' || commResult?.status === 'already_processed') {
        commissionProcessed = true;
      }
    } catch (commError) {
      errors.push(`Commission processing failed: ${commError}`);
    }

    // 4. Broadcast to Master Dashboard via Redis pub/sub
    await redis.publish(PUBSUB_CHANNELS.BET_FEED, JSON.stringify({
      type: 'NEW_BET',
      data: {
        ...betData,
        timestamp: new Date().toISOString(),
      },
    }));

    // 5. Update agent stats in Redis cache
    const agentStatsKey = `agent:stats:${betData.agentId}:${new Date().toISOString().split('T')[0]}`;
    await redis.hincrby(agentStatsKey, 'bet_count', 1);
    await redis.hincrby(agentStatsKey, 'bet_volume', Math.round(betData.amount));
    await redis.expire(agentStatsKey, 86400 * 2); // Keep for 2 days

    return {
      success: true,
      commissionProcessed,
      riskChecked,
      errors,
    };
  } catch (error) {
    errors.push(`Data flow error: ${error}`);
    return {
      success: false,
      commissionProcessed,
      riskChecked,
      errors,
    };
  }
}

/**
 * Process lottery result and trigger payout
 */
export async function processLotteryResult(
  lotteryId: string,
  roundId: string,
  resultNumbers: {
    first_prize: string;
    last_three_bottom: string;
    last_two: string;
  }
): Promise<{
  success: boolean;
  winnersCount: number;
  totalPayout: number;
  payoutJobId?: string;
}> {
  const supabase = await createClient();

  try {
    // 1. Mark round as completed
    await supabase
      .from('lottery_rounds')
      .update({ 
        status: 'completed',
        result: resultNumbers,
        completed_at: new Date().toISOString(),
      })
      .eq('id', roundId);

    // 2. Find all winning entries
    const winningNumbers = [
      { type: 'top_three', number: resultNumbers.first_prize.slice(-3) },
      { type: 'bottom_three', number: resultNumbers.last_three_bottom },
      { type: 'top_two', number: resultNumbers.first_prize.slice(-2) },
      { type: 'bottom_two', number: resultNumbers.last_two },
    ];

    const { data: winners, count } = await supabase
      .from('entries')
      .select('id, customer_id, agent_id, number, bet_type, amount, rate', { count: 'exact' })
      .eq('lottery_id', lotteryId)
      .eq('round_id', roundId)
      .eq('status', 'confirmed')
      .or(winningNumbers.map(w => `and(bet_type.eq.${w.type},number.eq.${w.number})`).join(','));

    if (!winners || winners.length === 0) {
      return { success: true, winnersCount: 0, totalPayout: 0 };
    }

    // 3. Calculate total payout
    const totalPayout = winners.reduce((sum, w) => sum + (w.amount * w.rate), 0);

    // 4. Create payout job
    const { data: payoutJob } = await supabase
      .from('payout_jobs')
      .insert({
        lottery_id: lotteryId,
        round_id: roundId,
        total_winners: count,
        total_payout: totalPayout,
        status: 'pending',
      })
      .select()
      .single();

    // 5. Queue batch payout processing
    // In production, this would use BullMQ
    await redis.lpush('payout_queue', JSON.stringify({
      jobId: payoutJob?.id,
      lotteryId,
      roundId,
      resultNumbers,
      winnersCount: count,
    }));

    // 6. Broadcast result to all agents
    const commandPipe = new CommandPipe();
    await commandPipe.sendCommand({
      type: 'broadcast_message',
      payload: {
        message: `ผลออก ${resultNumbers.first_prize} มีผู้ถูกรางวัล ${count} ราย`,
        lotteryId,
        roundId,
        resultNumbers,
      },
      priority: 'high',
      targetAgents: 'all',
      createdBy: 'system',
    });

    return {
      success: true,
      winnersCount: count || 0,
      totalPayout,
      payoutJobId: payoutJob?.id,
    };
  } catch (error) {
    console.error('Process lottery result error:', error);
    return { success: false, winnersCount: 0, totalPayout: 0 };
  }
}

/**
 * Daily commission settlement for all agents
 */
export async function runDailyCommissionSettlement(): Promise<{
  success: boolean;
  agentsProcessed: number;
  totalCommissionPaid: number;
  errors: string[];
}> {
  const supabase = await createClient();
  const errors: string[] = [];
  let totalCommissionPaid = 0;

  try {
    // Get all active agents
    const { data: agents } = await supabase
      .from('agents')
      .select('id, code, name')
      .eq('status', 'active');

    if (!agents) {
      return { success: false, agentsProcessed: 0, totalCommissionPaid: 0, errors: ['No agents found'] };
    }

    const today = new Date().toISOString().split('T')[0];
    const startDate = `${today}T00:00:00Z`;
    const endDate = `${today}T23:59:59Z`;

    for (const agent of agents) {
      try {
        const commission = await calculateAgentCommission(agent.id, startDate, endDate);
        
        if (commission.totalCommission > 0) {
          await distributeCommissions([commission], 'system');
          
          totalCommissionPaid += commission.totalCommission;
        }
      } catch (agentError) {
        errors.push(`Agent ${agent.code}: ${agentError}`);
      }
    }

    return {
      success: errors.length === 0,
      agentsProcessed: agents.length,
      totalCommissionPaid,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      agentsProcessed: 0,
      totalCommissionPaid: 0,
      errors: [`Settlement error: ${error}`],
    };
  }
}

/**
 * Health check for all integration components
 */
export async function checkIntegrationHealth(): Promise<{
  overall: 'healthy' | 'degraded' | 'error';
  components: IntegrationStatus[];
  metrics: DataFlowMetrics;
}> {
  const components: IntegrationStatus[] = [];
  const now = new Date().toISOString();

  // Check Supabase
  const supabaseStart = Date.now();
  try {
    const supabase = await createClient();
    await supabase.from('lotteries').select('id').limit(1);
    components.push({
      component: 'Supabase',
      status: 'healthy',
      latency: Date.now() - supabaseStart,
      lastCheck: now,
    });
  } catch (error) {
    components.push({
      component: 'Supabase',
      status: 'error',
      latency: Date.now() - supabaseStart,
      lastCheck: now,
      details: String(error),
    });
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    await redis.ping();
    components.push({
      component: 'Redis',
      status: 'healthy',
      latency: Date.now() - redisStart,
      lastCheck: now,
    });
  } catch (error) {
    components.push({
      component: 'Redis',
      status: 'error',
      latency: Date.now() - redisStart,
      lastCheck: now,
      details: String(error),
    });
  }

  // Calculate metrics
  const today = new Date().toISOString().split('T')[0];
  let metrics: DataFlowMetrics = {
    betsTodayCount: 0,
    betsTodayVolume: 0,
    pendingPayouts: 0,
    pendingCommissions: 0,
    activeAgents: 0,
    avgLatencyMs: 0,
  };

  try {
    const supabase = await createClient();
    
    // Get today's bet stats
    const { count: betCount } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00Z`);
    
    metrics.betsTodayCount = betCount || 0;

    // Get active agents count
    const { count: agentCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    metrics.activeAgents = agentCount || 0;

    // Get pending payouts
    const { count: payoutCount } = await supabase
      .from('payout_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    metrics.pendingPayouts = payoutCount || 0;

    // Calculate average latency
    metrics.avgLatencyMs = components.reduce((sum, c) => sum + c.latency, 0) / components.length;
  } catch (error) {
    console.error('Metrics calculation error:', error);
  }

  // Determine overall status
  const hasError = components.some(c => c.status === 'error');
  const hasDegraded = components.some(c => c.status === 'degraded');
  const overall = hasError ? 'error' : hasDegraded ? 'degraded' : 'healthy';

  return { overall, components, metrics };
}

/**
 * Sync all data from Master to Agent (full refresh)
 */
export async function fullSyncToAgent(agentId: string): Promise<{
  success: boolean;
  syncedItems: {
    markets: number;
    rates: number;
    blockedNumbers: number;
    limits: number;
  };
}> {
  const supabase = await createClient();

  try {
    // Get all active markets
    const { data: markets } = await supabase
      .from('lotteries')
      .select('*')
      .eq('is_active', true);

    // Get all blocked numbers
    const { data: blockedNumbers } = await supabase
      .from('liability_limits')
      .select('lottery_id, number, bet_type')
      .eq('is_blocked', true);

    // Cache in Redis for quick access
    const syncData = {
      markets: markets || [],
      blockedNumbers: blockedNumbers || [],
      syncedAt: new Date().toISOString(),
    };

    await redis.set(
      `agent:sync:${agentId}`,
      JSON.stringify(syncData),
      { ex: TTL.MARKET_STATUS }
    );

    return {
      success: true,
      syncedItems: {
        markets: markets?.length || 0,
        rates: markets?.length || 0,
        blockedNumbers: blockedNumbers?.length || 0,
        limits: blockedNumbers?.length || 0,
      },
    };
  } catch (error) {
    console.error('Full sync error:', error);
    return {
      success: false,
      syncedItems: { markets: 0, rates: 0, blockedNumbers: 0, limits: 0 },
    };
  }
}
