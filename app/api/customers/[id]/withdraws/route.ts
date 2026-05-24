import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('withdraw_requests')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });
  
  if (error) {
    return NextResponse.json([], { status: 200 });
  }
  
  return NextResponse.json(data || []);
}
