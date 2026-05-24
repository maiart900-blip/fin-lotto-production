/**
 * Master Distribution API
 * ========================
 * API สำหรับกระจายคำสั่งจาก Master ไปยัง Agents
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  distributeMarket,
  distributeRates,
  blockNumberNetworkWide,
  unblockNumberNetworkWide,
  closeMarketNetworkWide,
  openMarketNetworkWide,
  emergencyStopAll,
  getSyncStatus,
  type MarketData,
} from '@/lib/market-distribution';
import { createClient } from '@/lib/supabase/server';

// Validate admin session
async function validateAdmin(request: NextRequest): Promise<{ valid: boolean; userId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { valid: false };
  
  // Check if user is admin
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (!profile || !['admin', 'master', 'superadmin'].includes(profile.role)) {
    return { valid: false };
  }
  
  return { valid: true, userId: user.id };
}

export async function POST(request: NextRequest) {
  try {
    // Validate admin
    const auth = await validateAdmin(request);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action, payload } = body;
    
    switch (action) {
      case 'distribute_market': {
        const result = await distributeMarket(payload as MarketData, auth.userId!);
        return NextResponse.json(result);
      }
      
      case 'update_rates': {
        const { lotteryId, rates, reason } = payload;
        const result = await distributeRates(lotteryId, rates, auth.userId!, reason);
        return NextResponse.json(result);
      }
      
      case 'block_number': {
        const result = await blockNumberNetworkWide({
          ...payload,
          blockedBy: auth.userId!,
        });
        return NextResponse.json(result);
      }
      
      case 'unblock_number': {
        const { lotteryId, number, betType } = payload;
        const result = await unblockNumberNetworkWide(lotteryId, number, betType, auth.userId!);
        return NextResponse.json(result);
      }
      
      case 'close_market': {
        const { lotteryId, reason } = payload;
        const result = await closeMarketNetworkWide(lotteryId, reason, auth.userId!);
        return NextResponse.json(result);
      }
      
      case 'open_market': {
        const { lotteryId } = payload;
        const result = await openMarketNetworkWide(lotteryId, auth.userId!);
        return NextResponse.json(result);
      }
      
      case 'emergency_stop': {
        const { reason } = payload;
        const result = await emergencyStopAll(reason, auth.userId!);
        return NextResponse.json(result);
      }
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Master distribute error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const status = await getSyncStatus();
    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
