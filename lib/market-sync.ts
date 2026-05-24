/**
 * Market Sync System - FIN LOTTO R+
 * 
 * Real-time market status distribution across network
 * Uses Redis Pub/Sub pattern for instant updates
 */

import { redis, REDIS_KEYS, TTL } from './redis';
import { createClient } from './supabase/server';

export type MarketStatus = 'open' | 'closed' | 'suspended' | 'settling';

export interface MarketSettings {
  lottoId: string;
  status: MarketStatus;
  rates: Record<string, number>;
  closeTime?: string;
  blockedNumbers: string[];
  liabilityLimits: Record<string, number>;
  updatedAt: string;
}

export interface SyncMessage {
  type: 'market_update' | 'rate_change' | 'number_block' | 'limit_update' | 'close_market';
  lottoId: string;
  data: Record<string, any>;
  timestamp: string;
  source: 'master';
}

/**
 * Update market status and broadcast to all agents
 */
export async function updateMarketStatus(
  lottoId: string,
  status: MarketStatus,
  broadcastToNetwork = true
): Promise<void> {
  const supabase = await createClient();
  const timestamp = new Date().toISOString();
  
  // Update database
  await supabase
    .from('lotteries')
    .update({ 
      status,
      updated_at: timestamp 
    })
    .eq('id', lottoId);
  
  // Update Redis cache
  await redis.set(REDIS_KEYS.MARKET_STATUS(lottoId), status, { ex: TTL.MARKET_STATUS });
  
  // Broadcast to network
  if (broadcastToNetwork) {
    await broadcastToAgents({
      type: 'market_update',
      lottoId,
      data: { status },
      timestamp,
      source: 'master',
    });
  }
}

/**
 * Update payout rates and broadcast
 */
export async function updateMarketRates(
  lottoId: string,
  rates: Record<string, number>,
  broadcastToNetwork = true
): Promise<void> {
  const supabase = await createClient();
  const timestamp = new Date().toISOString();
  
  // Update database
  await supabase
    .from('lotteries')
    .update({ 
      payout_rates: rates,
      updated_at: timestamp 
    })
    .eq('id', lottoId);
  
  // Update Redis cache
  await redis.set(REDIS_KEYS.MARKET_RATES(lottoId), JSON.stringify(rates), { ex: TTL.MARKET_STATUS });
  
  // Broadcast to network
  if (broadcastToNetwork) {
    await broadcastToAgents({
      type: 'rate_change',
      lottoId,
      data: { rates },
      timestamp,
      source: 'master',
    });
  }
}

/**
 * Get current market settings (from Redis first, then DB)
 */
export async function getMarketSettings(lottoId: string): Promise<MarketSettings | null> {
  try {
    // Try Redis first
    const [status, ratesJson, blockedNumbers] = await Promise.all([
      redis.get(REDIS_KEYS.MARKET_STATUS(lottoId)),
      redis.get(REDIS_KEYS.MARKET_RATES(lottoId)),
      redis.smembers(REDIS_KEYS.BLOCKED_NUMBERS(lottoId)),
    ]);
    
    if (status && ratesJson) {
      return {
        lottoId,
        status: status as MarketStatus,
        rates: JSON.parse(ratesJson as string),
        blockedNumbers: blockedNumbers || [],
        liabilityLimits: {},
        updatedAt: new Date().toISOString(),
      };
    }
    
    // Fallback to database
    return await getMarketSettingsFromDB(lottoId);
  } catch (error) {
    console.error('[MarketSync] getMarketSettings error:', error);
    return await getMarketSettingsFromDB(lottoId);
  }
}

/**
 * Get market settings from database
 */
async function getMarketSettingsFromDB(lottoId: string): Promise<MarketSettings | null> {
  const supabase = await createClient();
  
  const { data: lottery } = await supabase
    .from('lotteries')
    .select('*')
    .eq('id', lottoId)
    .single();
  
  if (!lottery) return null;
  
  const { data: settings } = await supabase
    .from('system_settings')
    .select('setting_value')
    .in('setting_key', ['blocked_numbers', 'liability_limits']);
  
  const blockedNumbers = settings?.find(s => s.setting_value?.lottoId === lottoId)?.setting_value?.numbers || [];
  const liabilityLimits = settings?.find(s => s.setting_value?.lottoId === lottoId)?.setting_value?.limits || {};
  
  // Cache to Redis
  await Promise.all([
    redis.set(REDIS_KEYS.MARKET_STATUS(lottoId), lottery.status || 'open', { ex: TTL.MARKET_STATUS }),
    redis.set(REDIS_KEYS.MARKET_RATES(lottoId), JSON.stringify(lottery.payout_rates || {}), { ex: TTL.MARKET_STATUS }),
  ]);
  
  return {
    lottoId,
    status: lottery.status || 'open',
    rates: lottery.payout_rates || {},
    closeTime: lottery.close_time,
    blockedNumbers,
    liabilityLimits,
    updatedAt: lottery.updated_at,
  };
}

/**
 * Broadcast message to all connected agent sites
 */
export async function broadcastToAgents(message: SyncMessage): Promise<{ 
  success: boolean; 
  sentTo: number; 
  failed: number;
}> {
  const supabase = await createClient();
  
  // Get active agent sites
  const { data: agentSites } = await supabase
    .from('child_sites')
    .select('id, name, api_url, api_key')
    .eq('status', 'active');
  
  if (!agentSites?.length) {
    return { success: true, sentTo: 0, failed: 0 };
  }
  
  // Store message in Redis queue for reliability
  await redis.lpush(REDIS_KEYS.SYNC_QUEUE, JSON.stringify(message));
  await redis.set(REDIS_KEYS.SYNC_TIMESTAMP, message.timestamp);
  
  // Send to all agents in parallel
  const results = await Promise.allSettled(
    agentSites.map(async (site) => {
      try {
        const response = await fetch(`${site.api_url}/api/network/receive`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': site.api_key,
            'X-Source': 'master',
          },
          body: JSON.stringify(message),
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return true;
      } catch (error) {
        console.error(`[MarketSync] Failed to sync to ${site.name}:`, error);
        return false;
      }
    })
  );
  
  const sentTo = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.length - sentTo;
  
  // Log sync result
  await supabase.from('activity_logs').insert({
    action: 'network_sync',
    category: 'system',
    details: {
      messageType: message.type,
      lottoId: message.lottoId,
      sentTo,
      failed,
      totalAgents: agentSites.length,
    },
    created_at: new Date().toISOString(),
  });
  
  return { success: failed === 0, sentTo, failed };
}

/**
 * Sync all market settings to a specific agent (on reconnect)
 */
export async function fullSyncToAgent(agentSiteId: string): Promise<boolean> {
  const supabase = await createClient();
  
  // Get agent site details
  const { data: site } = await supabase
    .from('child_sites')
    .select('*')
    .eq('id', agentSiteId)
    .single();
  
  if (!site) return false;
  
  // Get all active lotteries
  const { data: lotteries } = await supabase
    .from('lotteries')
    .select('*')
    .eq('is_active', true);
  
  // Get all settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .in('setting_key', ['blocked_numbers', 'liability_limits', 'payout_rates']);
  
  try {
    const response = await fetch(`${site.api_url}/api/network/full-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': site.api_key,
        'X-Source': 'master',
      },
      body: JSON.stringify({
        lotteries,
        settings,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout for full sync
    });
    
    return response.ok;
  } catch (error) {
    console.error(`[MarketSync] Full sync to ${site.name} failed:`, error);
    return false;
  }
}

/**
 * Process pending sync messages (for reliability)
 */
export async function processSyncQueue(): Promise<number> {
  let processed = 0;
  
  while (true) {
    const messageJson = await redis.rpop(REDIS_KEYS.SYNC_QUEUE);
    if (!messageJson) break;
    
    try {
      const message = JSON.parse(messageJson as string) as SyncMessage;
      await broadcastToAgents(message);
      processed++;
    } catch (error) {
      console.error('[MarketSync] processSyncQueue error:', error);
    }
  }
  
  return processed;
}
