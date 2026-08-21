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
    const url =
      process.env.KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL;
    const token =
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Redis configuration missing: KV_REST_API_URL/KV_REST_API_TOKEN ' +
        'or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN required'
      );
    }

    _redis = new Redis({ url, token });
  }

  return _redis;
}

// Export a permanently non-null lazy proxy.
// Bind Redis methods to the real client so calls such as redis.get(...) keep
// the correct `this` value.
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedis();
    const value = Reflect.get(client, prop, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

type RedisKeyPart =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | Record<string, unknown>;

function normalizeKeyPart(value: RedisKeyPart): string {
  if (value === null || value === undefined || value === '') return 'all';

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'object') {
    const preferred =
      value.date ??
      value.draw_date ??
      value.closing_date ??
      value.customer_id ??
      value.customerId ??
      value.user_id ??
      value.userId ??
      value.id;

    if (preferred !== null && preferred !== undefined && preferred !== '') {
      return String(preferred);
    }

    const keys = Object.keys(value).sort();
    if (keys.length === 0) return 'all';

    return keys
      .map((key) => `${key}=${String(value[key])}`)
      .join(':');
  }

  return String(value);
}

function buildKey(prefix: string, parts: RedisKeyPart[]): string {
  const suffix = parts.length
    ? parts.map(normalizeKeyPart).join(':')
    : 'all';

  return `${prefix}:${suffix}`;
}

// Key prefixes for organization
export const REDIS_KEYS = {
  // Bet volume tracking
  BET_VOLUME: (lottoId: string, number: string) =>
    `bet:volume:${lottoId}:${number}`,
  BET_VOLUME_TOTAL: (lottoId: string) =>
    `bet:volume:total:${lottoId}`,

  // Liability limits
  LIABILITY_LIMIT: (lottoId: string, number: string) =>
    `limit:${lottoId}:${number}`,
  LIABILITY_DEFAULT: (lottoId: string) =>
    `limit:default:${lottoId}`,

  // Market status
  MARKET_STATUS: (lottoId: string) =>
    `market:status:${lottoId}`,
  MARKET_RATES: (lottoId: string) =>
    `market:rates:${lottoId}`,

  // Compatibility aliases used by payout/risk modules
  PAYOUT_RATES: (...parts: RedisKeyPart[]) =>
    buildKey('payout:rates', parts),
  DAILY_SUMMARY: (...parts: RedisKeyPart[]) =>
    buildKey('daily:summary', parts),
  WITHDRAWAL_LIMIT: (...parts: RedisKeyPart[]) =>
    buildKey('withdrawal:limit', parts),

  // Blocked numbers
  BLOCKED_NUMBERS: (lottoId: string) =>
    `blocked:${lottoId}`,

  // Network sync
  SYNC_TIMESTAMP: 'network:sync:timestamp',
  SYNC_QUEUE: 'network:sync:queue',

  // Agent sessions
  AGENT_SESSION: (agentId: string) =>
    `agent:session:${agentId}`,
  AGENT_HEARTBEAT: (agentId: string) =>
    `agent:heartbeat:${agentId}`,

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
  | 'UPDATE_MARKET'
  | 'UPDATE_RATES'
  | 'BLOCK_NUMBER'
  | 'UNBLOCK_NUMBER'
  | 'UPDATE_LIMIT'
  | 'CLOSE_MARKET'
  | 'OPEN_MARKET'
  | 'EMERGENCY_STOP'
  | 'NEW_BET'
  | 'HEARTBEAT'
  | 'FINANCIAL_UPDATE';

export interface PubSubMessage<T = unknown> {
  action: PubSubAction;
  payload: T;
  timestamp: string;
  source: 'master' | 'agent';
  sourceId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// TTL constants (in seconds)
export const TTL = {
  BET_VOLUME: 86400,
  MARKET_STATUS: 3600,
  AGENT_SESSION: 7200,
  AGENT_HEARTBEAT: 60,
  SYNC_DATA: 300,
};

// Alias for backward compatibility
export const REDIS_TTL = TTL;

// Helper function for get-or-set pattern
export async function getOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await redis.get<T>(key);

  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const value = await fetchFn();

  // Upstash serializes JSON-compatible values itself.
  await redis.set(key, value, { ex: ttlSeconds });

  return value;
}