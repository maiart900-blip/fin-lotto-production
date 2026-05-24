/**
 * Agent Receiver API
 * Endpoint สำหรับ Agent รับคำสั่งจาก Master
 * และส่งข้อมูล Bet กลับไปยัง Master
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { commandPipe, dataPipe } from '@/lib/double-pipe';
import { redis } from '@/lib/redis';

// Verify agent API key
async function verifyAgent(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) return null;

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from('agents')
    .select('id, code, name, status')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single();

  return agent;
}

// GET - Agent fetches pending commands
export async function GET(request: NextRequest) {
  try {
    const agent = await verifyAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get pending commands for this agent
    const agentCommands = await commandPipe.getPendingCommands(agent.id);
    const broadcastCommands = await commandPipe.getPendingCommands();

    // Combine and deduplicate
    const allCommands = [...agentCommands, ...broadcastCommands];
    const uniqueCommands = allCommands.filter((cmd, index, self) =>
      index === self.findIndex(c => c.id === cmd.id)
    );

    // Sort by priority and time
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    uniqueCommands.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      agentId: agent.id,
      agentCode: agent.code,
      commands: uniqueCommands,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Agent receive GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Agent sends data to Master
export async function POST(request: NextRequest) {
  try {
    const agent = await verifyAgent(request);
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      // Agent submits a new bet
      case 'submit_bet': {
        const betData = {
          id: data.id || `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          agentId: agent.id,
          agentCode: agent.code,
          customerId: data.customerId,
          customerName: data.customerName,
          lotteryId: data.lotteryId,
          lotteryName: data.lotteryName,
          number: data.number,
          betType: data.betType,
          amount: data.amount,
          rate: data.rate,
          potentialPayout: data.amount * data.rate,
          timestamp: new Date().toISOString(),
          source: data.source || 'api',
        };

        const result = await dataPipe.receiveBet(betData);

        // Log to bet_logs table
        const supabase = await createClient();
        await supabase.from('bet_logs').insert({
          agent_id: agent.id,
          customer_id: data.customerId,
          lottery_id: data.lotteryId,
          number: data.number,
          bet_type: data.betType,
          amount: data.amount,
          rate: data.rate,
          potential_payout: betData.potentialPayout,
          total_volume_at_bet: result.volumeInfo.current,
          limit_at_bet: result.volumeInfo.limit,
          risk_level: result.volumeInfo.percentage >= 100 ? 'blocked' :
                      result.volumeInfo.percentage >= 80 ? 'critical' :
                      result.volumeInfo.percentage >= 60 ? 'high' : 'normal',
          source: data.source || 'api',
          ip_address: request.headers.get('x-forwarded-for'),
        });

        return NextResponse.json({
          success: result.success,
          betId: betData.id,
          volumeInfo: result.volumeInfo,
          warning: result.volumeInfo.percentage >= 80 ? `Volume at ${result.volumeInfo.percentage.toFixed(1)}% of limit` : null,
        });
      }

      // Agent sends heartbeat
      case 'heartbeat': {
        await dataPipe.receiveHeartbeat(agent.id, {
          todayBets: data.todayBets || 0,
          todayVolume: data.todayVolume || 0,
          activeCustomers: data.activeCustomers || 0,
          queueSize: data.queueSize || 0,
        });

        return NextResponse.json({
          success: true,
          serverTime: new Date().toISOString(),
        });
      }

      // Agent acknowledges command
      case 'ack_command': {
        await commandPipe.acknowledgeCommand(data.commandId, agent.id);
        
        // Remove from agent's queue
        const queueKey = `command_queue:${agent.id}`;
        const commands = await redis.lrange(queueKey, 0, -1);
        for (let i = 0; i < commands.length; i++) {
          const cmd = JSON.parse(commands[i] as string);
          if (cmd.id === data.commandId) {
            await redis.lrem(queueKey, 1, commands[i] as string);
            break;
          }
        }

        return NextResponse.json({
          success: true,
          acknowledged: data.commandId,
        });
      }

      // Agent reports status
      case 'status_report': {
        const supabase = await createClient();
        await supabase.from('agents').update({
          last_activity_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          sync_status: 'synced',
          total_bets: data.totalBets,
        }).eq('id', agent.id);

        return NextResponse.json({
          success: true,
          recorded: true,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Agent receive POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
