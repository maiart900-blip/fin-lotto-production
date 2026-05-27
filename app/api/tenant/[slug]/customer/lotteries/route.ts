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

    // Get active lotteries (global - shared across all tenants)
    const { data: lotteries } = await supabase
      .from('lotteries')
      .select('id, name, category, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    // Format response
    const formattedLotteries = (lotteries || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      is_active: l.is_active,
    }));

    return NextResponse.json({ lotteries: formattedLotteries });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
