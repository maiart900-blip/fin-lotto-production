import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/api-auth';

// GET - สรุปยอดตามสายงาน (Agent Report)
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require super_admin for master agent reports
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const period = searchParams.get('period') || 'today'; // today, week, month, custom

    // Calculate date range
    let dateFrom: Date;
    let dateTo = new Date();
    dateTo.setHours(23, 59, 59, 999);

    switch (period) {
      case 'today':
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 1);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(dateFrom);
        dateTo.setHours(23, 59, 59, 999);
        break;
      case 'week':
        dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 7);
        dateFrom.setHours(0, 0, 0, 0);
        break;
      case 'month':
        dateFrom = new Date();
        dateFrom.setDate(1);
        dateFrom.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        dateFrom = startDate ? new Date(startDate) : new Date();
        dateTo = endDate ? new Date(endDate) : new Date();
        dateTo.setHours(23, 59, 59, 999);
        break;
      default:
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
    }

    // ดึงลูกสายทั้งหมด
    let agentsQuery = supabase
      .from('users')
      .select('id, username, display_name, status')
      .eq('role', 'agent')
      .eq('source_type', 'auto');

    if (agentId) {
      agentsQuery = agentsQuery.eq('id', agentId);
    }

    const { data: agents } = await agentsQuery;
    const agentIds = agents?.map(a => a.id) || [];

    if (agentIds.length === 0) {
      return NextResponse.json({ 
        reports: [], 
        summary: { totalSales: 0, totalWinnings: 0, totalProfit: 0 } 
      });
    }

    // ดึงยอดขาย
    const { data: entries } = await supabase
      .from('entries')
      .select('id, agent_id, amount, status, created_at')
      .in('agent_id', agentIds)
      .gte('created_at', dateFrom.toISOString())
      .lte('created_at', dateTo.toISOString());

    // ดึงยอดถูกรางวัล
    const { data: winnings } = await supabase
      .from('entries')
      .select('agent_id, prize_amount')
      .in('agent_id', agentIds)
      .eq('status', 'won')
      .gte('created_at', dateFrom.toISOString())
      .lte('created_at', dateTo.toISOString());

    // ดึงค่าคอมมิชชั่น
    const { data: commissions } = await supabase
      .from('agent_commission_settings')
      .select('agent_id, commission_percent')
      .in('agent_id', agentIds);

    // ดึงจำนวนลูกค้า
    const { data: customers } = await supabase
      .from('customers')
      .select('agent_id')
      .in('agent_id', agentIds);

    // สร้างรายงานต่อ Agent
    const reports = agents?.map(agent => {
      const agentEntries = entries?.filter(e => e.agent_id === agent.id) || [];
      const agentWinnings = winnings?.filter(w => w.agent_id === agent.id) || [];
      const agentCommission = commissions?.find(c => c.agent_id === agent.id);
      const agentCustomers = customers?.filter(c => c.agent_id === agent.id) || [];

      const totalSales = agentEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalWinnings = agentWinnings.reduce((sum, w) => sum + (w.prize_amount || 0), 0);
      const commissionPercent = agentCommission?.commission_percent || 5;
      const commissionAmount = totalSales * (commissionPercent / 100);
      const profit = totalSales - totalWinnings - commissionAmount;

      return {
        agentId: agent.id,
        username: agent.username,
        displayName: agent.display_name,
        status: agent.status,
        customerCount: agentCustomers.length,
        entriesCount: agentEntries.length,
        totalSales,
        totalWinnings,
        commissionPercent,
        commissionAmount,
        profit,
        profitPercent: totalSales > 0 ? ((profit / totalSales) * 100).toFixed(2) : '0',
      };
    }) || [];

    // สรุปรวม
    const summary = {
      totalAgents: reports.length,
      totalSales: reports.reduce((sum, r) => sum + r.totalSales, 0),
      totalWinnings: reports.reduce((sum, r) => sum + r.totalWinnings, 0),
      totalCommission: reports.reduce((sum, r) => sum + r.commissionAmount, 0),
      totalProfit: reports.reduce((sum, r) => sum + r.profit, 0),
      totalEntries: reports.reduce((sum, r) => sum + r.entriesCount, 0),
      totalCustomers: reports.reduce((sum, r) => sum + r.customerCount, 0),
      period: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
        label: period
      }
    };

    // Sort by total sales descending
    reports.sort((a, b) => b.totalSales - a.totalSales);

    return NextResponse.json({ 
      reports, 
      summary,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error generating agent report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
