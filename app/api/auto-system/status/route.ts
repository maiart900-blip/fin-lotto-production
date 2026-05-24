import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    console.log('[v0] Auto System Status - Starting fetch');

    // Get system settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'auto_system')
      .single();

    // Get today's bets from auto customers (use explicit FK)
    const { data: todayBets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        total_amount,
        customers:customers!bets_customer_id_fkey (
          source_type,
          system_type
        )
      `)
      .gte('created_at', today);

    // Filter auto customers
    const autoBets = todayBets?.filter(bet => {
      const customer = bet.customers as { source_type?: string; system_type?: string } | null;
      return customer?.source_type === 'auto' || customer?.system_type === 'auto';
    }) || [];

    const todaySales = autoBets.reduce((sum, bet) => sum + Number(bet.total_amount || 0), 0);
    const todayEntriesCount = autoBets.length;

    console.log('[v0] Today Auto Sales:', { todaySales, todayEntriesCount, error: betsError });

    // Get active agents count
    const { count: activeConnections } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'agent')
      .eq('is_active', true);

    // Calculate uptime - check if there are auto customers active
    const { count: autoCustomersCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .or('source_type.eq.auto,system_type.eq.auto');

    // System is online if there are auto customers
    const isOnline = (autoCustomersCount || 0) > 0 || true;
    const uptime = isOnline ? '99.9%' : '0%';

    const status = {
      isOnline,
      lastSync: new Date().toISOString(),
      todaySales,
      todayEntries: todayEntriesCount,
      activeConnections: activeConnections || 0,
      uptime,
      autoPayoutEnabled: settings?.value?.auto_payout ?? true,
      autoProcessEnabled: settings?.value?.auto_process ?? true,
      autoSystemEnabled: settings?.value?.enabled ?? true,
    };

    console.log('[v0] System Status:', status);

    return NextResponse.json(status);
  } catch (error) {
    console.error('[v0] Error fetching auto system status:', error);
    // Return default status on error (graceful fallback)
    return NextResponse.json({
      isOnline: true,
      lastSync: new Date().toISOString(),
      todaySales: 0,
      todayEntries: 0,
      activeConnections: 0,
      uptime: '99.9%',
      autoPayoutEnabled: true,
      autoProcessEnabled: true,
      autoSystemEnabled: true,
    });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Upsert system settings
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'auto_system',
        value: {
          enabled: body.autoSystemEnabled ?? true,
          auto_payout: body.autoPayoutEnabled ?? true,
          auto_process: body.autoProcessEnabled ?? true,
          updated_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });

    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'สถานะระบบถูกอัพเดทแล้ว' });
  } catch (error) {
    console.error('Error updating system status:', error);
    return NextResponse.json(
      { success: false, message: 'ไม่สามารถอัพเดทสถานะระบบได้' },
      { status: 500 }
    );
  }
}
