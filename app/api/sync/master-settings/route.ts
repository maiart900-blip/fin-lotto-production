import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// API สำหรับเว็บลูกดึงค่าตั้งค่าจากเว็บแม่ (Real-time Dynamic Sync)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenant');
    const syncType = searchParams.get('type') || 'all';
    const since = searchParams.get('since'); // For incremental sync
    
    const supabase = await createClient();
    
    // ดึงข้อมูล Tenant
    let tenantSettings = null;
    if (tenantSlug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', tenantSlug)
        .single();
      tenantSettings = tenant;
    }
    
    const result: Record<string, unknown> = {};
    
    // 1. Payout Rates (อัตราจ่าย)
    if (syncType === 'all' || syncType === 'payout_rates') {
      const { data: payoutRates } = await supabase
        .from('payout_rates')
        .select('*')
        .eq('is_active', true);
      result.payout_rates = payoutRates || [];
    }
    
    // 2. Blocked Numbers (เลขอั้น)
    if (syncType === 'all' || syncType === 'blocked_numbers') {
      const { data: blockedNumbers } = await supabase
        .from('blocked_numbers')
        .select('*')
        .eq('is_active', true);
      result.blocked_numbers = blockedNumbers || [];
    }
    
    // 3. Risk Settings (ค่าความเสี่ยง)
    if (syncType === 'all' || syncType === 'risk_settings') {
      const { data: riskSettings } = await supabase
        .from('risk_settings')
        .select('*');
      result.risk_settings = riskSettings || [];
    }
    
    // 4. Lotteries Status (สถานะหวย) - Dynamic, no hardcoded limits
    if (syncType === 'all' || syncType === 'lotteries') {
      let lotteryQuery = supabase
        .from('lotteries')
        .select('id, name, category, is_active, open_time, close_time, draw_days, sort_order, flag_emoji, created_at, updated_at')
        .order('sort_order', { ascending: true });
      
      // Incremental sync - only get lotteries updated since last sync
      if (since) {
        lotteryQuery = lotteryQuery.gte('updated_at', since);
      }
      
      const { data: lotteries } = await lotteryQuery;
      result.lotteries = lotteries || [];
      result.lottery_count = lotteries?.length || 0;
    }
    
    // 5. Bet Types (ประเภทเดิมพัน)
    if (syncType === 'all' || syncType === 'bet_types') {
      const { data: betTypes } = await supabase
        .from('bet_types')
        .select('*')
        .eq('is_active', true);
      result.bet_types = betTypes || [];
    }
    
    return NextResponse.json({
      success: true,
      tenant: tenantSettings,
      data: result,
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Master sync error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'ไม่สามารถดึงข้อมูลจากเว็บแม่ได้' 
    }, { status: 500 });
  }
}

// API สำหรับ Push settings ไปยังเว็บลูก
export async function POST(request: Request) {
  try {
    const { tenantId, settings, settingsType } = await request.json();
    const supabase = await createClient();
    
    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();
    
    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    
    // Update sync timestamp
    await supabase
      .from('tenants')
      .update({ 
        updated_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', tenantId);
    
    // Log sync event
    await supabase
      .from('tenant_alerts')
      .insert({
        tenant_id: tenantId,
        alert_type: 'info',
        title: 'Settings Synced',
        message: `${settingsType || 'All'} settings synced from master`,
      });
    
    return NextResponse.json({
      success: true,
      message: 'Settings synced successfully',
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Master push error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
