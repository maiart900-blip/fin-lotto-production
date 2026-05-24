import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'today';
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const now = new Date();
    let start: Date, end: Date;

    switch (range) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      case 'week':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        end = now;
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = endDate ? new Date(endDate) : now;
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = now;
    }

    const { data: entries } = await supabase
      .from('entries')
      .select('id, user_id, amount, numbers, bet_type, is_winner, payout_amount, created_at')
      .eq('source_type', 'auto')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const totalSales = entries?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const totalPayout = entries?.filter(e => e.is_winner).reduce((sum, e) => sum + (e.payout_amount || 0), 0) || 0;
    const totalProfit = totalSales - totalPayout > 0 ? totalSales - totalPayout : 0;
    const totalLoss = totalPayout > totalSales ? totalPayout - totalSales : 0;
    const netProfit = totalSales - totalPayout;
    const winners = entries?.filter(e => e.is_winner).length || 0;
    const winRate = entries?.length ? Math.round((winners / entries.length) * 100) : 0;

    const chartData: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayEntries = entries?.filter(e => e.created_at.startsWith(dateStr)) || [];
      const daySales = dayEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
      const dayPayout = dayEntries.filter(e => e.is_winner).reduce((sum, e) => sum + (e.payout_amount || 0), 0);
      
      chartData.push({
        date: date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        sales: daySales,
        profit: daySales - dayPayout > 0 ? daySales - dayPayout : 0,
        loss: dayPayout > daySales ? dayPayout - daySales : 0,
      });
    }

    const agentSales = new Map<string, number>();
    const agentCommission = new Map<string, number>();
    entries?.forEach(e => {
      agentSales.set(e.user_id, (agentSales.get(e.user_id) || 0) + (e.amount || 0));
      agentCommission.set(e.user_id, (agentCommission.get(e.user_id) || 0) + Math.round((e.amount || 0) * 0.05));
    });

    const topAgentIds = [...agentSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
    const { data: topAgentData } = await supabase.from('users').select('id, username, display_name').in('id', topAgentIds);
    const { data: memberCounts } = await supabase.from('customers').select('agent_id').in('agent_id', topAgentIds);

    const topAgents = topAgentIds.map(id => {
      const agent = topAgentData?.find(a => a.id === id);
      return {
        id,
        username: agent?.username || 'unknown',
        display_name: agent?.display_name || 'Unknown',
        total_sales: agentSales.get(id) || 0,
        commission: agentCommission.get(id) || 0,
        member_count: memberCounts?.filter(m => m.agent_id === id).length || 0,
      };
    });

    const numberCounts = new Map<string, { amount: number; count: number }>();
    entries?.forEach(e => {
      const numbers = e.numbers || '';
      const current = numberCounts.get(numbers) || { amount: 0, count: 0 };
      numberCounts.set(numbers, { amount: current.amount + (e.amount || 0), count: current.count + 1 });
    });

    const topNumbers = [...numberCounts.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 10).map(([number, data]) => ({ number, amount: data.amount, count: data.count }));

    const riskNumbers = [...numberCounts.entries()]
      .map(([number, data]) => {
        const payout = data.amount * 80;
        const loss = payout - totalSales;
        return { number, amount: data.amount, payout, loss, risk: loss > totalSales * 0.5 ? 'high' : loss > totalSales * 0.2 ? 'medium' : 'low' };
      })
      .filter(n => n.risk !== 'low')
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 10);

    return NextResponse.json({
      summary: { totalSales, totalProfit, totalLoss, netProfit, winRate },
      chartData,
      topAgents,
      topNumbers,
      riskNumbers,
    });
  } catch (error: any) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
