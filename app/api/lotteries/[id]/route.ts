import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

/**
 * PUBLIC SAFE FIELDS - Only these fields are exposed to unauthenticated users
 * These are display/UI fields needed for customer-facing lottery pages
 */
const PUBLIC_LOTTERY_FIELDS = [
  'id',
  'name',
  'category',
  'is_active',
  'draw_type',
  'draw_days',
  'open_time',
  'close_time',
  'result_time',
  'sort_order',
  'flag_emoji',
  'flag_url',
  'icon_url',
  'bg_color',
  'text_color',
  'timezone',
  'country_code',
  // Card display (safe for public)
  'background_image',
  'card_color',
  'badge_color',
  'badge_text',
  'gradient_start',
  'gradient_end',
] as const;

/**
 * PUBLIC PAYOUT RATE FIELDS - Safe fields for payout rates
 */
const PUBLIC_PAYOUT_FIELDS = [
  'id',
  'lottery_id',
  'bet_type',
  'pay_rate',
  'max_bet',
  'min_bet',
] as const;

/**
 * PUBLIC BLOCKED NUMBER FIELDS - Safe fields (no internal IDs or admin info)
 */
const PUBLIC_BLOCKED_FIELDS = [
  'number',
  'bet_type',
  'block_date',
] as const;

/**
 * Serialize lottery for public response - removes internal/admin fields
 */
function serializePublicLottery(lottery: Record<string, unknown>) {
  const publicData: Record<string, unknown> = {};
  for (const field of PUBLIC_LOTTERY_FIELDS) {
    if (field in lottery) {
      publicData[field] = lottery[field];
    }
  }
  return publicData;
}

/**
 * Serialize payout rate for public response
 */
function serializePublicPayoutRate(rate: Record<string, unknown>) {
  const publicData: Record<string, unknown> = {};
  for (const field of PUBLIC_PAYOUT_FIELDS) {
    if (field in rate) {
      publicData[field] = rate[field];
    }
  }
  return publicData;
}

/**
 * Serialize blocked number for public response
 */
function serializePublicBlockedNumber(blocked: Record<string, unknown>) {
  const publicData: Record<string, unknown> = {};
  for (const field of PUBLIC_BLOCKED_FIELDS) {
    if (field in blocked) {
      publicData[field] = blocked[field];
    }
  }
  return publicData;
}

/**
 * GET /api/lotteries/[id] - PUBLIC ROUTE
 * 
 * Returns lottery details with payout rates for customer pages.
 * Only safe, non-sensitive fields are exposed.
 * 
 * EXCLUDED from public response:
 * - Internal IDs (tenant_id, created_by, etc.)
 * - Admin settings (note, is_closed_temp, etc.)
 * - Audit fields (created_at, updated_at)
 * - Business logic fields (agent settings, commission rates)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  // Get lottery by id - fetch all but serialize to public fields only
  const { data: lottery, error } = await supabase
    .from('lotteries')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !lottery) {
    return NextResponse.json({ error: 'Lottery not found' }, { status: 404 });
  }

  // Get payout rates for this lottery (public fields only)
  const { data: payoutRates } = await supabase
    .from('payout_rates')
    .select('id, lottery_id, bet_type, pay_rate, max_bet, min_bet')
    .eq('lottery_id', id);

  // Get blocked numbers for this lottery (today only, public fields only)
  const today = new Date().toISOString().split('T')[0];
  const { data: blockedNumbers } = await supabase
    .from('blocked_numbers')
    .select('number, bet_type, block_date')
    .eq('lottery_id', id)
    .or(`block_date.is.null,block_date.eq.${today}`);
  
  // Return serialized public response
  return NextResponse.json({
    ...serializePublicLottery(lottery),
    payout_rates: (payoutRates || []).map(serializePublicPayoutRate),
    blocked_numbers: (blockedNumbers || []).map(serializePublicBlockedNumber),
  });
}

/**
 * PUT /api/lotteries/[id] - ADMIN ONLY
 * Update lottery settings
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth guard - require admin for updating lottery
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

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

/**
 * DELETE /api/lotteries/[id] - ADMIN ONLY
 * Delete a lottery
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth guard - require admin for deleting lottery
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

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
