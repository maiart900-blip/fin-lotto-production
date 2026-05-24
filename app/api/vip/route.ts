/**
 * VIP Member Ranking API
 * Manage VIP levels, points, and rebates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getMemberVIPData,
  awardVIPPoints,
  calculateMemberRebate,
  processRebates,
  getVIPStatistics,
  VIP_LEVELS,
  calculateVIPPayoutRate,
} from '@/lib/vip/member-ranking';

// GET - Get VIP data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'levels';
    const customerId = searchParams.get('customerId');

    switch (type) {
      case 'levels':
        return NextResponse.json(VIP_LEVELS);

      case 'member':
        if (!customerId) {
          return NextResponse.json({ error: 'customerId required' }, { status: 400 });
        }
        const memberData = await getMemberVIPData(customerId);
        return NextResponse.json(memberData);

      case 'statistics':
        const stats = await getVIPStatistics();
        return NextResponse.json(stats);

      case 'rebate':
        if (!customerId) {
          return NextResponse.json({ error: 'customerId required' }, { status: 400 });
        }
        const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = searchParams.get('endDate') || new Date().toISOString();
        const rebate = await calculateMemberRebate(customerId, startDate, endDate);
        return NextResponse.json(rebate);

      case 'payout-rate':
        const baseRate = parseFloat(searchParams.get('baseRate') || '90');
        const levelId = searchParams.get('levelId') || 'member';
        const level = VIP_LEVELS.find(l => l.id === levelId) || VIP_LEVELS[0];
        const adjustedRate = calculateVIPPayoutRate(baseRate, level);
        return NextResponse.json({
          baseRate,
          vipLevel: level.name,
          bonus: level.payoutBonus,
          adjustedRate,
        });

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('VIP GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get VIP data' },
      { status: 500 }
    );
  }
}

// POST - VIP actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, customerId, points, reason, startDate, endDate } = body;

    switch (action) {
      case 'award_points':
        if (!customerId || !points) {
          return NextResponse.json({ error: 'customerId and points required' }, { status: 400 });
        }
        const result = await awardVIPPoints(customerId, points, reason || 'Manual award');
        return NextResponse.json({
          success: true,
          ...result,
        });

      case 'process_rebates':
        if (!startDate || !endDate) {
          return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
        }
        const rebateResult = await processRebates(startDate, endDate);
        return NextResponse.json({
          success: true,
          ...rebateResult,
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('VIP POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process VIP action' },
      { status: 500 }
    );
  }
}
