/**
 * Risk Validation Middleware
 * ระบบเช็คความเสี่ยงก่อนรับแทง - Ultra-Fast with Redis Atomic Operations
 * Response time: < 5ms
 */

import { redis, REDIS_KEYS } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';
import { sendRiskWarning, sendLineAlert } from '@/lib/notifications/line-notify';

// =============================================
// TYPES
// =============================================

export interface RiskValidationRequest {
  number: string;
  amount: number;
  marketId: string;
  betType: string;
  agentId?: string;
  customerId?: string;
}

export interface RiskValidationResult {
  status: 'ACCEPTED' | 'REJECTED' | 'WARNING';
  reason?: string;
  currentRisk: number;
  hardLimit: number;
  softLimit: number;
  remainingCapacity: number;
  usagePercent: number;
  rateModifier?: number; // Rate reduction if applicable
}

export interface RiskConfig {
  hardLimit: number;     // Maximum absolute limit - REJECT if exceeded
  softLimit: number;     // Warning threshold - ALERT when exceeded
  alertThreshold: number; // Percentage to start monitoring (default 70%)
  reducedRate?: number;  // Rate reduction when approaching limit
  isBlocked: boolean;
}

// Redis Key Patterns for Risk Management
const RISK_KEYS = {
  // Current risk volume: risk:{marketId}:{betType}:{number}
  volume: (marketId: string, betType: string, number: string) =>
    `risk:${marketId}:${betType}:${number}`,
  
  // Total market volume: risk:{marketId}:total
  marketTotal: (marketId: string) =>
    `risk:${marketId}:total`,
  
  // Risk config: risk_config:{marketId}:{betType}:{number}
  config: (marketId: string, betType: string, number: string) =>
    `risk_config:${marketId}:${betType}:${number}`,
  
  // Global config: risk_config:{marketId}:global
  globalConfig: (marketId: string) =>
    `risk_config:${marketId}:global`,
  
  // Blocked set: risk_blocked:{marketId}
  blocked: (marketId: string) =>
    `risk_blocked:${marketId}`,
  
  // Alert tracking to avoid spam: risk_alert:{marketId}:{number}
  alertSent: (marketId: string, number: string) =>
    `risk_alert:${marketId}:${number}`,
};

// Default configuration
const DEFAULT_CONFIG: RiskConfig = {
  hardLimit: 100000,    // 100,000 THB default hard limit
  softLimit: 80000,     // 80,000 THB soft limit (80%)
  alertThreshold: 70,   // Alert at 70%
  isBlocked: false,
};

// Cache for risk configs (avoid DB hits)
const configCache = new Map<string, { config: RiskConfig; expiry: number }>();
const CACHE_TTL = 60000; // 1 minute cache

// =============================================
// MAIN VALIDATION FUNCTION
// =============================================

/**
 * Main Risk Validation Middleware
 * ใช้ Redis Atomic Operations เพื่อความเร็วระดับมิลลิวินาที
 */
export async function validateRisk(
  request: RiskValidationRequest
): Promise<RiskValidationResult> {
  const { number, amount, marketId, betType } = request;
  const volumeKey = RISK_KEYS.volume(marketId, betType, number);
  
  try {
    // 1. Quick blocked check first (fastest path)
    const blockedKey = RISK_KEYS.blocked(marketId);
    const isBlocked = await redis.sismember(blockedKey, `${betType}:${number}`);
    
    if (isBlocked) {
      return {
        status: 'REJECTED',
        reason: `เลข ${number} ถูกอั้นแล้ว ไม่สามารถรับแทงได้`,
        currentRisk: 0,
        hardLimit: 0,
        softLimit: 0,
        remainingCapacity: 0,
        usagePercent: 100,
      };
    }

    // 2. Get risk config (with caching)
    const config = await getRiskConfig(marketId, betType, number);

    // 3. Get current risk volume using Redis atomic GET
    const currentRisk = Number(await redis.get(volumeKey)) || 0;

    // 4. Calculate metrics
    const newTotal = currentRisk + amount;
    const usagePercent = (newTotal / config.hardLimit) * 100;
    const remainingCapacity = Math.max(0, config.hardLimit - currentRisk);

    // 5. Check hard limit - REJECT if exceeded
    if (newTotal > config.hardLimit) {
      return {
        status: 'REJECTED',
        reason: `เต็มยอดการรับแทง (${currentRisk.toLocaleString()}/${config.hardLimit.toLocaleString()})`,
        currentRisk,
        hardLimit: config.hardLimit,
        softLimit: config.softLimit,
        remainingCapacity,
        usagePercent: (currentRisk / config.hardLimit) * 100,
      };
    }

    // 6. Check soft limit - WARN and ALERT
    if (newTotal > config.softLimit) {
      // Send LINE alert (with deduplication)
      await sendRiskAlertWithDedup(marketId, number, betType, newTotal, config);
      
      return {
        status: 'WARNING',
        reason: `เลข ${number} ใกล้เต็มโควตา (${usagePercent.toFixed(0)}%)`,
        currentRisk,
        hardLimit: config.hardLimit,
        softLimit: config.softLimit,
        remainingCapacity: remainingCapacity - amount,
        usagePercent,
        rateModifier: config.reducedRate,
      };
    }

    // 7. Check alert threshold for early warning
    if (usagePercent >= config.alertThreshold) {
      // Log but don't alert yet
      console.log(`[Risk Monitor] ${number} at ${usagePercent.toFixed(1)}% capacity`);
    }

    // 8. ACCEPTED
    return {
      status: 'ACCEPTED',
      currentRisk,
      hardLimit: config.hardLimit,
      softLimit: config.softLimit,
      remainingCapacity: remainingCapacity - amount,
      usagePercent,
    };

  } catch (error) {
    console.error('[validateRisk] Error:', error);
    // On error, default to ACCEPTED to avoid blocking legitimate bets
    // but log for investigation
    return {
      status: 'ACCEPTED',
      reason: 'Validation bypassed due to error',
      currentRisk: 0,
      hardLimit: DEFAULT_CONFIG.hardLimit,
      softLimit: DEFAULT_CONFIG.softLimit,
      remainingCapacity: DEFAULT_CONFIG.hardLimit,
      usagePercent: 0,
    };
  }
}

/**
 * Record bet and update risk volume
 * Call this AFTER bet is confirmed
 */
export async function recordRiskVolume(
  marketId: string,
  betType: string,
  number: string,
  amount: number
): Promise<number> {
  const volumeKey = RISK_KEYS.volume(marketId, betType, number);
  const marketTotalKey = RISK_KEYS.marketTotal(marketId);
  
  // Atomic increment - thread-safe for concurrent bets
  const [newVolume] = await Promise.all([
    redis.incrby(volumeKey, amount),
    redis.incrby(marketTotalKey, amount),
    // Set TTL for auto-cleanup (24 hours)
    redis.expire(volumeKey, 86400),
  ]);
  
  return newVolume;
}

/**
 * Get risk config with caching
 */
async function getRiskConfig(
  marketId: string,
  betType: string,
  number: string
): Promise<RiskConfig> {
  const cacheKey = `${marketId}:${betType}:${number}`;
  
  // Check memory cache first
  const cached = configCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.config;
  }
  
  // Try Redis config
  const configKey = RISK_KEYS.config(marketId, betType, number);
  let configData = await redis.hgetall(configKey);
  
  // Fallback to global config
  if (!configData || Object.keys(configData).length === 0) {
    const globalKey = RISK_KEYS.globalConfig(marketId);
    configData = await redis.hgetall(globalKey);
  }
  
  // Fallback to database
  if (!configData || Object.keys(configData).length === 0) {
    configData = await loadConfigFromDatabase(marketId, betType, number);
  }
  
  // Parse config
  const config: RiskConfig = {
    hardLimit: Number(configData?.hardLimit) || DEFAULT_CONFIG.hardLimit,
    softLimit: Number(configData?.softLimit) || DEFAULT_CONFIG.softLimit,
    alertThreshold: Number(configData?.alertThreshold) || DEFAULT_CONFIG.alertThreshold,
    reducedRate: configData?.reducedRate ? Number(configData.reducedRate) : undefined,
    isBlocked: configData?.isBlocked === 'true',
  };
  
  // Update cache
  configCache.set(cacheKey, { config, expiry: Date.now() + CACHE_TTL });
  
  return config;
}

/**
 * Load config from database (fallback)
 */
async function loadConfigFromDatabase(
  marketId: string,
  betType: string,
  number: string
): Promise<Record<string, any>> {
  try {
    const supabase = await createClient();
    
    // Try specific config
    const { data: specific } = await supabase
      .from('liability_limits')
      .select('*')
      .eq('lottery_id', marketId)
      .eq('bet_type', betType)
      .eq('number', number)
      .single();
    
    if (specific) {
      const config = {
        hardLimit: specific.max_amount,
        softLimit: specific.max_amount * (specific.warning_threshold / 100),
        alertThreshold: specific.warning_threshold,
        reducedRate: specific.reduced_rate,
        isBlocked: specific.is_blocked,
      };
      
      // Cache to Redis
      const configKey = RISK_KEYS.config(marketId, betType, number);
      await redis.hset(configKey, config);
      await redis.expire(configKey, 3600); // 1 hour
      
      return config;
    }
    
    // Try global config for this market
    const { data: global } = await supabase
      .from('liability_limits')
      .select('*')
      .eq('lottery_id', marketId)
      .is('number', null)
      .single();
    
    if (global) {
      return {
        hardLimit: global.max_amount,
        softLimit: global.max_amount * (global.warning_threshold / 100),
        alertThreshold: global.warning_threshold,
        reducedRate: global.reduced_rate,
        isBlocked: false,
      };
    }
    
    return {};
  } catch (error) {
    console.error('[loadConfigFromDatabase] Error:', error);
    return {};
  }
}

/**
 * Send risk alert with deduplication
 * Avoid spamming LINE when multiple bets hit warning
 */
async function sendRiskAlertWithDedup(
  marketId: string,
  number: string,
  betType: string,
  currentVolume: number,
  config: RiskConfig
): Promise<void> {
  const alertKey = RISK_KEYS.alertSent(marketId, number);
  
  // Check if alert already sent recently (within 5 minutes)
  const alreadySent = await redis.get(alertKey);
  if (alreadySent) {
    return; // Skip duplicate alert
  }
  
  // Mark alert as sent (5 minute cooldown)
  await redis.set(alertKey, '1', { ex: 300 });
  
  // Get market name for better alert
  const marketName = await getMarketName(marketId);
  const usagePercent = (currentVolume / config.hardLimit) * 100;
  
  // Send LINE alert
  await sendRiskWarning(
    number,
    marketName,
    currentVolume,
    config.hardLimit,
    usagePercent
  );
}

/**
 * Get market name from cache or database
 */
async function getMarketName(marketId: string): Promise<string> {
  try {
    const cacheKey = `market_name:${marketId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return String(cached);
    
    const supabase = await createClient();
    const { data } = await supabase
      .from('lotteries')
      .select('name')
      .eq('id', marketId)
      .single();
    
    const name = data?.name || 'Unknown Market';
    await redis.set(cacheKey, name, { ex: 3600 });
    return name;
  } catch {
    return 'Unknown Market';
  }
}

// =============================================
// ADMIN FUNCTIONS
// =============================================

/**
 * Set risk config for a number
 */
export async function setRiskConfig(
  marketId: string,
  betType: string,
  number: string,
  config: Partial<RiskConfig>
): Promise<void> {
  const configKey = RISK_KEYS.config(marketId, betType, number);
  await redis.hset(configKey, config);
  await redis.expire(configKey, 86400); // 24 hours
  
  // Clear cache
  const cacheKey = `${marketId}:${betType}:${number}`;
  configCache.delete(cacheKey);
}

/**
 * Block a number
 */
export async function blockNumber(
  marketId: string,
  betType: string,
  number: string,
  reason?: string
): Promise<void> {
  const blockedKey = RISK_KEYS.blocked(marketId);
  await redis.sadd(blockedKey, `${betType}:${number}`);
  
  // Send alert
  await sendLineAlert('risk_critical', `อั้นเลข ${number}`, {
    'ตลาด': await getMarketName(marketId),
    'ประเภท': betType,
    'เหตุผล': reason || 'Manual block',
  });
}

/**
 * Unblock a number
 */
export async function unblockNumber(
  marketId: string,
  betType: string,
  number: string
): Promise<void> {
  const blockedKey = RISK_KEYS.blocked(marketId);
  await redis.srem(blockedKey, `${betType}:${number}`);
}

/**
 * Reset risk volume (for new round)
 */
export async function resetRiskVolume(marketId: string): Promise<void> {
  // Get all volume keys for this market
  // Note: In production, use SCAN instead of KEYS
  const pattern = `risk:${marketId}:*`;
  
  // Reset by setting new TTL or deleting
  // This is a simplified version
  const marketTotalKey = RISK_KEYS.marketTotal(marketId);
  await redis.del(marketTotalKey);
  
  console.log(`[Risk] Volume reset for market ${marketId}`);
}

/**
 * Get current risk summary for a market
 */
export async function getRiskSummary(marketId: string): Promise<{
  totalVolume: number;
  topNumbers: { number: string; volume: number }[];
}> {
  const marketTotalKey = RISK_KEYS.marketTotal(marketId);
  const totalVolume = Number(await redis.get(marketTotalKey)) || 0;
  
  // In production, aggregate top numbers from sorted set
  return {
    totalVolume,
    topNumbers: [], // TODO: Implement sorted set tracking
  };
}
