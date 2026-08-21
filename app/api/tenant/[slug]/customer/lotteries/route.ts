import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = getSupabase();
  try {
    const { slug } = await params;

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get active lottery rounds
    const { data: lotteries } = await supabase
      .from('lottery_rounds')
      .select('id, lottery_type:lottery_types(id, name, slug), close_time, status')
      .in('status', ['open', 'active'])
      .order('close_time', { ascending: true });

    // Format response
    const formattedLotteries = (lotteries || []).map((l: any) => ({
      id: l.id,
      name: l.lottery_type?.name || 'Unknown',
      slug: l.lottery_type?.slug || '',
      close_time: l.close_time ? new Date(l.close_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-',
      status: l.status,
    }));

    return NextResponse.json({ lotteries: formattedLotteries });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
