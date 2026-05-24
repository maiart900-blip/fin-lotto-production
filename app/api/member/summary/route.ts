import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get entries summary
    const { data: entries } = await supabase
      .from('entries')
      .select('amount, win_amount, status');

    const totalSales = entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
    const totalWinnings = entries?.reduce((sum, e) => sum + (Number(e.win_amount) || 0), 0) || 0;
    
    // Get customers count
    const { count: customerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    // Calculate commission (5% of sales)
    const totalCommission = totalSales * 0.05;

    // Calculate net profit
    const netProfit = totalSales - totalWinnings;

    // Get today's data
    const today = new Date().toISOString().split('T')[0];
    const { data: todayEntries } = await supabase
      .from('entries')
      .select('amount, win_amount')
      .gte('created_at', today);

    const todaySales = todayEntries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
    const todayWinnings = todayEntries?.reduce((sum, e) => sum + (Number(e.win_amount) || 0), 0) || 0;

    return NextResponse.json({
      totalSales,
      totalWinnings,
      totalCommission,
      totalCustomers: customerCount || 0,
      totalEntries: entries?.length || 0,
      netProfit,
      todaySales,
      todayWinnings,
      weekSales: totalSales * 0.3, // Mock data
      monthSales: totalSales * 0.8 // Mock data
    });
  } catch (error) {
    console.error('Member summary error:', error);
    return NextResponse.json({
      totalSales: 0,
      totalWinnings: 0,
      totalCommission: 0,
      totalCustomers: 0,
      totalEntries: 0,
      netProfit: 0,
      todaySales: 0,
      todayWinnings: 0,
      weekSales: 0,
      monthSales: 0
    });
  }
}
