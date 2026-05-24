/**
 * Liability Check API
 * ตรวจสอบวงเงินก่อนรับ Bet
 * Response time target: < 10ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkLiabilityLimit, 
  recordBetVolume,
  blockNumber,
  unblockNumber,
  setLiabilityLimit,
  getVolumeSummary,
  syncLimitsToAgents,
  resetVolume,
} from '@/lib/middleware/liability-check';

// POST - Check liability before placing bet
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { action = 'check', ...params } = body;

    switch (action) {
      case 'check': {
        // Quick liability check
        const { lotteryId, agentId, number, betType, amount } = params;
        
        if (!lotteryId || !number || !betType || !amount) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        const result = await checkLiabilityLimit({
          lotteryId,
          agentId,
          number,
          betType,
          amount: Number(amount),
        });

        return NextResponse.json({
          ...result,
          responseTime: Date.now() - startTime,
        });
      }

      case 'record': {
        // Record bet volume after successful bet
        const { lotteryId, betType, number, amount, agentId } = params;
        
        if (!lotteryId || !betType || !number || !amount) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        const result = await recordBetVolume(
          lotteryId,
          betType,
          number,
          Number(amount),
          agentId
        );

        return NextResponse.json({
          success: true,
          ...result,
          responseTime: Date.now() - startTime,
        });
      }

      case 'block': {
        // Block a number
        const { lotteryId, betType, number, reason } = params;
        
        if (!lotteryId || !betType || !number) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        await blockNumber(lotteryId, betType, number, reason);

        return NextResponse.json({
          success: true,
          message: `เลข ${number} (${betType}) ถูกอั้นแล้ว`,
          responseTime: Date.now() - startTime,
        });
      }

      case 'unblock': {
        // Unblock a number
        const { lotteryId, betType, number } = params;
        
        if (!lotteryId || !betType || !number) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        await unblockNumber(lotteryId, betType, number);

        return NextResponse.json({
          success: true,
          message: `ปลดอั้นเลข ${number} (${betType}) แล้ว`,
          responseTime: Date.now() - startTime,
        });
      }

      case 'set_limit': {
        // Set liability limit
        const { lotteryId, betType, number, maxAmount, warningThreshold, reducedRate } = params;
        
        if (!lotteryId || !betType || !maxAmount) {
          return NextResponse.json(
            { error: 'Missing required fields' },
            { status: 400 }
          );
        }

        await setLiabilityLimit(lotteryId, betType, number || null, {
          maxAmount: Number(maxAmount),
          warningThreshold: Number(warningThreshold) || 80,
          isBlocked: false,
          reducedRate: reducedRate ? Number(reducedRate) : undefined,
        });

        return NextResponse.json({
          success: true,
          message: number 
            ? `ตั้งวงเงินเลข ${number} เป็น ${maxAmount.toLocaleString()} บาท`
            : `ตั้งวงเงินทั่วไป (${betType}) เป็น ${maxAmount.toLocaleString()} บาท`,
          responseTime: Date.now() - startTime,
        });
      }

      case 'get_volume': {
        // Get volume summary
        const { lotteryId, betType } = params;
        
        if (!lotteryId) {
          return NextResponse.json(
            { error: 'Missing lotteryId' },
            { status: 400 }
          );
        }

        const summary = await getVolumeSummary(lotteryId, betType);

        return NextResponse.json({
          success: true,
          summary,
          responseTime: Date.now() - startTime,
        });
      }

      case 'sync': {
        // Sync limits to all agents
        const { lotteryId, betType } = params;
        
        if (!lotteryId) {
          return NextResponse.json(
            { error: 'Missing lotteryId' },
            { status: 400 }
          );
        }

        const result = await syncLimitsToAgents(lotteryId, betType);

        return NextResponse.json({
          success: true,
          ...result,
          responseTime: Date.now() - startTime,
        });
      }

      case 'reset': {
        // Reset volume (new round)
        const { lotteryId } = params;
        
        if (!lotteryId) {
          return NextResponse.json(
            { error: 'Missing lotteryId' },
            { status: 400 }
          );
        }

        const keysDeleted = await resetVolume(lotteryId);

        return NextResponse.json({
          success: true,
          keysDeleted,
          message: `รีเซ็ตยอดแทงหวย ${lotteryId} แล้ว (${keysDeleted} keys)`,
          responseTime: Date.now() - startTime,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Liability API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        responseTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// GET - Quick volume check
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  
  const lotteryId = searchParams.get('lotteryId');
  const betType = searchParams.get('betType');

  if (!lotteryId) {
    return NextResponse.json(
      { error: 'Missing lotteryId' },
      { status: 400 }
    );
  }

  try {
    const summary = await getVolumeSummary(lotteryId, betType || undefined);

    // Sort by volume descending
    const sorted = Object.entries(summary)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50); // Top 50

    return NextResponse.json({
      success: true,
      lotteryId,
      betType,
      topNumbers: sorted.map(([key, volume]) => ({ key, volume })),
      totalVolume: Object.values(summary).reduce((a, b) => a + b, 0),
      responseTime: Date.now() - startTime,
    });

  } catch (error) {
    console.error('[Liability API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
