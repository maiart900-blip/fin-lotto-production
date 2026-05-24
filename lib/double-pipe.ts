/**
 * Double-Pipe Architecture for FIN LOTTO R+
 * ==========================================
 * Command Pipe: Master -> Agents (ส่งคำสั่ง)
 * Data Pipe: Agents -> Master (ส่งข้อมูลแทง)
 */

import { REDIS_KEYS, TTL } from '@/lib/redis';

// Lazy imports to avoid build-time errors
const getSupabaseClient = async () => {
  const { createClient } = await import('@/lib/supabase/client');
  return createClient();
};

const getRedis = async () => {
  const { redis } = await import('@/lib/redis');
  return redis;
};

// Alias for consistency
const redisKeys = {
  command: (id: string) => `command:${id}`,
  betVolume: (lottoId: string, number: string) => REDIS_KEYS.BET_VOLUME(lottoId, number),
  limit: (lottoId: string, number: string) => REDIS_KEYS.LIABILITY_LIMIT(lottoId, number),
};

const CACHE_TTL = {
  COMMAND: 3600, // 1 hour
  BET_VOLUME: TTL.BET_VOLUME,
};

// Types
export type CommandType = 
  | 'update_rates' | 'close_market' | 'open_market'
  | 'block_number' | 'unblock_number' | 'update_limit'
  | 'force_sync' | 'broadcast_message' | 'emergency_stop';

export interface Command {
  id: string;
  type: CommandType;
  payload: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  targetAgents: string[] | 'all';
  createdAt: string;
  createdBy: string;
}

export interface BetData {
  id: string;
  agentId: string;
  agentCode: string;
  customerId: string;
  customerName: string;
  lotteryId: string;
  lotteryName: string;
  number: string;
  betType: string;
  amount: number;
  rate: number;
  potentialPayout: number;
  timestamp: string;
  source: 'web' | 'line' | 'api';
}

export interface AgentStatus {
  agentId: string;
  agentCode: string;
  isOnline: boolean;
  lastHeartbeat: string;
  pendingCommands: number;
  todayBets: number;
  todayVolume: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

// COMMAND PIPE (Master -> Agents)
export class CommandPipe {
  async sendCommand(command: Omit<Command, 'id' | 'createdAt'>): Promise<{ success: boolean; commandId: string; deliveredTo: number }> {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullCommand: Command = {
      ...command,
      id: commandId,
      createdAt: new Date().toISOString(),
    };

    try {
      const redis = await getRedis();
      const supabase = await getSupabaseClient();
      
      // Store in Redis
      await redis.set(redisKeys.command(commandId), JSON.stringify(fullCommand), { ex: CACHE_TTL.COMMAND });

      // Add to queue
      if (command.targetAgents === 'all') {
        await redis.lpush('command_queue:broadcast', JSON.stringify(fullCommand));
      } else {
        for (const agentId of command.targetAgents) {
          await redis.lpush(`command_queue:${agentId}`, JSON.stringify(fullCommand));
        }
      }

      // Broadcast via Supabase Realtime
      await supabase.channel('commands:broadcast').send({
        type: 'broadcast',
        event: 'new_command',
        payload: fullCommand,
      });

      // Count delivered
      let deliveredTo = 0;
      if (command.targetAgents === 'all') {
        const { count } = await supabase
          .from('agents')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        deliveredTo = count || 0;
      } else {
        deliveredTo = command.targetAgents.length;
      }

      return { success: true, commandId, deliveredTo };
    } catch (error) {
      console.error('CommandPipe error:', error);
      return { success: false, commandId, deliveredTo: 0 };
    }
  }

  async updateRates(lotteryId: string, rates: Record<string, number>, createdBy: string, targetAgents: string[] | 'all' = 'all') {
    return this.sendCommand({ type: 'update_rates', payload: { lotteryId, rates }, priority: 'high', targetAgents, createdBy });
  }

  async closeMarket(lotteryId: string, reason: string, createdBy: string, targetAgents: string[] | 'all' = 'all') {
    return this.sendCommand({ type: 'close_market', payload: { lotteryId, reason, closedAt: new Date().toISOString() }, priority: 'critical', targetAgents, createdBy });
  }

  async blockNumber(lotteryId: string, number: string, betType: string, reason: string, createdBy: string, targetAgents: string[] | 'all' = 'all') {
    return this.sendCommand({ type: 'block_number', payload: { lotteryId, number, betType, reason }, priority: 'critical', targetAgents, createdBy });
  }

  async updateLimit(lotteryId: string, number: string, betType: string, newLimit: number, createdBy: string, targetAgents: string[] | 'all' = 'all') {
    return this.sendCommand({ type: 'update_limit', payload: { lotteryId, number, betType, newLimit }, priority: 'high', targetAgents, createdBy });
  }

  async emergencyStop(reason: string, createdBy: string) {
    return this.sendCommand({ type: 'emergency_stop', payload: { reason, stoppedAt: new Date().toISOString() }, priority: 'critical', targetAgents: 'all', createdBy });
  }

  async getPendingCommands(agentId?: string): Promise<Command[]> {
    const redis = await getRedis();
    const key = agentId ? `command_queue:${agentId}` : 'command_queue:broadcast';
    const commands = await redis.lrange(key, 0, -1);
    return commands.map((cmd: any) => JSON.parse(cmd as string));
  }

  async acknowledgeCommand(commandId: string, agentId: string): Promise<void> {
    const redis = await getRedis();
    await redis.sadd(`command_ack:${commandId}`, agentId);
    await redis.expire(`command_ack:${commandId}`, CACHE_TTL.COMMAND);
  }
}

// DATA PIPE (Agents -> Master)
export class DataPipe {
  async receiveBet(betData: BetData): Promise<{ success: boolean; volumeInfo: { current: number; limit: number; percentage: number } }> {
    try {
      const redis = await getRedis();
      const supabase = await getSupabaseClient();
      
      // Store in Redis
      const volumeKey = redisKeys.betVolume(betData.lotteryId, betData.number);
      const newVolume = await redis.incrby(volumeKey, betData.amount);
      await redis.expire(volumeKey, CACHE_TTL.BET_VOLUME);

      // Get limit
      const limitKey = redisKeys.limit(betData.lotteryId, betData.number);
      let limit = await redis.get(limitKey) as number | null;
      
      if (!limit) {
        const { data } = await supabase
          .from('liability_limits')
          .select('max_amount')
          .eq('lottery_id', betData.lotteryId)
          .eq('number', betData.number)
          .single();
        limit = data?.max_amount || 100000;
      }

      // Add to feed
      await redis.lpush('bet_feed:master', JSON.stringify({ ...betData, receivedAt: new Date().toISOString(), currentVolume: newVolume, limit }));
      await redis.ltrim('bet_feed:master', 0, 999);

      // Broadcast
      await supabase.channel('data:master').send({ type: 'broadcast', event: 'new_bet', payload: betData });

      const safeLimit = limit || 100000;
      const percentage = (newVolume / safeLimit) * 100;
      if (percentage >= 80) {
        await supabase.channel('alerts:master').send({ type: 'broadcast', event: 'volume_warning', payload: { lotteryId: betData.lotteryId, number: betData.number, currentVolume: newVolume, limit: safeLimit, percentage } });
      }

      return { success: true, volumeInfo: { current: newVolume, limit: safeLimit, percentage } };
    } catch (error) {
      console.error('DataPipe error:', error);
      return { success: false, volumeInfo: { current: 0, limit: 0, percentage: 0 } };
    }
  }

  async receiveHeartbeat(agentId: string, stats: { todayBets: number; todayVolume: number; activeCustomers: number; queueSize: number }): Promise<void> {
    const redis = await getRedis();
    const key = `agent_status:${agentId}`;
    await redis.hset(key, { isOnline: 'true', lastHeartbeat: new Date().toISOString(), ...stats });
    await redis.expire(key, 120);
  }

  async getRecentBets(limitNum: number = 50): Promise<BetData[]> {
    const redis = await getRedis();
    const bets = await redis.lrange('bet_feed:master', 0, limitNum - 1);
    return bets.map((b: any) => JSON.parse(b as string));
  }

  async getAllAgentStatus(): Promise<AgentStatus[]> {
    const redis = await getRedis();
    const supabase = await getSupabaseClient();
    const { data: agents } = await supabase.from('agents').select('id, code, name, last_activity_at').eq('status', 'active');
    if (!agents) return [];

    const statuses: AgentStatus[] = [];
    for (const agent of agents) {
      const key = `agent_status:${agent.id}`;
      const status = await redis.hgetall(key) as Record<string, string> | null;
      
      const lastHeartbeat = status?.lastHeartbeat || agent.last_activity_at;
      const isOnline = status?.isOnline === 'true' && new Date(lastHeartbeat).getTime() > Date.now() - 120000;

      statuses.push({
        agentId: agent.id,
        agentCode: agent.code,
        isOnline,
        lastHeartbeat,
        pendingCommands: parseInt(status?.queueSize || '0'),
        todayBets: parseInt(status?.todayBets || '0'),
        todayVolume: parseFloat(status?.todayVolume || '0'),
        connectionQuality: isOnline ? (parseInt(status?.queueSize || '0') < 10 ? 'excellent' : 'good') : 'poor',
      });
    }
    return statuses;
  }

  async getVolumeByNumber(lotteryId: string): Promise<{ number: string; volume: number; limit: number; percentage: number }[]> {
    const redis = await getRedis();
    const pattern = `bet_volume:${lotteryId}:*`;
    const keys = await redis.keys(pattern);
    
    const results: { number: string; volume: number; limit: number; percentage: number }[] = [];
    for (const key of keys) {
      const number = key.split(':')[2];
      const volume = await redis.get(key) as number || 0;
      const limitKey = redisKeys.limit(lotteryId, number);
      const limitVal = await redis.get(limitKey) as number || 100000;
      results.push({ number, volume, limit: limitVal, percentage: (volume / limitVal) * 100 });
    }
    return results.sort((a, b) => b.percentage - a.percentage);
  }
}

// NETWORK ORCHESTRATOR
export class NetworkOrchestrator {
  private commandPipe = new CommandPipe();
  private dataPipe = new DataPipe();

  async getNetworkSummary(): Promise<{ totalAgents: number; onlineAgents: number; offlineAgents: number; todayTotalBets: number; todayTotalVolume: number; pendingCommands: number; criticalAlerts: number }> {
    const redis = await getRedis();
    const agentStatuses = await this.dataPipe.getAllAgentStatus();
    const pendingCommands = await this.commandPipe.getPendingCommands();
    const alerts = await redis.lrange('alerts:critical', 0, -1);
    
    return {
      totalAgents: agentStatuses.length,
      onlineAgents: agentStatuses.filter(a => a.isOnline).length,
      offlineAgents: agentStatuses.filter(a => !a.isOnline).length,
      todayTotalBets: agentStatuses.reduce((sum, a) => sum + a.todayBets, 0),
      todayTotalVolume: agentStatuses.reduce((sum, a) => sum + a.todayVolume, 0),
      pendingCommands: pendingCommands.length,
      criticalAlerts: alerts.length,
    };
  }

  get command() { return this.commandPipe; }
  get data() { return this.dataPipe; }
}

export const networkOrchestrator = new NetworkOrchestrator();
export const commandPipe = new CommandPipe();
export const dataPipe = new DataPipe();
