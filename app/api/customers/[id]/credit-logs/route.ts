import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*, users(name)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) {
    return NextResponse.json([], { status: 200 });
  }
  
  // Map admin name
  const logs = (data || []).map((log: any) => ({
    ...log,
    admin_name: log.users?.name || null,
  }));
  
  return NextResponse.json(logs);
}
