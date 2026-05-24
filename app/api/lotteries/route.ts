import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Standard payout rates for auto-inheritance
const STANDARD_PAYOUT_RATES = [
  { bet_type: '3top', pay_rate: 900 },
  { bet_type: '3tode', pay_rate: 150 },
  { bet_type: '2top', pay_rate: 90 },
  { bet_type: '2bot', pay_rate: 90 },
  { bet_type: 'run_top', pay_rate: 3.2 },
  { bet_type: 'run_bot', pay_rate: 4.2 },
  { bet_type: '3front', pay_rate: 450 },
  { bet_type: '3back', pay_rate: 450 },
];

export async function GET(request: Request) {
  try {
    // Auth guard - require authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const activeOnly = searchParams.get('active') !== 'false';
    const baseUrl = new URL(request.url).origin;
    
    // Dynamic query - no hardcoded limits
    let query = supabase
      .from('lotteries')
      .select('*')
      .order('sort_order', { ascending: true });
    
    // Filter by active status if requested
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data: lotteries, error } = await query;
    
    if (error) {
      return NextResponse.json([]);
    }
    
    // Fetch display settings for all lotteries
    const { data: displaySettings } = await supabase
      .from('lottery_display_settings')
      .select('*');
    
    // Create a map for quick lookup
    const displayMap = new Map();
    displaySettings?.forEach((setting: { lottery_id: string; [key: string]: unknown }) => {
      displayMap.set(setting.lottery_id, setting);
    });
    
    // Merge lotteries with their display settings
    const mergedData = lotteries?.map(lottery => {
      const display = displayMap.get(lottery.id);
      if (display) {
        // Convert private blob URLs to proxied URLs
        let backgroundImage = display.background_image;
        if (backgroundImage?.includes('.private.blob.vercel-storage.com')) {
          try {
            const urlObj = new URL(backgroundImage);
            const pathname = urlObj.pathname.slice(1);
            backgroundImage = `${baseUrl}/api/image?pathname=${encodeURIComponent(pathname)}`;
          } catch {
            // Keep original URL
          }
        }
        
        return {
          ...lottery,
          background_image: backgroundImage,
          card_color: display.card_color,
          badge_color: display.badge_color,
          badge_text: display.badge_text,
          gradient_start: display.gradient_start,
          gradient_end: display.gradient_end,
          font_weight: display.font_family,
          text_color: display.text_color,
          show_glow: display.glow_enabled,
          is_pinned: display.is_pinned,
          display_order: display.display_order,
          is_visible: display.is_visible ?? true,
          stream_url: display.stream_url,
          stream_type: display.stream_type,
        };
      }
      return lottery;
    }) || [];
    
    // If tenant specified, check sync settings
    if (tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('sync_lottery_status')
        .eq('id', tenantId)
        .single();
      
      // If tenant doesn't sync lottery status, return all
      if (tenant && !tenant.sync_lottery_status) {
        // Could apply tenant-specific overrides here
      }
    }
    
    return NextResponse.json(mergedData);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // 1. Create new lottery
    const { data: lottery, error } = await supabase
      .from('lotteries')
      .insert({
        name: body.name,
        category: body.category || 'foreign',
        is_active: body.is_active ?? true,
        draw_type: body.draw_type || 'daily',
        draw_days: body.draw_days || [],
        open_time: body.open_time || '06:00',
        close_time: body.close_time || '14:00',
        note: body.note,
        sort_order: body.sort_order || 0,
        flag_emoji: body.flag_emoji,
        result_api_url: body.result_api_url,
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 2. Auto-inherit standard payout rates for new lottery
    const payoutRatesToInsert = STANDARD_PAYOUT_RATES.map(rate => ({
      lottery_id: lottery.id,
      bet_type: rate.bet_type,
      pay_rate: rate.pay_rate,
      is_active: true,
    }));
    
    await supabase
      .from('payout_rates')
      .insert(payoutRatesToInsert);
    
    // 3. Notify all sub-sites about new lottery (async)
    notifySubSites(supabase, lottery);
    
    return NextResponse.json({
      success: true,
      lottery,
      message: `สร้างหวย "${lottery.name}" สำเร็จ พร้อมอัตราจ่ายมาตรฐาน`,
    });
  } catch (err) {
    console.error('[v0] Lottery POST exception:', err);
    return NextResponse.json({ error: 'ไม่สามารถสร้างหวยได้' }, { status: 500 });
  }
}

// Notify all active sub-sites about new lottery
async function notifySubSites(supabase: any, lottery: any) {
  try {
    // Get all active tenants
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name, sync_lottery_status')
      .eq('is_active', true)
      .eq('is_master', false);
    
    if (!tenants || tenants.length === 0) return;
    
    // Create alerts for each tenant
    const alerts = tenants.map((tenant: any) => ({
      tenant_id: tenant.id,
      alert_type: 'info',
      title: 'หวยใหม่พร้อมใช้งาน',
      message: `หวย "${lottery.name}" ถูกเพิ่มเข้าระบบแล้ว พร้อมอัตราจ่ายมาตรฐาน`,
    }));
    
    await supabase.from('tenant_alerts').insert(alerts);
  } catch (err) {
    console.error('[v0] Notify sub-sites error:', err);
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json({ error: 'Missing lottery ID' }, { status: 400 });
    }
    
    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    
    // List of allowed fields to update
    const allowedFields = [
      'name', 'category', 'is_active', 'is_closed_temp', 'draw_type', 'draw_days',
      'open_time', 'close_time', 'note', 'sort_order', 'country_code',
      'flag_url', 'icon_url', 'bg_color', 'text_color', 'flag_emoji',
      'result_api_url', 'timezone', 'result_time', 'allow_advance_purchase',
      'auto_next_round', 'super_admin_override'
    ];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    // Always update updated_at
    updateData.updated_at = new Date().toISOString();
    
    const { data: lottery, error } = await supabase
      .from('lotteries')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) {
      console.error('[v0] Lottery update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      lottery,
      message: `อัปเดตหวย "${lottery.name}" สำเร็จ`,
    });
  } catch (err) {
    console.error('[v0] Lottery PUT exception:', err);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตหวยได้' }, { status: 500 });
  }
}
