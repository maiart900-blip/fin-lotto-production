/**
 * Risk Validation API
 * Endpoint สำหรับ validate bet ก่อนรับ
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateRisk, recordRiskVolume } from '@/lib/middleware/risk-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST - Validate a bet before accepting
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { number, amount, marketId, betType, agentId, customerId, recordIfAccepted } = body;

    // Validate required fields
    if (!number || !amount || !marketId || !betType) {
      return NextResponse.json(
        { error: 'Missing required fields: number, amount, marketId, betType' },
        { status: 400 }
      );
    }

    // Validate risk
    const result = await validateRisk({
      number,
      amount: Number(amount),
      marketId,
      betType,
      agentId,
      customerId,
    });

    // If accepted and recordIfAccepted flag is true, record the volume
    if (result.status === 'ACCEPTED' && recordIfAccepted) {
      const newVolume = await recordRiskVolume(marketId, betType, number, Number(amount));
      result.currentRisk = newVolume;
      result.remainingCapacity = result.hardLimit - newVolume;
      result.usagePercent = (newVolume / result.hardLimit) * 100;
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('[Risk Validate API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', status: 'ACCEPTED' }, // Default to accept on error
      { status: 500 }
    );
  }
}

/**
 * GET - Get risk status for a number
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get('marketId');
    const betType = searchParams.get('betType');
    const number = searchParams.get('number');

    if (!marketId || !betType || !number) {
      return NextResponse.json(
        { error: 'Missing required params: marketId, betType, number' },
        { status: 400 }
      );
    }

    // Validate with 0 amount just to get current status
    const result = await validateRisk({
      number,
      amount: 0,
      marketId,
      betType,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Risk Status API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
