import { NextRequest, NextResponse } from 'next/server';
import { 
  getMasterPLReport, 
  getAgentPL, 
  getDailyPL, 
  getQuickPLStats,
  generatePLExcelData 
} from '@/lib/reporting/profit-loss';

// GET - Fetch P/L report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'master';
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const agentId = searchParams.get('agentId');
    const lotteryId = searchParams.get('lotteryId');
    const format = searchParams.get('format') || 'json';

    let data: any;

    switch (reportType) {
      case 'daily':
        data = await getDailyPL(startDate);
        break;
      
      case 'agent':
        if (!agentId) {
          return NextResponse.json(
            { error: 'agentId is required for agent report' },
            { status: 400 }
          );
        }
        data = await getAgentPL(agentId, startDate, endDate);
        break;
      
      case 'quick':
        data = await getQuickPLStats();
        break;
      
      case 'master':
      default:
        data = await getMasterPLReport({
          startDate,
          endDate,
          agentId: agentId || undefined,
          lotteryId: lotteryId || undefined,
        });
        break;
    }

    // If Excel format requested, return data formatted for Excel
    if (format === 'excel' && reportType === 'master') {
      const excelData = generatePLExcelData(data);
      return NextResponse.json({
        success: true,
        format: 'excel',
        sheets: excelData,
      });
    }

    return NextResponse.json({
      success: true,
      reportType,
      period: { startDate, endDate },
      data,
    });
  } catch (error) {
    console.error('P/L Report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate P/L report' },
      { status: 500 }
    );
  }
}

// POST - Generate custom P/L report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      startDate, 
      endDate, 
      agentIds, 
      lotteryIds,
      groupBy = 'day', // day, week, month
      includeAgentDetails = true,
    } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Generate master report
    const masterReport = await getMasterPLReport({
      startDate,
      endDate,
      lotteryId: lotteryIds?.[0],
    });

    // Filter agents if specified
    let filteredAgents = masterReport.byAgent;
    if (agentIds && agentIds.length > 0) {
      filteredAgents = filteredAgents.filter(a => agentIds.includes(a.agentId));
    }

    // Group daily trend if needed
    let groupedTrend = masterReport.dailyTrend;
    if (groupBy === 'week') {
      groupedTrend = groupByWeek(masterReport.dailyTrend);
    } else if (groupBy === 'month') {
      groupedTrend = groupByMonth(masterReport.dailyTrend);
    }

    return NextResponse.json({
      success: true,
      report: {
        ...masterReport,
        byAgent: includeAgentDetails ? filteredAgents : [],
        dailyTrend: groupedTrend,
      },
    });
  } catch (error) {
    console.error('Custom P/L Report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate custom P/L report' },
      { status: 500 }
    );
  }
}

// Helper: Group by week
function groupByWeek(dailyData: any[]) {
  const weeks = new Map<string, any>();
  
  dailyData.forEach(day => {
    const date = new Date(day.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    const existing = weeks.get(weekKey) || {
      date: weekKey,
      totalBets: 0,
      totalBetAmount: 0,
      totalWinners: 0,
      totalPayout: 0,
      grossProfit: 0,
      commission: 0,
      netProfit: 0,
    };
    
    existing.totalBets += day.totalBets;
    existing.totalBetAmount += day.totalBetAmount;
    existing.totalWinners += day.totalWinners;
    existing.totalPayout += day.totalPayout;
    existing.grossProfit += day.grossProfit;
    existing.commission += day.commission;
    existing.netProfit += day.netProfit;
    
    weeks.set(weekKey, existing);
  });
  
  return Array.from(weeks.values()).map(w => ({
    ...w,
    margin: w.totalBetAmount > 0 ? Math.round((w.netProfit / w.totalBetAmount) * 10000) / 100 : 0,
  }));
}

// Helper: Group by month
function groupByMonth(dailyData: any[]) {
  const months = new Map<string, any>();
  
  dailyData.forEach(day => {
    const monthKey = day.date.substring(0, 7); // YYYY-MM
    
    const existing = months.get(monthKey) || {
      date: monthKey,
      totalBets: 0,
      totalBetAmount: 0,
      totalWinners: 0,
      totalPayout: 0,
      grossProfit: 0,
      commission: 0,
      netProfit: 0,
    };
    
    existing.totalBets += day.totalBets;
    existing.totalBetAmount += day.totalBetAmount;
    existing.totalWinners += day.totalWinners;
    existing.totalPayout += day.totalPayout;
    existing.grossProfit += day.grossProfit;
    existing.commission += day.commission;
    existing.netProfit += day.netProfit;
    
    months.set(monthKey, existing);
  });
  
  return Array.from(months.values()).map(m => ({
    ...m,
    margin: m.totalBetAmount > 0 ? Math.round((m.netProfit / m.totalBetAmount) * 10000) / 100 : 0,
  }));
}
