import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('entries')
    .select('*, lotteries(name)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) {
    return NextResponse.json([], { status: 200 });
  }
  
  // Map lottery name
  const entries = (data || []).map((e: any) => ({
    ...e,
    lottery_name: e.lotteries?.name || null,
  }));
  
  return NextResponse.json(entries);
}
