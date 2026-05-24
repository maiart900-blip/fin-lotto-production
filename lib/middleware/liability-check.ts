/**
 * Liability Limit Middleware
 * ระบบตรวจสอบวงเงินรับความเสี่ยงก่อนรับ Bet
 * ใช้ Redis สำหรับ High-Performance Real-time Check
 */

import { redis, REDIS_KEYS, REDIS_TTL } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

// Types
export interface LiabilityCheckRequest {
  lotteryId: string;
  agentId?: string;
  number: string;
  betType: string;
  amount: number;
}

export interface LiabilityCheckResult {
  allowed: boolean;
  currentVolume: number;
  limit: number;
  remaining: number;
  warningLevel: 'none' | 'warning' | 'critical' | 'blocked';
  message: string;
  rateReduction?: number;
}

export interface LiabilityLimit {
  maxAmount: number;
  warningThreshold: number;
  currentVolume: number;
  isBlocked: boolean;
  reducedRate?: number;
}

// Redis Key Patterns
const KEYS = {
  // Volume tracking: volume:{lotteryId}:{betType}:{number}
  volume: (lotteryId: string, betType: string, number: string) =>
    `liability:volume:${lotteryId}:${betType}:${number}`,
  
  // Limit config: limit:{lotteryId}:{betType}:{number}
  limit: (lotteryId: string, betType: string, number: string) =>
    `liability:limit:${lotteryId}:${betType}:${number}`,
  
  // Global limit: limit:{lotteryId}:{betType}:global
  globalLimit: (lotteryId: string, betType: string) =>
    `liability:limit:${lotteryId}:${betType}:global`,
  
  // Blocked numbers: blocked:{lotteryId}
  blocked: (lotteryId: string) =>
    `liability:blocked:${lotteryId}`,
  
  // Agent volume: agent_volume:{agentId}:{lotteryId}:{number}
  agentVolume: (agentId: string, lotteryId: string, number: string) =>
    `liability:agent:${agentId}:${lotteryId}:${number}`,
};

/**
 * Main Liability Check Middleware
 * ตรวจสอบวงเงินก่อนรับ Bet - Response time < 10ms
 */
export async function checkLiabilityLimit(
  request: LiabilityCheckRequest
): Promise<LiabilityCheckResult> {
  const { lotteryId, agentId, number, betType, amount } = request;

  try {
    // 1. Check if number is blocked (fastest check first)
    const blockedKey = KEYS.blocked(lotteryId);
    const isBlocked = await redis.sismember(blockedKey, `${betType}:${number}`);
    
    if (isBlocked) {
      return {
        allowed: false,
        currentVolume: 0,
        limit: 0,
        remaining: 0,
        warningLevel: 'blocked',
        message: `เลข ${number} (${betType}) ถูกอั้นแล้ว ไม่สามารถแทงได้`,
      };
    }

    // 2. Get limit config (try specific first, then global)
    const limitKey = KEYS.limit(lotteryId, betType, number);
    const globalLimitKey = KEYS.globalLimit(lotteryId, betType);
    
    let limitData = await redis.hgetall(limitKey);
    
    if (!limitData || Object.keys(limitData).length === 0) {
      // Try global limit
      limitData = await redis.hgetall(globalLimitKey);
    }
    
    // Fallback to database if not in Redis
    if (!limitData || Object.keys(limitData).length === 0) {
      limitData = await loadLimitFromDatabase(lotteryId, betType, number);
    }

    const maxAmount = Number(limitData?.maxAmount) || 50000; // Default 50k
    const warningThreshold = Number(limitData?.warningThreshold) || 80;
    const reducedRate = limitData?.reducedRate ? Number(limitData.reducedRate) : undefined;

    // 3. Get current volume
    const volumeKey = KEYS.volume(lotteryId, betType, number);
    const currentVolume = Number(await redis.get(volumeKey)) || 0;

    // 4. Calculate remaining and check
    const remaining = maxAmount - currentVolume;
    const newTotal = currentVolume + amount;
    const usagePercent = (newTotal / maxAmount) * 100;

    // Determine warning level
    let warningLevel: LiabilityCheckResult['warningLevel'] = 'none';
    if (usagePercent >= 100) {
      warningLevel = 'blocked';
    } else if (usagePercent >= 95) {
      warningLevel = 'critical';
    } else if (usagePercent >= warningThreshold) {
      warningLevel = 'warning';
    }

    // 5. Check if bet is allowed
    if (amount > remaining) {
      return {
        allowed: false,
        currentVolume,
        limit: maxAmount,
        remaining: Math.max(0, remaining),
        warningLevel: remaining <= 0 ? 'blocked' : 'critical',
        message: remaining <= 0 
          ? `เลข ${number} เต็มแล้ว (${currentVolume.toLocaleString()}/${maxAmount.toLocaleString()})`
          : `ยอดแทงเกินวงเงินที่เหลือ (คงเหลือ: ${remaining.toLocaleString()} บาท)`,
        rateReduction: reducedRate,
      };
    }

    // 6. Allowed - Return success with warning info
    return {
      allowed: true,
      currentVolume,
      limit: maxAmount,
      remaining: remaining - amount,
      warningLevel,
      message: warningLevel === 'warning' 
        ? `เตือน: เลข ${number} ใกล้เต็มแล้ว (${usagePercent.toFixed(0)}%)`
        : warningLevel === 'critical'
        ? `วิกฤต: เลข ${number} เกือบเต็ม (${usagePercent.toFixed(0)}%)`
        : 'OK',
      rateReduction: reducedRate,
    };

  } catch (error) {
    console.error('[Liability Check] Error:', error);
    
    // Fallback: Allow bet but log error
    return {
      allowed: true,
      currentVolume: 0,
      limit: 50000,
      remaining: 50000,
      warningLevel: 'none',
      message: 'ไม่สามารถตรวจสอบวงเงินได้ - อนุญาตแบบ Fallback',
    };
  }
}

/**
 * Record Bet Volume
 * บันทึกยอดแทงลง Redis หลังจากรับ Bet สำเร็จ
 */
export async function recordBetVolume(
  lotteryId: string,
  betType: string,
  number: string,
  amount: number,
  agentId?: string
): Promise<{ newVolume: number; agentVolume?: number }> {
  const volumeKey = KEYS.volume(lotteryId, betType, number);
  
  // Atomic increment
  const newVolume = await redis.incrby(volumeKey, amount);
  
  // Set TTL if this is a new key (24 hours default)
  const ttl = await redis.ttl(volumeKey);
  if (ttl === -1) {
    await redis.expire(volumeKey, 86400); // 24 hours
  }

  // Also track agent-specific volume if provided
  let agentVolume: number | undefined;
  if (agentId) {
    const agentVolumeKey = KEYS.agentVolume(agentId, lotteryId, number);
    agentVolume = await redis.incrby(agentVolumeKey, amount);
    
    const agentTtl = await redis.ttl(agentVolumeKey);
    if (agentTtl === -1) {
      await redis.expire(agentVolumeKey, 86400);
    }
  }

  return { newVolume, agentVolume };
}

/**
 * Set Liability Limit
 * ตั้งค่าวงเงินสูงสุดต่อเลข
 */
export async function setLiabilityLimit(
  lotteryId: string,
  betType: string,
  number: string | null, // null = global limit for bet type
  limit: Omit<LiabilityLimit, 'currentVolume'>
): Promise<boolean> {
  const key = number 
    ? KEYS.limit(lotteryId, betType, number)
    : KEYS.globalLimit(lotteryId, betType);

  await redis.hset(key, {
    maxAmount: limit.maxAmount.toString(),
    warningThreshold: limit.warningThreshold.toString(),
    isBlocked: limit.isBlocked ? '1' : '0',
    ...(limit.reducedRate !== undefined && { reducedRate: limit.reducedRate.toString() }),
  });

  // Also save to database for persistence
  await saveLimitToDatabase(lotteryId, betType, number, limit);

  return true;
}

/**
 * Block Number
 * อั้นเลขทันที
 */
export async function blockNumber(
  lotteryId: string,
  betType: string,
  number: string,
  reason?: string
): Promise<boolean> {
  const blockedKey = KEYS.blocked(lotteryId);
  await redis.sadd(blockedKey, `${betType}:${number}`);
  
  // Update limit config
  const limitKey = KEYS.limit(lotteryId, betType, number);
  await redis.hset(limitKey, { isBlocked: '1' });

  // Save to database
  const supabase = await createClient();
  await supabase
    .from('liability_limits')
    .upsert({
      lottery_id: lotteryId,
      bet_type: betType,
      number: number,
      is_blocked: true,
      blocked_at: new Date().toISOString(),
      block_reason: reason,
    }, {
      onConflict: 'lottery_id,bet_type,number',
    });

  return true;
}

/**
 * Unblock Number
 * ปลดอั้นเลข
 */
export async function unblockNumber(
  lotteryId: string,
  betType: string,
  number: string
): Promise<boolean> {
  const blockedKey = KEYS.blocked(lotteryId);
  await redis.srem(blockedKey, `${betType}:${number}`);
  
  // Update limit config
  const limitKey = KEYS.limit(lotteryId, betType, number);
  await redis.hset(limitKey, { isBlocked: '0' });

  // Update database
  const supabase = await createClient();
  await supabase
    .from('liability_limits')
    .update({
      is_blocked: false,
      blocked_at: null,
      block_reason: null,
    })
    .eq('lottery_id', lotteryId)
    .eq('bet_type', betType)
    .eq('number', number);

  return true;
}

/**
 * Get Volume Summary
 * ดึงยอดรวมทั้งหมดของหวยนั้น
 */
export async function getVolumeSummary(
  lotteryId: string,
  betType?: string
): Promise<Record<string, number>> {
  const pattern = betType 
    ? `liability:volume:${lotteryId}:${betType}:*`
    : `liability:volume:${lotteryId}:*`;

  const keys = await redis.keys(pattern);
  const summary: Record<string, number> = {};

  for (const key of keys) {
    const parts = key.split(':');
    const number = parts[parts.length - 1];
    const type = parts[parts.length - 2];
    const volume = Number(await redis.get(key)) || 0;
    
    const displayKey = betType ? number : `${type}:${number}`;
    summary[displayKey] = volume;
  }

  return summary;
}

/**
 * Sync Limits to All Agents
 * กระจาย Limit ไปยังเว็บลูกทั้งหมด
 */
export async function syncLimitsToAgents(
  lotteryId: string,
  betType?: string
): Promise<{ synced: number; failed: number }> {
  const supabase = await createClient();
  
  // Get all active agents
  const { data: agents } = await supabase
    .from('agents')
    .select('id, api_key, site_url')
    .eq('status', 'active');

  if (!agents?.length) return { synced: 0, failed: 0 };

  // Get all limits for this lottery
  const { data: limits } = await supabase
    .from('liability_limits')
    .select('*')
    .eq('lottery_id', lotteryId)
    .eq('sync_to_agents', true);

  // Get blocked numbers from Redis
  const blockedKey = KEYS.blocked(lotteryId);
  const blockedNumbers = await redis.smembers(blockedKey);

  const payload = {
    type: 'liability_sync',
    lotteryId,
    limits: limits || [],
    blockedNumbers,
    timestamp: new Date().toISOString(),
  };

  // Push to all agents in parallel
  let synced = 0;
  let failed = 0;

  await Promise.allSettled(
    agents.map(async (agent) => {
      if (!agent.site_url) return;
      
      try {
        const response = await fetch(`${agent.site_url}/api/network/receive`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': agent.api_key || '',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    })
  );

  // Update sync timestamp
  await supabase
    .from('liability_limits')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('lottery_id', lotteryId);

  return { synced, failed };
}

/**
 * Reset Volume
 * รีเซ็ตยอดแทงเมื่อเริ่มรอบใหม่
 */
export async function resetVolume(lotteryId: string): Promise<number> {
  const pattern = `liability:volume:${lotteryId}:*`;
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  return keys.length;
}

// Helper: Load limit from database
async function loadLimitFromDatabase(
  lotteryId: string,
  betType: string,
  number: string
): Promise<Record<string, string>> {
  const supabase = await createClient();
  
  // Try specific number first
  const { data: specific } = await supabase
    .from('liability_limits')
    .select('*')
    .eq('lottery_id', lotteryId)
    .eq('bet_type', betType)
    .eq('number', number)
    .single();

  if (specific) {
    // Cache in Redis
    const key = KEYS.limit(lotteryId, betType, number);
    const limitData = {
      maxAmount: specific.max_amount?.toString() || '50000',
      warningThreshold: specific.warning_threshold?.toString() || '80',
      isBlocked: specific.is_blocked ? '1' : '0',
      ...(specific.reduced_rate && { reducedRate: specific.reduced_rate.toString() }),
    };
    await redis.hset(key, limitData);
    await redis.expire(key, 3600); // Cache for 1 hour
    
    return limitData;
  }

  // Try global limit for bet type
  const { data: global } = await supabase
    .from('liability_limits')
    .select('*')
    .eq('lottery_id', lotteryId)
    .eq('bet_type', betType)
    .is('number', null)
    .single();

  if (global) {
    const key = KEYS.globalLimit(lotteryId, betType);
    const limitData = {
      maxAmount: global.max_amount?.toString() || '50000',
      warningThreshold: global.warning_threshold?.toString() || '80',
      isBlocked: '0',
    };
    await redis.hset(key, limitData);
    await redis.expire(key, 3600);
    
    return limitData;
  }

  return {};
}

// Helper: Save limit to database
async function saveLimitToDatabase(
  lotteryId: string,
  betType: string,
  number: string | null,
  limit: Omit<LiabilityLimit, 'currentVolume'>
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from('liability_limits')
    .upsert({
      lottery_id: lotteryId,
      bet_type: betType,
      number: number,
      max_amount: limit.maxAmount,
      warning_threshold: limit.warningThreshold,
      is_blocked: limit.isBlocked,
      reduced_rate: limit.reducedRate,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'lottery_id,bet_type,number',
    });
}
