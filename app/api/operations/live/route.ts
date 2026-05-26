/**
 * Live Operations API
 * Real-time metrics for day-1 operations monitoring
 */

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    // Parallel queries for performance
    const [
      activeCustomersRes,
      activeAgentsRes,
      recentBetsRes,
      exposureRes,
      pendingSettlementsRes,
      payoutQueueRes,
      failedPayoutsRes,
      depositStatsRes,
      withdrawStatsRes,
      topRiskNumbersRes,
    ] = await Promise.all([
      // Active customers (placed bet in last hour)
      supabase
        .from('entries')
        .select('customer_id', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo)
        .not('customer_id', 'is', null),
      
      // Active agents (created entry in last hour)
      supabase
        .from('entries')
        .select('agent_id', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo)
        .not('agent_id', 'is', null),
      
      // Bets in last 5 minutes (for bets per minute calculation)
      supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fiveMinAgo)
        .or('legacy_orphan.is.null,legacy_orphan.eq.false'),
      
      // Total exposure today
      supabase
        .from('entries')
        .select('amount')
        .gte('created_at', todayStart)
        .in('status', ['pending', 'confirmed', 'active'])
        .or('legacy_orphan.is.null,legacy_orphan.eq.false'),
      
      // Pending settlements (unprocessed results)
      supabase
        .from('lottery_results')
        .select('id', { count: 'exact', head: true })
        .eq('is_processed', false),
      
      // Payout queue (won entries pending payout)
      supabase
        .from('entries')
        .select('id, payout_amount', { count: 'exact' })
        .eq('status', 'won')
        .eq('payout_status', 'pending'),
      
      // Failed payouts
      supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('payout_status', 'failed'),
      
      // Deposit stats today
      supabase
        .from('deposit_requests')
        .select('status, amount')
        .gte('created_at', todayStart),
      
      // Withdraw stats today
      supabase
        .from('withdraw_requests')
        .select('status, amount')
        .gte('created_at', todayStart),
      
      // Top risk numbers (highest exposure)
      supabase
        .from('entries')
        .select('number, amount')
        .gte('created_at', todayStart)
        .in('status', ['pending', 'confirmed', 'active'])
        .or('legacy_orphan.is.null,legacy_orphan.eq.false'),
    ]);

    // Calculate metrics
    const totalExposure = (exposureRes.data || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const betsInFiveMin = recentBetsRes.count || 0;
    const betsPerMinute = Math.round(betsInFiveMin / 5 * 10) / 10;

    // Calculate payout queue amount
    const payoutQueueAmount = (payoutQueueRes.data || []).reduce(
      (sum, e) => sum + (Number(e.payout_amount) || 0), 0
    );

    // Calculate deposit/withdraw stats
    const deposits = depositStatsRes.data || [];
    const withdraws = withdrawStatsRes.data || [];
    
    const depositStats = {
      pending: deposits.filter(d => d.status === 'pending').length,
      pendingAmount: deposits.filter(d => d.status === 'pending').reduce((s, d) => s + Number(d.amount || 0), 0),
      completed: deposits.filter(d => d.status === 'completed' || d.status === 'approved').length,
      completedAmount: deposits.filter(d => d.status === 'completed' || d.status === 'approved').reduce((s, d) => s + Number(d.amount || 0), 0),
      failed: deposits.filter(d => d.status === 'failed' || d.status === 'rejected').length,
    };

    const withdrawStats = {
      pending: withdraws.filter(w => w.status === 'pending').length,
      pendingAmount: withdraws.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount || 0), 0),
      completed: withdraws.filter(w => w.status === 'completed' || w.status === 'approved').length,
      completedAmount: withdraws.filter(w => w.status === 'completed' || w.status === 'approved').reduce((s, w) => s + Number(w.amount || 0), 0),
      failed: withdraws.filter(w => w.status === 'failed' || w.status === 'rejected').length,
    };

    // Calculate top risk numbers
    const numberExposure: Record<string, number> = {};
    (topRiskNumbersRes.data || []).forEach(e => {
      const num = e.number || 'unknown';
      numberExposure[num] = (numberExposure[num] || 0) + Number(e.amount || 0);
    });
    const topRiskNumbers = Object.entries(numberExposure)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([number, exposure]) => ({ number, exposure }));

    // System health - check Redis and DB latency
    let redisLatency = -1;
    let dbLatency = -1;
    
    try {
      const redis = new Redis({
        url: process.env.KV_REST_API_URL!,
        token: process.env.KV_REST_API_TOKEN!,
      });
      const redisStart = Date.now();
      await redis.ping();
      redisLatency = Date.now() - redisStart;
    } catch {
      redisLatency = -1;
    }

    try {
      const dbStart = Date.now();
      await supabase.from('system_settings').select('key').limit(1);
      dbLatency = Date.now() - dbStart;
    } catch {
      dbLatency = -1;
    }

    const systemHealth = {
      status: redisLatency >= 0 && dbLatency >= 0 ? 'healthy' : 
              redisLatency >= 0 || dbLatency >= 0 ? 'degraded' : 'unhealthy',
      redis: { latency_ms: redisLatency, status: redisLatency >= 0 ? 'ok' : 'error' },
      database: { latency_ms: dbLatency, status: dbLatency >= 0 ? 'ok' : 'error' },
    };

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      metrics: {
        activeCustomers: activeCustomersRes.count || 0,
        activeAgents: activeAgentsRes.count || 0,
        betsPerMinute,
        totalExposure,
        pendingSettlements: pendingSettlementsRes.count || 0,
        payoutQueue: {
          count: payoutQueueRes.count || 0,
          amount: payoutQueueAmount,
        },
        failedPayouts: failedPayoutsRes.count || 0,
        depositStats,
        withdrawStats,
        topRiskNumbers,
        systemHealth,
      },
    });
  } catch (error) {
    console.error('[Operations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operations metrics' },
      { status: 500 }
    );
  }
}
