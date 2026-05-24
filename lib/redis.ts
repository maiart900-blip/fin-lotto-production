/**
 * Upstash Redis Client
 * High-performance caching and real-time data sync for FIN LOTTO R+
 * 
 * Used for:
 * - Bet volume tracking (real-time)
 * - Liability limit caching
 * - Market status sync across network
 * - Session management
 * - Rate limiting
 */

import { Redis } from '@upstash/redis';

// Lazy initialization to avoid build-time errors
let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      throw new Error('Redis configuration missing: KV_REST_API_URL and KV_REST_API_TOKEN required');
    }
    
    _redis = new Redis({ url, token });
  }
  return _redis;
}

// Export as getter to defer initialization
export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    return (getRedis() as any)[prop];
  },
});

// Key prefixes for organization
export const REDIS_KEYS = {
  // Bet volume tracking
  BET_VOLUME: (lottoId: string, number: string) => `bet:volume:${lottoId}:${number}`,
  BET_VOLUME_TOTAL: (lottoId: string) => `bet:volume:total:${lottoId}`,
  
  // Liability limits
  LIABILITY_LIMIT: (lottoId: string, number: string) => `limit:${lottoId}:${number}`,
  LIABILITY_DEFAULT: (lottoId: string) => `limit:default:${lottoId}`,
  
  // Market status
  MARKET_STATUS: (lottoId: string) => `market:status:${lottoId}`,
  MARKET_RATES: (lottoId: string) => `market:rates:${lottoId}`,
  
  // Blocked numbers
  BLOCKED_NUMBERS: (lottoId: string) => `blocked:${lottoId}`,
  
  // Network sync
  SYNC_TIMESTAMP: 'network:sync:timestamp',
  SYNC_QUEUE: 'network:sync:queue',
  
  // Agent sessions
  AGENT_SESSION: (agentId: string) => `agent:session:${agentId}`,
  AGENT_HEARTBEAT: (agentId: string) => `agent:heartbeat:${agentId}`,
  
  // Financial
  PENDING_DEPOSITS: 'financial:pending:deposits',
  PENDING_WITHDRAWALS: 'financial:pending:withdrawals',
};

// Pub/Sub Channels for Real-time Sync
export const PUBSUB_CHANNELS = {
  // Master -> Agents (Command Pipe)
  AGENT_SYNC: 'agent_sync_channel',
  MARKET_UPDATE: 'market_update_channel',
  RATE_UPDATE: 'rate_update_channel',
  NUMBER_BLOCK: 'number_block_channel',
  EMERGENCY: 'emergency_channel',
  
  // Agents -> Master (Data Pipe)
  BET_FEED: 'bet_feed_channel',
  AGENT_STATUS: 'agent_status_channel',
  FINANCIAL_FEED: 'financial_feed_channel',
};

// Pub/Sub Message Types
export type PubSubAction = 
  | 'UPDATE_MARKET'      // อัปเดตสถานะตลาด
  | 'UPDATE_RATES'       // ปรับเรทจ่าย
  | 'BLOCK_NUMBER'       // อั้นเลข
  | 'UNBLOCK_NUMBER'     // ปลดอั้นเลข
  | 'UPDATE_LIMIT'       // ปรับวงเงิน
  | 'CLOSE_MARKET'       // ปิดรับ
  | 'OPEN_MARKET'        // เปิดรับ
  | 'EMERGENCY_STOP'     // หยุดฉุกเฉิน
  | 'NEW_BET'            // Bet ใหม่จาก Agent
  | 'HEARTBEAT'          // Agent Heartbeat
  | 'FINANCIAL_UPDATE';  // อัปเดตทางการเงิน

export interface PubSubMessage<T = any> {
  action: PubSubAction;
  payload: T;
  timestamp: string;
  source: 'master' | 'agent';
  sourceId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// TTL constants (in seconds)
export const TTL = {
  BET_VOLUME: 86400, // 24 hours - reset daily
  MARKET_STATUS: 3600, // 1 hour
  AGENT_SESSION: 7200, // 2 hours
  AGENT_HEARTBEAT: 60, // 1 minute
  SYNC_DATA: 300, // 5 minutes
};

// Alias for backward compatibility
export const REDIS_TTL = TTL;

// Helper function for get-or-set pattern
export async function getOrSet<T>(
  key: string, 
  fetchFn: () => Promise<T>, 
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await redis.get(key);
  if (cached !== null) {
    return cached as T;
  }
  const value = await fetchFn();
  await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  return value;
}
