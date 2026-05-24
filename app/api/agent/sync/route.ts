/**
 * Agent Sync API
 * ==============
 * Endpoint สำหรับ Agent polling เพื่อรับคำสั่งจาก Master
 * 
 * GET: ดึงข้อมูลอัปเดตทั้งหมดตั้งแต่ timestamp ที่กำหนด
 * POST: ส่งข้อมูล Bet กลับมา Master
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentUpdates } from '@/lib/market-distribution';
import { redis, REDIS_KEYS, PUBSUB_CHANNELS, type PubSubMessage } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

// Validate Agent API Key
async function validateAgent(request: NextRequest): Promise<{ valid: boolean; agentId?: string; agentCode?: string }> {
  const apiKey = request.headers.get('X-Agent-API-Key');
  if (!apiKey) return { valid: false };
  
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from('agents')
    .select('id, code, status')
    .eq('api_key', apiKey)
    .single();
  
  if (!agent || agent.status !== 'active') return { valid: false };
  
  return { valid: true, agentId: agent.id, agentCode: agent.code };
}

// GET: Agent pulls updates from Master
export async function GET(request: NextRequest) {
  try {
    // Validate agent
    const auth = await validateAgent(request);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get timestamp for incremental sync
    const since = request.nextUrl.searchParams.get('since') || undefined;
    
    // Get all updates
    const updates = await getAgentUpdates(since);
    
    // Update agent heartbeat
    await redis.set(
      REDIS_KEYS.AGENT_HEARTBEAT(auth.agentId!),
      JSON.stringify({ lastSeen: new Date().toISOString(), agentCode: auth.agentCode }),
      { ex: 60 }
    );
    
    return NextResponse.json({
      success: true,
      agentId: auth.agentId,
      timestamp: new Date().toISOString(),
      updates: {
        markets: updates.marketUpdates,
        rates: updates.rateUpdates,
        blocks: updates.numberBlocks,
        emergencies: updates.emergencies,
      },
      totalUpdates: 
        updates.marketUpdates.length + 
        updates.rateUpdates.length + 
        updates.numberBlocks.length +
        updates.emergencies.length,
    });
  } catch (error) {
    console.error('Agent sync GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Agent sends bet data to Master
export async function POST(request: NextRequest) {
  try {
    // Validate agent
    const auth = await validateAgent(request);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { type, payload } = body;
    
    if (type === 'bet') {
      // Process new bet from agent
      const betData = {
        ...payload,
        agentId: auth.agentId,
        agentCode: auth.agentCode,
        receivedAt: new Date().toISOString(),
      };
      
      // Check liability limit
      const limitKey = REDIS_KEYS.LIABILITY_LIMIT(payload.lotteryId, payload.number);
      const limit = await redis.get(limitKey) as number | null;
      const volumeKey = REDIS_KEYS.BET_VOLUME(payload.lotteryId, payload.number);
      const currentVolume = (await redis.get(volumeKey) as number) || 0;
      
      if (limit && currentVolume + payload.amount > limit) {
        return NextResponse.json({
          success: false,
          error: 'LIMIT_EXCEEDED',
          message: `เลข ${payload.number} เต็มวงเงินแล้ว`,
          currentVolume,
          limit,
        }, { status: 400 });
      }
      
      // Update volume
      await redis.incrby(volumeKey, payload.amount);
      
      // Publish to bet feed for Master dashboard
      const message: PubSubMessage = {
        action: 'NEW_BET',
        payload: betData,
        timestamp: new Date().toISOString(),
        source: 'agent',
        sourceId: auth.agentId,
      };
      await redis.lpush(`queue:${PUBSUB_CHANNELS.BET_FEED}`, JSON.stringify(message));
      await redis.ltrim(`queue:${PUBSUB_CHANNELS.BET_FEED}`, 0, 999);
      
      // Store in database
      const supabase = await createClient();
      await supabase.from('bet_logs').insert({
        agent_id: auth.agentId,
        customer_id: payload.customerId,
        lottery_id: payload.lotteryId,
        number: payload.number,
        bet_type: payload.betType,
        amount: payload.amount,
        rate: payload.rate,
        potential_payout: payload.amount * payload.rate,
        total_volume_at_bet: currentVolume + payload.amount,
        limit_at_bet: limit,
        risk_level: calculateRiskLevel(currentVolume + payload.amount, limit),
        source: payload.source || 'api',
        bet_time: new Date().toISOString(),
      });
      
      return NextResponse.json({
        success: true,
        message: 'Bet received',
        betId: betData.id,
        volumeAfter: currentVolume + payload.amount,
        limitRemaining: limit ? limit - (currentVolume + payload.amount) : null,
      });
    }
    
    if (type === 'heartbeat') {
      // Update heartbeat
      await redis.set(
        REDIS_KEYS.AGENT_HEARTBEAT(auth.agentId!),
        JSON.stringify({
          lastSeen: new Date().toISOString(),
          agentCode: auth.agentCode,
          stats: payload.stats,
        }),
        { ex: 60 }
      );
      
      return NextResponse.json({ success: true, message: 'Heartbeat received' });
    }
    
    if (type === 'ack') {
      // Acknowledge command receipt
      await redis.sadd(`command_ack:${payload.commandId}`, auth.agentId!);
      
      return NextResponse.json({ success: true, message: 'Acknowledgement received' });
    }
    
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (error) {
    console.error('Agent sync POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Calculate risk level based on volume vs limit
function calculateRiskLevel(volume: number, limit: number | null): string {
  if (!limit) return 'unknown';
  const ratio = volume / limit;
  if (ratio >= 1) return 'critical';
  if (ratio >= 0.8) return 'high';
  if (ratio >= 0.5) return 'medium';
  return 'low';
}
