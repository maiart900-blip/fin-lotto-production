/**
 * Risk Management System - FIN LOTTO R+
 * 
 * High-performance liability checking using Redis
 * Designed for massive concurrent users without system lag
 */

import { redis, REDIS_KEYS, TTL } from './redis';
import { createClient } from './supabase/server';

export interface BetCheckResult {
  allowed: boolean;
  currentVolume: number;
  limit: number;
  remainingCapacity: number;
  warningLevel: 'none' | 'caution' | 'warning' | 'critical';
  message?: string;
}

export interface LiabilityLimit {
  number?: string;
  betType?: string;
  maxAmount: number;
  currentVolume?: number;
}

/**
 * Check if a bet is within liability limits
 * Uses Redis for instant response (< 10ms)
 */
export async function checkBetLimit(
  lottoId: string,
  number: string,
  amount: number,
  betType?: string
): Promise<BetCheckResult> {
  try {
    // Get current volume from Redis (fastest)
    const volumeKey = REDIS_KEYS.BET_VOLUME(lottoId, number);
    const currentVolume = Number(await redis.get(volumeKey)) || 0;
    
    // Get limit (try specific number first, then default)
    const limitKey = REDIS_KEYS.LIABILITY_LIMIT(lottoId, number);
    const defaultLimitKey = REDIS_KEYS.LIABILITY_DEFAULT(lottoId);
    
    let limit = Number(await redis.get(limitKey));
    if (!limit) {
      limit = Number(await redis.get(defaultLimitKey)) || 100000; // Default 100k
    }
    
    // Check if number is blocked
    const blockedKey = REDIS_KEYS.BLOCKED_NUMBERS(lottoId);
    const blockedNumbers = await redis.smembers(blockedKey);
    
    if (blockedNumbers.includes(number)) {
      return {
        allowed: false,
        currentVolume,
        limit,
        remainingCapacity: 0,
        warningLevel: 'critical',
        message: `เลข ${number} ถูกอั้น ไม่สามารถรับแทงได้`,
      };
    }
    
    const newTotal = currentVolume + amount;
    const remainingCapacity = Math.max(0, limit - currentVolume);
    const usagePercent = (currentVolume / limit) * 100;
    
    // Determine warning level
    let warningLevel: BetCheckResult['warningLevel'] = 'none';
    if (usagePercent >= 95) warningLevel = 'critical';
    else if (usagePercent >= 80) warningLevel = 'warning';
    else if (usagePercent >= 60) warningLevel = 'caution';
    
    // Check if bet exceeds limit
    if (newTotal > limit) {
      return {
        allowed: false,
        currentVolume,
        limit,
        remainingCapacity,
        warningLevel: 'critical',
        message: `ยอดแทงเลข ${number} เต็มแล้ว (Limit: ${limit.toLocaleString()} บาท)`,
      };
    }
    
    return {
      allowed: true,
      currentVolume,
      limit,
      remainingCapacity: limit - newTotal,
      warningLevel,
      message: warningLevel !== 'none' 
        ? `เลข ${number} ใกล้เต็ม (${usagePercent.toFixed(1)}%)` 
        : undefined,
    };
  } catch (error) {
    console.error('[Risk] checkBetLimit error:', error);
    // Fallback to database if Redis fails
    return await checkBetLimitFromDB(lottoId, number, amount);
  }
}

/**
 * Fallback: Check limit from database (slower but reliable)
 */
async function checkBetLimitFromDB(
  lottoId: string,
  number: string,
  amount: number
): Promise<BetCheckResult> {
  const supabase = await createClient();
  
  // Get current volume from entries
  const today = new Date().toISOString().split('T')[0];
  const { data: entries } = await supabase
    .from('entries')
    .select('amount')
    .eq('lottery_id', lottoId)
    .eq('numbers', number)
    .gte('created_at', today);
  
  const currentVolume = entries?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  
  // Get limit from settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'liability_limits')
    .single();
  
  const limits = settings?.setting_value?.limits || {};
  const limit = limits[`${lottoId}:${number}`] || limits[`${lottoId}:default`] || 100000;
  
  const newTotal = currentVolume + amount;
  
  return {
    allowed: newTotal <= limit,
    currentVolume,
    limit,
    remainingCapacity: Math.max(0, limit - newTotal),
    warningLevel: newTotal > limit * 0.8 ? 'warning' : 'none',
  };
}

/**
 * Record a bet and update volume tracking
 */
export async function recordBetVolume(
  lottoId: string,
  number: string,
  amount: number
): Promise<void> {
  try {
    const volumeKey = REDIS_KEYS.BET_VOLUME(lottoId, number);
    const totalKey = REDIS_KEYS.BET_VOLUME_TOTAL(lottoId);
    
    // Atomic increment
    await Promise.all([
      redis.incrby(volumeKey, amount),
      redis.incrby(totalKey, amount),
      redis.expire(volumeKey, TTL.BET_VOLUME),
      redis.expire(totalKey, TTL.BET_VOLUME),
    ]);
  } catch (error) {
    console.error('[Risk] recordBetVolume error:', error);
  }
}

/**
 * Reverse a bet volume (for cancellations/refunds)
 */
export async function reverseBetVolume(
  lottoId: string,
  number: string,
  amount: number
): Promise<void> {
  try {
    const volumeKey = REDIS_KEYS.BET_VOLUME(lottoId, number);
    const totalKey = REDIS_KEYS.BET_VOLUME_TOTAL(lottoId);
    
    await Promise.all([
      redis.decrby(volumeKey, amount),
      redis.decrby(totalKey, amount),
    ]);
  } catch (error) {
    console.error('[Risk] reverseBetVolume error:', error);
  }
}

/**
 * Set liability limit for a specific number
 */
export async function setLiabilityLimit(
  lottoId: string,
  number: string | 'default',
  maxAmount: number
): Promise<void> {
  const key = number === 'default'
    ? REDIS_KEYS.LIABILITY_DEFAULT(lottoId)
    : REDIS_KEYS.LIABILITY_LIMIT(lottoId, number);
  
  await redis.set(key, maxAmount);
}

/**
 * Block a number from receiving bets
 */
export async function blockNumber(lottoId: string, number: string): Promise<void> {
  const key = REDIS_KEYS.BLOCKED_NUMBERS(lottoId);
  await redis.sadd(key, number);
}

/**
 * Unblock a number
 */
export async function unblockNumber(lottoId: string, number: string): Promise<void> {
  const key = REDIS_KEYS.BLOCKED_NUMBERS(lottoId);
  await redis.srem(key, number);
}

/**
 * Get all blocked numbers for a lottery
 */
export async function getBlockedNumbers(lottoId: string): Promise<string[]> {
  const key = REDIS_KEYS.BLOCKED_NUMBERS(lottoId);
  return await redis.smembers(key);
}

/**
 * Get current volume for all numbers in a lottery
 */
export async function getLotteryVolumes(lottoId: string): Promise<Record<string, number>> {
  try {
    // Scan for all volume keys for this lottery
    const pattern = `bet:volume:${lottoId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) return {};
    
    const values = await redis.mget(...keys);
    const volumes: Record<string, number> = {};
    
    keys.forEach((key, index) => {
      const number = key.split(':').pop()!;
      volumes[number] = Number(values[index]) || 0;
    });
    
    return volumes;
  } catch (error) {
    console.error('[Risk] getLotteryVolumes error:', error);
    return {};
  }
}

/**
 * Sync liability limits from database to Redis
 */
export async function syncLimitsToRedis(lottoId?: string): Promise<void> {
  const supabase = await createClient();
  
  const { data: settings } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'liability_limits')
    .single();
  
  if (!settings?.setting_value?.limits) return;
  
  const limits = settings.setting_value.limits as Record<string, number>;
  const pipeline: Promise<any>[] = [];
  
  for (const [key, value] of Object.entries(limits)) {
    const [lotto, number] = key.split(':');
    if (lottoId && lotto !== lottoId) continue;
    
    if (number === 'default') {
      pipeline.push(redis.set(REDIS_KEYS.LIABILITY_DEFAULT(lotto), value));
    } else {
      pipeline.push(redis.set(REDIS_KEYS.LIABILITY_LIMIT(lotto, number), value));
    }
  }
  
  await Promise.all(pipeline);
}
