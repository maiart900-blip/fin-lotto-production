import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface DownlineStats {
  id: string;
  name: string;
  phone: string;
  level: string;
  turnover: number;
  winAmount: number;
  netProfit: number;
  totalBets: number;
  winRate: number;
  creditBalance: number;
  isActive: boolean;
  lastActivity: string | null;
}

// Recursive function to get all downline IDs
async function getDownlineIds(supabase: any, agentId: string): Promise<string[]> {
  const ids: string[] = [];
  
  // Get direct downlines
  const { data: directDownlines } = await supabase
    .from('customers')
    .select('id')
    .eq('upline_id', agentId);
  
  if (directDownlines && directDownlines.length > 0) {
    for (const downline of directDownlines) {
      ids.push(downline.id);
      // Recursively get their downlines
      const childIds = await getDownlineIds(supabase, downline.id);
      ids.push(...childIds);
    }
  }
  
  return ids;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const agentId = searchParams.get('agentId');
  const period = searchParams.get('period') || 'today'; // today, week, month, all
  
  if (!agentId) {
    return NextResponse.json({ error: 'Agent ID required' }, { status: 400 });
  }

  try {
    // Calculate date range
    let startDate: Date | null = null;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'all':
        startDate = null;
        break;
    }

    // Get all downline IDs recursively
    const downlineIds = await getDownlineIds(supabase, agentId);
    
    if (downlineIds.length === 0) {
      return NextResponse.json({
        success: true,
        totalDownlines: 0,
        totalTurnover: 0,
        totalProfit: 0,
        downlines: [],
      });
    }

    // Get downline details
    const { data: downlines } = await supabase
      .from('customers')
      .select('id, name, phone, agent_level, credit_balance, is_active, last_login, upline_id')
      .in('id', downlineIds);

    // Get betting stats for each downline
    const downlineStats: DownlineStats[] = [];
    
    for (const downline of downlines || []) {
      let query = supabase
        .from('entries')
        .select('total_amount, win_amount, status, created_at')
        .eq('customer_id', downline.id);
      
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      
      const { data: entries } = await query;
      
      const turnover = entries?.reduce((sum: number, e: any) => sum + Number(e.total_amount || 0), 0) || 0;
      const winAmount = entries?.filter((e: any) => e.status === 'won')
        .reduce((sum: number, e: any) => sum + Number(e.win_amount || 0), 0) || 0;
      const totalBets = entries?.length || 0;
      const wonBets = entries?.filter((e: any) => e.status === 'won').length || 0;
      
      downlineStats.push({
        id: downline.id,
        name: downline.name,
        phone: downline.phone,
        level: downline.agent_level || 'member',
        turnover,
        winAmount,
        netProfit: turnover - winAmount,
        totalBets,
        winRate: totalBets > 0 ? (wonBets / totalBets) * 100 : 0,
        creditBalance: Number(downline.credit_balance || 0),
        isActive: downline.is_active !== false,
        lastActivity: downline.last_login,
      });
    }

    // Calculate totals
    const totalTurnover = downlineStats.reduce((sum, d) => sum + d.turnover, 0);
    const totalWinAmount = downlineStats.reduce((sum, d) => sum + d.winAmount, 0);
    const totalProfit = totalTurnover - totalWinAmount;

    // Sort by turnover descending
    downlineStats.sort((a, b) => b.turnover - a.turnover);

    return NextResponse.json({
      success: true,
      period,
      totalDownlines: downlineStats.length,
      totalTurnover,
      totalWinAmount,
      totalProfit,
      profitMargin: totalTurnover > 0 ? (totalProfit / totalTurnover) * 100 : 0,
      downlines: downlineStats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch downline stats' },
      { status: 500 }
    );
  }
}
