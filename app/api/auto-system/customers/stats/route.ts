import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('Auto Customers Stats - Starting fetch');

    // Get total auto customers (source_type = 'auto' OR system_type = 'auto')
    const { count: total, data: allAutoCustomers, error: totalError } = await supabase
      .from('customers')
      .select('id, name, is_active, agent_level, created_at, source_type, system_type', { count: 'exact' })
      .or('source_type.eq.auto,system_type.eq.auto');

    console.log('Total Auto Customers:', { count: total, sample: allAutoCustomers?.slice(0, 3), error: totalError });

    // Get online (active) auto customers
    const online = allAutoCustomers?.filter(c => c.is_active === true).length || 0;

    // Get VIP auto customers (agent_level higher than member)
    const vip = allAutoCustomers?.filter(c => c.agent_level && c.agent_level !== 'member').length || 0;

    // Get new auto customers today
    const newToday = allAutoCustomers?.filter(c => {
      const createdAt = new Date(c.created_at);
      return createdAt >= today;
    }).length || 0;

    console.log('Auto Customers Breakdown:', { total, online, vip, newToday });

    // Get total bets today from auto customers
    const customerIds = allAutoCustomers?.map(c => c.id) || [];
    
    let totalBetsToday = 0;
    if (customerIds.length > 0) {
      const { data: betsData, error: betsError } = await supabase
        .from('bets')
        .select('total_amount')
        .in('customer_id', customerIds)
        .gte('created_at', today.toISOString());

      totalBetsToday = (betsData || []).reduce((sum, bet) => sum + Number(bet.total_amount || 0), 0);
      
      console.log('Today Bets for Auto Customers:', { 
        count: betsData?.length, 
        totalBetsToday, 
        error: betsError 
      });
    }

    return NextResponse.json({
      stats: {
        total: total || 0,
        online,
        vip,
        newToday,
        totalBetsToday,
      },
    });
  } catch (error) {
    console.error('Auto customers stats error:', error);
    return NextResponse.json({
      stats: {
        total: 0,
        online: 0,
        vip: 0,
        newToday: 0,
        totalBetsToday: 0,
      },
    });
  }
}
