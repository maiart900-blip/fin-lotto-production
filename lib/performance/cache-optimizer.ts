/**
 * Performance Cache Optimizer for FIN LOTTO R+
 * =============================================
 * Optimized caching strategies for Dashboard and Betting pages
 * Target: < 100ms latency for all critical operations
 */

import { redis, REDIS_KEYS, TTL } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

// Cache key prefixes
const CACHE_KEYS = {
  DASHBOARD_STATS: (userId: string, role: string) => `cache:dashboard:${role}:${userId}`,
  LOTTERY_RATES: (lotteryId: string) => `cache:rates:${lotteryId}`,
  MARKET_STATUS: (lotteryId: string) => `cache:market:${lotteryId}`,
  AGENT_SUMMARY: (agentId: string) => `cache:agent:summary:${agentId}`,
  CUSTOMER_VIP: (customerId: string) => `cache:vip:${customerId}`,
  HOT_NUMBERS: (lotteryId: string) => `cache:hot:${lotteryId}`,
  BLOCKED_NUMBERS: (lotteryId: string) => `cache:blocked:${lotteryId}`,
};

// Cache TTLs in seconds
const CACHE_TTL = {
  DASHBOARD_STATS: 30,      // 30 seconds - frequently updated
  LOTTERY_RATES: 300,       // 5 minutes - rarely changes
  MARKET_STATUS: 60,        // 1 minute - may change during draw
  AGENT_SUMMARY: 60,        // 1 minute
  CUSTOMER_VIP: 3600,       // 1 hour - rarely changes
  HOT_NUMBERS: 60,          // 1 minute - real-time data
  BLOCKED_NUMBERS: 30,      // 30 seconds - critical for betting
};

/**
 * Get cached data with automatic refresh
 */
async function getCachedData<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  try {
    // Try to get from cache
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached as string) as T;
    }

    // Fetch fresh data
    const data = await fetchFn();
    
    // Store in cache
    await redis.set(key, JSON.stringify(data), { ex: ttl });
    
    return data;
  } catch (error) {
    console.error(`Cache error for ${key}:`, error);
    // Fallback to direct fetch
    return await fetchFn();
  }
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Optimized Dashboard Stats (Master/Agent)
 * Pre-aggregated data for instant loading
 */
export async function getDashboardStats(userId: string, role: 'master' | 'agent') {
  const cacheKey = CACHE_KEYS.DASHBOARD_STATS(userId, role);
  
  return getCachedData(cacheKey, CACHE_TTL.DASHBOARD_STATS, async () => {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Parallel fetch all stats
    const [
      todayStats,
      pendingDeposits,
      pendingWithdrawals,
      activeCustomers,
    ] = await Promise.all([
      // Today's betting stats
      supabase
        .from('entries')
        .select('total_amount.sum(), id.count()')
        .gte('created_at', `${today}T00:00:00Z`)
        .eq(role === 'agent' ? 'agent_id' : 'status', role === 'agent' ? userId : 'confirmed'),
      
      // Pending deposits
      supabase
        .from('topup_requests')
        .select('amount.sum(), id.count()')
        .eq('status', 'pending'),
      
      // Pending withdrawals
      supabase
        .from('withdraw_requests')
        .select('amount.sum(), id.count()')
        .eq('status', 'pending'),
      
      // Active customers (online in last 5 min)
      supabase
        .from('customers')
        .select('id.count()')
        .gte('last_active_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()),
    ]);

    return {
      today: {
        betCount: todayStats.count || 0,
        betVolume: todayStats.data?.[0]?.sum || 0,
      },
      pending: {
        deposits: pendingDeposits.count || 0,
        depositAmount: pendingDeposits.data?.[0]?.sum || 0,
        withdrawals: pendingWithdrawals.count || 0,
        withdrawalAmount: pendingWithdrawals.data?.[0]?.sum || 0,
      },
      activeCustomers: activeCustomers.count || 0,
      cachedAt: new Date().toISOString(),
    };
  });
}

/**
 * Optimized Lottery Rates for Betting Page
 * Critical for fast key-in experience
 */
export async function getLotteryRates(lotteryId: string) {
  const cacheKey = CACHE_KEYS.LOTTERY_RATES(lotteryId);
  
  return getCachedData(cacheKey, CACHE_TTL.LOTTERY_RATES, async () => {
    const supabase = await createClient();
    
    const { data: lottery } = await supabase
      .from('lotteries')
      .select(`
        id, name, status,
        payout_rates,
        min_bet, max_bet,
        commission_rate
      `)
      .eq('id', lotteryId)
      .single();

    return lottery;
  });
}

/**
 * Get all blocked numbers for a lottery (critical for betting validation)
 */
export async function getBlockedNumbers(lotteryId: string): Promise<Set<string>> {
  const cacheKey = CACHE_KEYS.BLOCKED_NUMBERS(lotteryId);
  
  const data = await getCachedData(cacheKey, CACHE_TTL.BLOCKED_NUMBERS, async () => {
    const supabase = await createClient();
    
    const { data: blocked } = await supabase
      .from('liability_limits')
      .select('number, bet_type')
      .eq('lottery_id', lotteryId)
      .eq('is_blocked', true);

    return blocked?.map(b => `${b.number}:${b.bet_type}`) || [];
  });

  return new Set(data);
}

/**
 * Get hot numbers (high volume) for risk display
 */
export async function getHotNumbers(lotteryId: string, limit: number = 10) {
  const cacheKey = CACHE_KEYS.HOT_NUMBERS(lotteryId);
  
  return getCachedData(cacheKey, CACHE_TTL.HOT_NUMBERS, async () => {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    
    const { data: hotNumbers } = await supabase
      .from('entries')
      .select('number, bet_type, total_amount.sum()')
      .eq('lottery_id', lotteryId)
      .gte('created_at', `${today}T00:00:00Z`)
      .order('sum', { ascending: false })
      .limit(limit);

    return hotNumbers || [];
  });
}

/**
 * Get customer VIP info for dynamic rates
 */
export async function getCustomerVIP(customerId: string) {
  const cacheKey = CACHE_KEYS.CUSTOMER_VIP(customerId);
  
  return getCachedData(cacheKey, CACHE_TTL.CUSTOMER_VIP, async () => {
    const supabase = await createClient();
    
    const { data: customer } = await supabase
      .from('customers')
      .select(`
        id, vip_level, vip_points,
        vip_levels!inner(
          id, name, payout_bonus, rebate_rate, max_bet_multiplier
        )
      `)
      .eq('id', customerId)
      .single();

    return customer;
  });
}

/**
 * Prefetch critical data for betting page
 * Called when user navigates to betting page
 */
export async function prefetchBettingData(
  lotteryId: string,
  customerId?: string
): Promise<void> {
  // Parallel prefetch all critical data
  await Promise.all([
    getLotteryRates(lotteryId),
    getBlockedNumbers(lotteryId),
    getHotNumbers(lotteryId),
    customerId ? getCustomerVIP(customerId) : Promise.resolve(null),
  ]);
}

/**
 * Batch validate numbers against blocked list
 * Optimized for bulk betting (e.g., swipe front/back)
 */
export async function batchValidateNumbers(
  lotteryId: string,
  numbers: { number: string; betType: string }[]
): Promise<{
  valid: { number: string; betType: string }[];
  blocked: { number: string; betType: string; reason: string }[];
}> {
  const blockedSet = await getBlockedNumbers(lotteryId);
  
  const valid: { number: string; betType: string }[] = [];
  const blocked: { number: string; betType: string; reason: string }[] = [];

  for (const item of numbers) {
    const key = `${item.number}:${item.betType}`;
    if (blockedSet.has(key)) {
      blocked.push({ ...item, reason: 'เลขอั้น' });
    } else {
      valid.push(item);
    }
  }

  return { valid, blocked };
}

/**
 * Real-time volume check using Redis (no DB hit)
 */
export async function checkVolumeLimit(
  lotteryId: string,
  number: string,
  betType: string,
  amount: number
): Promise<{
  allowed: boolean;
  currentVolume: number;
  limit: number;
  remaining: number;
}> {
  const volumeKey = REDIS_KEYS.BET_VOLUME(lotteryId, `${number}:${betType}`);
  const limitKey = REDIS_KEYS.LIABILITY_LIMIT(lotteryId, `${number}:${betType}`);
  const defaultLimitKey = REDIS_KEYS.LIABILITY_DEFAULT(lotteryId);

  // Parallel Redis calls
  const [currentVolume, specificLimit, defaultLimit] = await Promise.all([
    redis.get(volumeKey),
    redis.get(limitKey),
    redis.get(defaultLimitKey),
  ]);

  const volume = Number(currentVolume) || 0;
  const limit = Number(specificLimit) || Number(defaultLimit) || 100000;
  const remaining = Math.max(0, limit - volume);
  const allowed = (volume + amount) <= limit;

  return { allowed, currentVolume: volume, limit, remaining };
}

/**
 * Warm up cache for frequently accessed data
 * Called on server startup or periodically
 */
export async function warmUpCache(): Promise<void> {
  const supabase = await createClient();
  
  // Get all active lotteries
  const { data: lotteries } = await supabase
    .from('lotteries')
    .select('id')
    .eq('is_active', true);

  if (!lotteries) return;

  // Prefetch data for each lottery
  await Promise.all(
    lotteries.map(async (lottery) => {
      await Promise.all([
        getLotteryRates(lottery.id),
        getBlockedNumbers(lottery.id),
        getHotNumbers(lottery.id),
      ]);
    })
  );

  console.log(`Cache warmed up for ${lotteries.length} lotteries`);
}
