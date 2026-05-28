import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // Get tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const tenantId = tenant.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total customers
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Get new customers today
    const { count: newCustomersToday } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', today.toISOString());

    // Get bets today
    const { data: betsToday } = await supabase
      .from('entries')
      .select('amount, total_amount, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', today.toISOString());

    const totalBetsToday = betsToday?.length || 0;
    const totalBetsAmount = betsToday?.reduce((sum, b) => sum + (b.amount || b.total_amount || 0), 0) || 0;

    // Get payouts today (won bets)
    const { data: payoutsToday } = await supabase
      .from('entries')
      .select('prize_amount')
      .eq('tenant_id', tenantId)
      .eq('status', 'won')
      .gte('created_at', today.toISOString());

    const totalPayoutToday = payoutsToday?.reduce((sum, b) => sum + (b.prize_amount || 0), 0) || 0;

    // Calculate profit
    const profitToday = totalBetsAmount - totalPayoutToday;

    // Get pending settlement (simplified - sum of profits not yet settled)
    const pendingSettlement = profitToday > 0 ? profitToday : 0;

    return NextResponse.json({
      totalCustomers: totalCustomers || 0,
      newCustomersToday: newCustomersToday || 0,
      totalBetsToday,
      totalBetsAmount,
      totalPayoutToday,
      profitToday,
      pendingSettlement,
    });
  } catch (error) {
    console.error('Get tenant stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
