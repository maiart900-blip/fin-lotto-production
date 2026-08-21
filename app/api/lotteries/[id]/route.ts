import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  // Get lottery by id
  const { data: lottery, error } = await supabase
    .from('lotteries')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !lottery) {
    return NextResponse.json({ error: 'Lottery not found' }, { status: 404 });
  }

  // Get payout rates for this lottery
  const { data: payoutRates } = await supabase
    .from('payout_rates')
    .select('*')
    .eq('lottery_id', id);

  // Get blocked numbers for this lottery (today only)
  const today = new Date().toISOString().split('T')[0];
  const { data: blockedNumbers } = await supabase
    .from('blocked_numbers')
    .select('*')
    .eq('lottery_id', id)
    .or(`block_date.is.null,block_date.eq.${today}`);
  
  return NextResponse.json({
    ...lottery,
    payout_rates: payoutRates || [],
    blocked_numbers: blockedNumbers || [],
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('lotteries')
    .update({
      name: body.name,
      is_active: body.is_active,
      is_closed_temp: body.is_closed_temp ?? false,
      draw_type: body.draw_type,
      draw_days: body.draw_days,
      open_time: body.open_time,
      close_time: body.close_time,
      note: body.note,
      sort_order: body.sort_order,
      // Card display settings
      background_image: body.background_image || null,
      card_color: body.card_color || null,
      badge_color: body.badge_color || null,
      badge_text: body.badge_text || null,
      gradient_start: body.gradient_start || null,
      gradient_end: body.gradient_end || null,
      font_weight: body.font_weight || null,
      show_glow: body.show_glow ?? false,
      is_pinned: body.is_pinned ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('lotteries')
    .delete()
    .eq('id', id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}
