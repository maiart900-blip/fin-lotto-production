import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from('partner_shares')
    .select('*')
    .eq('partner_id', id)
    .order('period_start', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();

  // Get partner's share percent
  const { data: partner } = await supabase
    .from('partners')
    .select('share_percent')
    .eq('id', id)
    .single();

  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  }

  // Calculate share
  const shareAmount = (body.totalAmount * Number(partner.share_percent)) / 100;

  const { data, error } = await supabase
    .from('partner_shares')
    .insert({
      partner_id: id,
      period_start: body.periodStart,
      period_end: body.periodEnd,
      total_amount: body.totalAmount,
      share_percent: partner.share_percent,
      share_amount: shareAmount,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
