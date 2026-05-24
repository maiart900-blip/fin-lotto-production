/**
 * Real-time Event System for FIN LOTTO R+
 * 
 * ใช้ Supabase Realtime สำหรับ WebSocket-like functionality
 * รองรับการ broadcast events ไปยัง Admin Dashboard แบบ real-time
 */

import { createClient } from '@/lib/supabase/server';
import { redis, getOrSet } from '@/lib/redis';

// Event Types
export type RealtimeEventType = 
  | 'new_bet'           // เลขใหม่เข้ามา
  | 'bet_volume_update' // ยอดรวมเปลี่ยน
  | 'limit_reached'     // ถึงวงเงิน
  | 'market_status'     // สถานะตลาดเปลี่ยน
  | 'deposit_request'   // คำขอฝากเงิน
  | 'withdraw_request'  // คำขอถอนเงิน
  | 'credit_update'     // เครดิตเปลี่ยน
  | 'agent_sync'        // Sync จากเว็บลูก
  | 'risk_alert'        // แจ้งเตือนความเสี่ยง
  | 'system_broadcast'; // ประกาศทั่วไป

export interface RealtimeEvent {
  type: RealtimeEventType;
  channel: string; // 'admin', 'agent:{id}', 'customer:{id}'
  data: Record<string, any>;
  timestamp: string;
  source?: string; // agent_id or 'master'
}

// Channel names
export const CHANNELS = {
  ADMIN_DASHBOARD: 'admin_dashboard',
  AGENT_PREFIX: 'agent_',
  CUSTOMER_PREFIX: 'customer_',
  RISK_ALERTS: 'risk_alerts',
  MARKET_UPDATES: 'market_updates',
} as const;

/**
 * Emit event to Supabase Realtime channel
 * ใช้ตาราง realtime_events เพื่อ trigger broadcast
 */
export async function emitEvent(event: Omit<RealtimeEvent, 'timestamp'>) {
  const supabase = await createClient();
  
  const eventWithTimestamp: RealtimeEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  // Insert to realtime_events table (Supabase will broadcast via Realtime)
  const { error } = await supabase
    .from('realtime_events')
    .insert({
      event_type: event.type,
      channel: event.channel,
      payload: event.data,
      source: event.source || 'master',
      created_at: eventWithTimestamp.timestamp,
    });

  if (error) {
    console.error('[Realtime] Failed to emit event:', error);
    // Fallback: Store in Redis for polling
    await redis.lpush(`events:${event.channel}`, JSON.stringify(eventWithTimestamp));
    await redis.ltrim(`events:${event.channel}`, 0, 99); // Keep last 100 events
  }

  return eventWithTimestamp;
}

/**
 * Emit new bet event to admin dashboard
 */
export async function emitNewBet(data: {
  agentId: string;
  agentName: string;
  customerId?: string;
  customerName?: string;
  lotteryId: string;
  lotteryName: string;
  number: string;
  betType: string;
  amount: number;
  entryId: string;
}) {
  // Emit to admin dashboard
  await emitEvent({
    type: 'new_bet',
    channel: CHANNELS.ADMIN_DASHBOARD,
    data: {
      ...data,
      timestamp: new Date().toISOString(),
    },
    source: data.agentId,
  });

  // Update volume in Redis
  const volumeKey = `volume:${data.lotteryId}:${data.number}`;
  const newVolume = await redis.incrby(volumeKey, data.amount);

  // Check if limit reached
  const limitKey = `limit:${data.lotteryId}:${data.number}`;
  const limit = await redis.get<number>(limitKey);
  
  if (limit && newVolume >= limit * 0.8) {
    await emitEvent({
      type: newVolume >= limit ? 'limit_reached' : 'risk_alert',
      channel: CHANNELS.RISK_ALERTS,
      data: {
        lotteryId: data.lotteryId,
        lotteryName: data.lotteryName,
        number: data.number,
        currentVolume: newVolume,
        limit,
        percentage: Math.round((newVolume / limit) * 100),
        severity: newVolume >= limit ? 'critical' : 'warning',
      },
    });
  }

  // Emit volume update
  await emitEvent({
    type: 'bet_volume_update',
    channel: CHANNELS.ADMIN_DASHBOARD,
    data: {
      lotteryId: data.lotteryId,
      number: data.number,
      volume: newVolume,
      limit: limit || 0,
    },
  });
}

/**
 * Emit deposit request event
 */
export async function emitDepositRequest(data: {
  requestId: string;
  agentId: string;
  agentName: string;
  customerId: string;
  customerName: string;
  amount: number;
  slipUrl?: string;
}) {
  await emitEvent({
    type: 'deposit_request',
    channel: CHANNELS.ADMIN_DASHBOARD,
    data,
    source: data.agentId,
  });
}

/**
 * Emit withdraw request event
 */
export async function emitWithdrawRequest(data: {
  requestId: string;
  agentId: string;
  agentName: string;
  customerId: string;
  customerName: string;
  amount: number;
  bankAccount: string;
}) {
  await emitEvent({
    type: 'withdraw_request',
    channel: CHANNELS.ADMIN_DASHBOARD,
    data,
    source: data.agentId,
  });
}

/**
 * Emit market status change to all agents
 */
export async function emitMarketStatusChange(data: {
  lotteryId: string;
  lotteryName: string;
  status: 'open' | 'closed' | 'suspended';
  reason?: string;
}) {
  await emitEvent({
    type: 'market_status',
    channel: CHANNELS.MARKET_UPDATES,
    data,
    source: 'master',
  });
}

/**
 * Emit credit update to specific customer/agent
 */
export async function emitCreditUpdate(data: {
  targetType: 'agent' | 'customer';
  targetId: string;
  newBalance: number;
  changeAmount: number;
  reason: string;
}) {
  const channel = data.targetType === 'agent' 
    ? `${CHANNELS.AGENT_PREFIX}${data.targetId}`
    : `${CHANNELS.CUSTOMER_PREFIX}${data.targetId}`;

  await emitEvent({
    type: 'credit_update',
    channel,
    data: {
      balance: data.newBalance,
      change: data.changeAmount,
      reason: data.reason,
    },
    source: 'master',
  });
}

/**
 * Broadcast system message to all
 */
export async function broadcastSystemMessage(message: string, severity: 'info' | 'warning' | 'critical' = 'info') {
  await emitEvent({
    type: 'system_broadcast',
    channel: CHANNELS.ADMIN_DASHBOARD,
    data: {
      message,
      severity,
    },
    source: 'master',
  });

  await emitEvent({
    type: 'system_broadcast',
    channel: CHANNELS.MARKET_UPDATES,
    data: {
      message,
      severity,
    },
    source: 'master',
  });
}

/**
 * Get recent events from Redis (fallback for polling)
 */
export async function getRecentEvents(channel: string, limit: number = 50): Promise<RealtimeEvent[]> {
  const events = await redis.lrange(`events:${channel}`, 0, limit - 1);
  return events.map(e => typeof e === 'string' ? JSON.parse(e) : e);
}

/**
 * Get aggregated bet volumes for dashboard
 */
export async function getBetVolumes(lotteryId: string): Promise<Record<string, { volume: number; limit: number }>> {
  const pattern = `volume:${lotteryId}:*`;
  // Note: In production, use SCAN instead of KEYS
  const volumes: Record<string, { volume: number; limit: number }> = {};
  
  // Get from Supabase as fallback
  const supabase = await createClient();
  const { data } = await supabase
    .from('entries')
    .select('number, amount')
    .eq('lottery_id', lotteryId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (data) {
    for (const entry of data) {
      if (!volumes[entry.number]) {
        volumes[entry.number] = { volume: 0, limit: 0 };
      }
      volumes[entry.number].volume += Number(entry.amount);
    }
  }

  // Get limits
  const { data: limits } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'liability_limits')
    .single();

  if (limits?.setting_value?.numbers) {
    for (const [num, limit] of Object.entries(limits.setting_value.numbers)) {
      if (volumes[num]) {
        volumes[num].limit = limit as number;
      } else {
        volumes[num] = { volume: 0, limit: limit as number };
      }
    }
  }

  return volumes;
}
