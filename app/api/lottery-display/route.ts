import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-auth';

/**
 * GET /api/lottery-display - PUBLIC ROUTE
 * Returns lottery display settings for customer-facing pages
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get all lotteries with their display settings
    const { data: lotteries, error: lotteriesError } = await supabase
      .from('lotteries')
      .select('*')
      .order('name');
    
    if (lotteriesError) throw lotteriesError;
    
    const { data: displaySettings, error: displayError } = await supabase
      .from('lottery_display_settings')
      .select('*')
      .order('display_order');
    
    if (displayError) throw displayError;
    
    // Merge lotteries with their display settings
    const result = lotteries?.map(lottery => {
      const display = displaySettings?.find(d => d.lottery_id === lottery.id);
      return {
        ...lottery,
        display_settings: display || {
          display_order: 0,
          is_visible: true,
          is_pinned: false,
          badge_text: null,
          badge_color: '#facc15',
          card_color: null,
          gradient_start: null,
          gradient_end: null,
          glow_enabled: false,
          glow_color: null,
        }
      };
    }) || [];
    
    // Sort by display_order
    result.sort((a, b) => (a.display_settings?.display_order || 0) - (b.display_settings?.display_order || 0));
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching lottery display:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

/**
 * PUT /api/lottery-display - ADMIN ONLY
 * Update display settings for a lottery
 */
export async function PUT(request: Request) {
  try {
    // Auth guard - require admin for updating display settings
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { lottery_id, ...settings } = body;
    
    if (!lottery_id) {
      return NextResponse.json({ error: 'lottery_id is required' }, { status: 400 });
    }
    
    // Upsert display settings
    const { data, error } = await supabase
      .from('lottery_display_settings')
      .upsert({
        lottery_id,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lottery_id' })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating lottery display:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

/**
 * POST /api/lottery-display - ADMIN ONLY
 * Update display order for multiple lotteries
 */
export async function POST(request: Request) {
  try {
    // Auth guard - require admin for updating display orders
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { orders } = body;
    
    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: 'orders array is required' }, { status: 400 });
    }
    
    // Update display orders for multiple lotteries
    for (const item of orders) {
      await supabase
        .from('lottery_display_settings')
        .upsert({
          lottery_id: item.lottery_id,
          display_order: item.display_order,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'lottery_id' });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating lottery orders:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
