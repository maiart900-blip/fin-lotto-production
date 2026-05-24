/**
 * Market Settings API - FIN LOTTO R+
 * 
 * Master control for lottery market settings
 * Instant distribution to all agent sites
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  updateMarketStatus, 
  updateMarketRates, 
  getMarketSettings,
  broadcastToAgents,
  MarketStatus 
} from '@/lib/market-sync';
import { 
  setLiabilityLimit, 
  blockNumber, 
  unblockNumber,
  syncLimitsToRedis 
} from '@/lib/risk-management';

// GET - Fetch market settings
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lottoId = searchParams.get('lottoId');
  
  if (!lottoId) {
    // Return all active markets
    const supabase = await createClient();
    const { data: lotteries, error } = await supabase
      .from('lotteries')
      .select('*')
      .eq('is_active', true)
      .order('draw_date', { ascending: true });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ lotteries });
  }
  
  const settings = await getMarketSettings(lottoId);
  
  if (!settings) {
    return NextResponse.json({ error: 'Lottery not found' }, { status: 404 });
  }
  
  return NextResponse.json({ settings });
}

// POST - Update market settings with instant network sync
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      action, 
      lottoId, 
      status, 
      rates, 
      number, 
      limit,
      broadcastToNetwork = true 
    } = body;
    
    if (!lottoId) {
      return NextResponse.json({ error: 'lottoId is required' }, { status: 400 });
    }
    
    let syncResult = { sentTo: 0, failed: 0 };
    
    switch (action) {
      case 'update_status': {
        if (!status) {
          return NextResponse.json({ error: 'status is required' }, { status: 400 });
        }
        
        await updateMarketStatus(lottoId, status as MarketStatus, broadcastToNetwork);
        
        // Log activity
        await supabase.from('activity_logs').insert({
          action: 'market_status_change',
          category: 'market',
          details: { lottoId, status },
          created_at: new Date().toISOString(),
        });
        
        return NextResponse.json({ 
          success: true, 
          message: `สถานะตลาดเปลี่ยนเป็น "${status}"` 
        });
      }
      
      case 'update_rates': {
        if (!rates || typeof rates !== 'object') {
          return NextResponse.json({ error: 'rates object is required' }, { status: 400 });
        }
        
        await updateMarketRates(lottoId, rates, broadcastToNetwork);
        
        // Log activity
        await supabase.from('activity_logs').insert({
          action: 'payout_rates_change',
          category: 'market',
          details: { lottoId, rates },
          created_at: new Date().toISOString(),
        });
        
        return NextResponse.json({ 
          success: true, 
          message: 'อัปเดตเรทจ่ายสำเร็จ' 
        });
      }
      
      case 'set_limit': {
        if (!number || limit === undefined) {
          return NextResponse.json({ error: 'number and limit are required' }, { status: 400 });
        }
        
        // Update Redis
        await setLiabilityLimit(lottoId, number, limit);
        
        // Update database
        const { data: currentSettings } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'liability_limits')
          .single();
        
        const limits = currentSettings?.setting_value?.limits || {};
        limits[`${lottoId}:${number}`] = limit;
        
        await supabase.from('system_settings').upsert({
          setting_key: 'liability_limits',
          setting_value: { limits },
          updated_at: new Date().toISOString(),
        });
        
        // Broadcast to network
        if (broadcastToNetwork) {
          syncResult = await broadcastToAgents({
            type: 'limit_update',
            lottoId,
            data: { number, limit },
            timestamp: new Date().toISOString(),
            source: 'master',
          });
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `ตั้งวงเงินเลข ${number} = ${limit.toLocaleString()} บาท`,
          syncedTo: syncResult.sentTo
        });
      }
      
      case 'block_number': {
        if (!number) {
          return NextResponse.json({ error: 'number is required' }, { status: 400 });
        }
        
        // Update Redis
        await blockNumber(lottoId, number);
        
        // Update database
        const { data: currentBlocked } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'blocked_numbers')
          .single();
        
        const blockedNumbers = currentBlocked?.setting_value?.numbers || [];
        if (!blockedNumbers.includes(number)) {
          blockedNumbers.push(number);
        }
        
        await supabase.from('system_settings').upsert({
          setting_key: 'blocked_numbers',
          setting_value: { numbers: blockedNumbers, lottoId },
          updated_at: new Date().toISOString(),
        });
        
        // Broadcast to network
        if (broadcastToNetwork) {
          syncResult = await broadcastToAgents({
            type: 'number_block',
            lottoId,
            data: { number, action: 'block' },
            timestamp: new Date().toISOString(),
            source: 'master',
          });
        }
        
        // Log activity
        await supabase.from('activity_logs').insert({
          action: 'number_blocked',
          category: 'risk',
          details: { lottoId, number },
          created_at: new Date().toISOString(),
        });
        
        return NextResponse.json({ 
          success: true, 
          message: `อั้นเลข ${number} สำเร็จ`,
          syncedTo: syncResult.sentTo
        });
      }
      
      case 'unblock_number': {
        if (!number) {
          return NextResponse.json({ error: 'number is required' }, { status: 400 });
        }
        
        // Update Redis
        await unblockNumber(lottoId, number);
        
        // Update database
        const { data: currentBlocked } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'blocked_numbers')
          .single();
        
        const blockedNumbers = (currentBlocked?.setting_value?.numbers || []).filter(
          (n: string) => n !== number
        );
        
        await supabase.from('system_settings').upsert({
          setting_key: 'blocked_numbers',
          setting_value: { numbers: blockedNumbers, lottoId },
          updated_at: new Date().toISOString(),
        });
        
        // Broadcast to network
        if (broadcastToNetwork) {
          syncResult = await broadcastToAgents({
            type: 'number_block',
            lottoId,
            data: { number, action: 'unblock' },
            timestamp: new Date().toISOString(),
            source: 'master',
          });
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `ปลดอั้นเลข ${number} สำเร็จ`,
          syncedTo: syncResult.sentTo
        });
      }
      
      case 'close_market': {
        await updateMarketStatus(lottoId, 'closed', broadcastToNetwork);
        
        // Log activity
        await supabase.from('activity_logs').insert({
          action: 'market_closed',
          category: 'market',
          details: { lottoId, closedAt: new Date().toISOString() },
          created_at: new Date().toISOString(),
        });
        
        return NextResponse.json({ 
          success: true, 
          message: 'ปิดรับแทงสำเร็จ - Sync ไปยังเว็บลูกทั้งหมดแล้ว'
        });
      }
      
      case 'sync_limits': {
        // Sync all limits from DB to Redis
        await syncLimitsToRedis(lottoId);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Sync liability limits to Redis สำเร็จ'
        });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[MarketSettings] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
