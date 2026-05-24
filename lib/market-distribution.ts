/**
 * Market Distribution System for FIN LOTTO R+
 * =============================================
 * ศูนย์กลางการกระจายตลาดจากเว็บแม่ไปเว็บลูก
 * 
 * Features:
 * - Real-time market distribution via Redis Pub/Sub
 * - Instant rate updates across all agents
 * - Number blocking with network sync
 * - Emergency stop capability
 */

import { redis, REDIS_KEYS, PUBSUB_CHANNELS, type PubSubMessage, type PubSubAction } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

// Market Data Types
export interface MarketData {
  id: string;
  name: string;
  type: string;
  status: 'OPEN' | 'CLOSED' | 'SUSPENDED' | 'PENDING';
  rates: Record<string, number>;
  limits: Record<string, number>;
  openTime?: string;
  closeTime?: string;
  drawTime?: string;
}

export interface RateUpdate {
  lotteryId: string;
  betType: string;
  oldRate: number;
  newRate: number;
  reason?: string;
}

export interface NumberBlockData {
  lotteryId: string;
  number: string;
  betType: string;
  reason: string;
  blockedBy: string;
}

// Publish message to Redis channel
async function publishToChannel(channel: string, message: PubSubMessage): Promise<boolean> {
  try {
    // Using Upstash Redis HTTP-based publish via list (since Upstash doesn't support traditional pub/sub)
    // We use a list as a message queue that agents poll
    await redis.lpush(`queue:${channel}`, JSON.stringify(message));
    // Trim to keep only last 1000 messages
    await redis.ltrim(`queue:${channel}`, 0, 999);
    // Set expiry
    await redis.expire(`queue:${channel}`, 86400); // 24 hours
    return true;
  } catch (error) {
    console.error(`Failed to publish to ${channel}:`, error);
    return false;
  }
}

// Get messages from channel (for agents to poll)
export async function getChannelMessages(channel: string, since?: string): Promise<PubSubMessage[]> {
  try {
    const messages = await redis.lrange(`queue:${channel}`, 0, 99) as string[];
    const parsed = messages.map(m => {
      try {
        return JSON.parse(m) as PubSubMessage;
      } catch {
        return null;
      }
    }).filter(Boolean) as PubSubMessage[];
    
    // Filter by timestamp if provided
    if (since) {
      return parsed.filter(m => new Date(m.timestamp) > new Date(since));
    }
    
    return parsed;
  } catch (error) {
    console.error(`Failed to get messages from ${channel}:`, error);
    return [];
  }
}

/**
 * Distribute Market Update
 * กระจายการอัปเดตตลาดไปยังเว็บลูกทั้งหมด
 */
export async function distributeMarket(marketData: MarketData, updatedBy: string): Promise<{
  success: boolean;
  message: string;
  agentsNotified: number;
}> {
  try {
    const supabase = await createClient();
    
    // 1. Update database
    const { error: dbError } = await supabase
      .from('lotteries')
      .update({
        status: marketData.status.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', marketData.id);
    
    if (dbError) throw dbError;
    
    // 2. Update Redis cache
    await redis.set(
      REDIS_KEYS.MARKET_STATUS(marketData.id),
      JSON.stringify(marketData),
      { ex: 3600 }
    );
    
    // 3. Broadcast to all agents via Pub/Sub channel
    const message: PubSubMessage<MarketData> = {
      action: 'UPDATE_MARKET',
      payload: marketData,
      timestamp: new Date().toISOString(),
      source: 'master',
      sourceId: updatedBy,
      priority: 'high',
    };
    
    await publishToChannel(PUBSUB_CHANNELS.MARKET_UPDATE, message);
    
    // Also publish to main sync channel
    await publishToChannel(PUBSUB_CHANNELS.AGENT_SYNC, message);
    
    // 4. Log activity
    await supabase.from('audit_logs').insert({
      user_id: updatedBy,
      action: 'market_distribute',
      resource_type: 'lottery',
      resource_id: marketData.id,
      details: { market: marketData.name, status: marketData.status },
    });
    
    // 5. Get active agent count
    const { count } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    return {
      success: true,
      message: `Market ${marketData.name} distributed successfully`,
      agentsNotified: count || 0,
    };
  } catch (error) {
    console.error('distributeMarket error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      agentsNotified: 0,
    };
  }
}

/**
 * Distribute Rate Update
 * กระจายการปรับเรทไปยังเว็บลูกทันที
 */
export async function distributeRates(
  lotteryId: string,
  rates: Record<string, number>,
  updatedBy: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    
    // 1. Get current lottery info
    const { data: lottery } = await supabase
      .from('lotteries')
      .select('name, payout_rates')
      .eq('id', lotteryId)
      .single();
    
    // 2. Update database
    const { error: dbError } = await supabase
      .from('lotteries')
      .update({
        payout_rates: rates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lotteryId);
    
    if (dbError) throw dbError;
    
    // 3. Update Redis cache
    await redis.set(
      REDIS_KEYS.MARKET_RATES(lotteryId),
      JSON.stringify(rates),
      { ex: 3600 }
    );
    
    // 4. Broadcast rate update
    const message: PubSubMessage<{ lotteryId: string; lotteryName: string; rates: Record<string, number>; reason?: string }> = {
      action: 'UPDATE_RATES',
      payload: {
        lotteryId,
        lotteryName: lottery?.name || lotteryId,
        rates,
        reason,
      },
      timestamp: new Date().toISOString(),
      source: 'master',
      sourceId: updatedBy,
      priority: 'high',
    };
    
    await publishToChannel(PUBSUB_CHANNELS.RATE_UPDATE, message);
    await publishToChannel(PUBSUB_CHANNELS.AGENT_SYNC, message);
    
    // 5. Log
    await supabase.from('audit_logs').insert({
      user_id: updatedBy,
      action: 'rate_update',
      resource_type: 'lottery',
      resource_id: lotteryId,
      details: { rates, reason, previousRates: lottery?.payout_rates },
    });
    
    return { success: true, message: 'Rates distributed successfully' };
  } catch (error) {
    console.error('distributeRates error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Block Number Network-wide
 * อั้นเลขและกระจายไปทุกเว็บลูก
 */
export async function blockNumberNetworkWide(
  data: NumberBlockData
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    
    // 1. Add to blocked numbers in Redis
    const blockedKey = REDIS_KEYS.BLOCKED_NUMBERS(data.lotteryId);
    const blockedData = { ...data, blockedAt: new Date().toISOString() };
    await redis.hset(blockedKey, { [data.number]: JSON.stringify(blockedData) });
    
    // 2. Update liability limits table
    await supabase.from('liability_limits').upsert({
      lottery_id: data.lotteryId,
      bet_type: data.betType,
      number: data.number,
      is_blocked: true,
      blocked_at: new Date().toISOString(),
      blocked_by: data.blockedBy,
      block_reason: data.reason,
    }, {
      onConflict: 'lottery_id,bet_type,number',
    });
    
    // 3. Broadcast block command
    const message: PubSubMessage<NumberBlockData & { blockedAt: string }> = {
      action: 'BLOCK_NUMBER',
      payload: { ...data, blockedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
      source: 'master',
      sourceId: data.blockedBy,
      priority: 'critical',
    };
    
    await publishToChannel(PUBSUB_CHANNELS.NUMBER_BLOCK, message);
    await publishToChannel(PUBSUB_CHANNELS.AGENT_SYNC, message);
    
    // 4. Log
    await supabase.from('audit_logs').insert({
      user_id: data.blockedBy,
      action: 'number_block',
      resource_type: 'liability_limit',
      resource_id: `${data.lotteryId}:${data.number}`,
      details: data,
      severity: 'high',
    });
    
    return { success: true, message: `Number ${data.number} blocked network-wide` };
  } catch (error) {
    console.error('blockNumberNetworkWide error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Unblock Number Network-wide
 * ปลดอั้นเลขและกระจายไปทุกเว็บลูก
 */
export async function unblockNumberNetworkWide(
  lotteryId: string,
  number: string,
  betType: string,
  unblockedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    
    // 1. Remove from blocked numbers in Redis
    const blockedKey = REDIS_KEYS.BLOCKED_NUMBERS(lotteryId);
    await redis.hdel(blockedKey, number);
    
    // 2. Update liability limits table
    await supabase.from('liability_limits').update({
      is_blocked: false,
      blocked_at: null,
      blocked_by: null,
      block_reason: null,
    }).match({
      lottery_id: lotteryId,
      bet_type: betType,
      number: number,
    });
    
    // 3. Broadcast unblock command
    const message: PubSubMessage<{ lotteryId: string; number: string; betType: string }> = {
      action: 'UNBLOCK_NUMBER',
      payload: { lotteryId, number, betType },
      timestamp: new Date().toISOString(),
      source: 'master',
      sourceId: unblockedBy,
      priority: 'high',
    };
    
    await publishToChannel(PUBSUB_CHANNELS.NUMBER_BLOCK, message);
    await publishToChannel(PUBSUB_CHANNELS.AGENT_SYNC, message);
    
    return { success: true, message: `Number ${number} unblocked network-wide` };
  } catch (error) {
    console.error('unblockNumberNetworkWide error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Close Market Network-wide
 * ปิดรับตลาดและกระจายไปทุกเว็บลูก
 */
export async function closeMarketNetworkWide(
  lotteryId: string,
  reason: string,
  closedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    
    // 1. Update database
    const { data: lottery, error: dbError } = await supabase
      .from('lotteries')
      .update({
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', lotteryId)
      .select('name')
      .single();
    
    if (dbError) throw dbError;
    
    // 2. Update Redis
    await redis.set(
      REDIS_KEYS.MARKET_STATUS(lotteryId),
      JSON.stringify({ status: 'CLOSED', closedAt: new Date().toISOString(), reason }),
      { ex: 3600 }
    );
    
    // 3. Broadcast close command
    const message: PubSubMessage<{ lotteryId: string; lotteryName: string; reason: string; closedAt: string }> = {
      action: 'CLOSE_MARKET',
      payload: {
        lotteryId,
        lotteryName: lottery?.name || lotteryId,
        reason,
        closedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      source: 'master',
      sourceId: closedBy,
      priority: 'critical',
    };
    
    await publishToChannel(PUBSUB_CHANNELS.MARKET_UPDATE, message);
    await publishToChannel(PUBSUB_CHANNELS.AGENT_SYNC, message);
    
    // 4. Log
    await supabase.from('audit_logs').insert({
      user_id: closedBy,
      action: 'market_close',
      resource_type: 'lottery',
      resource_id: lotteryId,
      details: { reason },
      severity: 'high',
    });
    
    return { success: true, message: `Market ${lottery?.name} closed network-wide` };
  } catch (error) {
    console.error('closeMarketNetworkWide error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Open Market Network-wide
 * เปิดรับตลาดและกระจายไปทุกเว็บลูก
 */
export async function openMarketNetworkWide(
  lotteryId: string,
  openedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    
    // 1. Update database
    const { data: lottery, error: dbError } = await supabase
      .from('lotteries')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', lotteryId)
      .select('name, payout_rates')
      .single();
    
    if (dbError) throw dbError;
    
    // 2. Update Redis
    await redis.set(
      REDIS_KEYS.MARKET_STATUS(lotteryId),
      JSON.stringify({ status: 'OPEN', openedAt: new Date().toISOString() }),
      { ex: 3600 }
    );
    
    // 3. Broadcast open command
    const message: PubSubMessage<{ lotteryId: string; lotteryName: string; rates: Record<string, number>; openedAt: string }> = {
      action: 'OPEN_MARKET',
      payload: {
        lotteryId,
        lotteryName: lottery?.name || lotteryId,
        rates: lottery?.payout_rates || {},
        openedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      source: 'master',
      sourceId: openedBy,
      priority: 'high',
    };
    
    await publishToChannel(PUBSUB_CHANNELS.MARKET_UPDATE, message);
    await publishToChannel(PUBSUB_CHANNELS.AGENT_SYNC, message);
    
    return { success: true, message: `Market ${lottery?.name} opened network-wide` };
  } catch (error) {
    console.error('openMarketNetworkWide error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Emergency Stop - All Markets
 * หยุดฉุกเฉินทุกตลาดทันที
 */
export async function emergencyStopAll(
  reason: string,
  stoppedBy: string
): Promise<{ success: boolean; message: string; marketsClosed: number }> {
  try {
    const supabase = await createClient();
    
    // 1. Close all open markets
    const { data: markets, error: dbError } = await supabase
      .from('lotteries')
      .update({
        status: 'suspended',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'open')
      .select('id, name');
    
    if (dbError) throw dbError;
    
    // 2. Broadcast emergency stop
    const message: PubSubMessage<{ reason: string; stoppedAt: string; marketsClosed: string[] }> = {
      action: 'EMERGENCY_STOP',
      payload: {
        reason,
        stoppedAt: new Date().toISOString(),
        marketsClosed: markets?.map(m => m.name) || [],
      },
      timestamp: new Date().toISOString(),
      source: 'master',
      sourceId: stoppedBy,
      priority: 'critical',
    };
    
    await publishToChannel(PUBSUB_CHANNELS.EMERGENCY, message);
    await publishToChannel(PUBSUB_CHANNELS.AGENT_SYNC, message);
    
    // 3. Log
    await supabase.from('audit_logs').insert({
      user_id: stoppedBy,
      action: 'emergency_stop',
      resource_type: 'system',
      details: { reason, marketsClosed: markets?.length || 0 },
      severity: 'critical',
    });
    
    return {
      success: true,
      message: 'Emergency stop executed',
      marketsClosed: markets?.length || 0,
    };
  } catch (error) {
    console.error('emergencyStopAll error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error', marketsClosed: 0 };
  }
}

/**
 * Get All Channel Updates for Agent
 * ให้ Agent ดึงข้อมูลอัปเดตทั้งหมดตั้งแต่ timestamp ที่กำหนด
 */
export async function getAgentUpdates(since?: string): Promise<{
  marketUpdates: PubSubMessage[];
  rateUpdates: PubSubMessage[];
  numberBlocks: PubSubMessage[];
  emergencies: PubSubMessage[];
}> {
  const [marketUpdates, rateUpdates, numberBlocks, emergencies] = await Promise.all([
    getChannelMessages(PUBSUB_CHANNELS.MARKET_UPDATE, since),
    getChannelMessages(PUBSUB_CHANNELS.RATE_UPDATE, since),
    getChannelMessages(PUBSUB_CHANNELS.NUMBER_BLOCK, since),
    getChannelMessages(PUBSUB_CHANNELS.EMERGENCY, since),
  ]);
  
  return { marketUpdates, rateUpdates, numberBlocks, emergencies };
}

/**
 * Get Sync Status
 * ตรวจสอบสถานะการซิงค์ของระบบ
 */
export async function getSyncStatus(): Promise<{
  lastSync: string | null;
  pendingMessages: number;
  channels: { name: string; messageCount: number }[];
}> {
  const lastSync = await redis.get(REDIS_KEYS.SYNC_TIMESTAMP) as string | null;
  
  const channelCounts = await Promise.all([
    redis.llen(`queue:${PUBSUB_CHANNELS.AGENT_SYNC}`),
    redis.llen(`queue:${PUBSUB_CHANNELS.MARKET_UPDATE}`),
    redis.llen(`queue:${PUBSUB_CHANNELS.RATE_UPDATE}`),
    redis.llen(`queue:${PUBSUB_CHANNELS.NUMBER_BLOCK}`),
    redis.llen(`queue:${PUBSUB_CHANNELS.EMERGENCY}`),
  ]);
  
  const channels = [
    { name: 'agent_sync', messageCount: channelCounts[0] },
    { name: 'market_update', messageCount: channelCounts[1] },
    { name: 'rate_update', messageCount: channelCounts[2] },
    { name: 'number_block', messageCount: channelCounts[3] },
    { name: 'emergency', messageCount: channelCounts[4] },
  ];
  
  return {
    lastSync,
    pendingMessages: channelCounts.reduce((a, b) => a + b, 0),
    channels,
  };
}
