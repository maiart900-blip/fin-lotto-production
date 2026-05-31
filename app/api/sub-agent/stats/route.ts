import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  
  const { user } = authResult;
  
  // Only allow sub_agent role
  if (user.role !== 'sub_agent') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get today's entries stats
  const { data: todayEntries } = await supabase
    .from('entries')
    .select('id, total_amount, payout_amount')
    .eq('agent_id', user.id)
    .gte('created_at', today.toISOString());
  
  // Get customer count
  const { count: customerCount } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', user.id);
  
  // Calculate stats
  const todayTurnover = todayEntries?.reduce((sum, e) => sum + (e.total_amount || 0), 0) || 0;
  const todayPayout = todayEntries?.reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;
  const todayEntriesCount = todayEntries?.length || 0;
  
  return NextResponse.json({
    todayTurnover,
    todayPayout,
    todayEntries: todayEntriesCount,
    totalCustomers: customerCount || 0,
  });
}
