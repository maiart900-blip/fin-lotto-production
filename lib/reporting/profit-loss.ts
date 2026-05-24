/**
 * Daily P/L Reporting Module
 * Data aggregation for Master and Agent levels
 */

import { createClient } from '@/lib/supabase/server';

// =============================================
// TYPES
// =============================================

export interface DailyPLSummary {
  date: string;
  totalBets: number;
  totalBetAmount: number;
  totalWinners: number;
  totalPayout: number;
  grossProfit: number;
  commission: number;
  netProfit: number;
  margin: number;
}

export interface AgentPLReport {
  agentId: string;
  agentCode: string;
  agentName: string;
  totalBets: number;
  totalBetAmount: number;
  totalPayout: number;
  commission: number;
  commissionRate: number;
  netSettlement: number;
  sharePercent: number;
  masterShare: number;
  agentShare: number;
}

export interface MasterPLReport {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalBetAmount: number;
    totalPayout: number;
    grossProfit: number;
    totalCommission: number;
    netProfit: number;
    margin: number;
  };
  byLottery: Array<{
    lotteryId: string;
    lotteryName: string;
    totalBets: number;
    totalBetAmount: number;
    totalPayout: number;
    profit: number;
  }>;
  byAgent: AgentPLReport[];
  dailyTrend: DailyPLSummary[];
}

export interface PLFilters {
  startDate: string;
  endDate: string;
  agentId?: string;
  lotteryId?: string;
}

// =============================================
// DAILY P/L CALCULATION
// =============================================

export async function getDailyPL(date: string): Promise<DailyPLSummary> {
  const supabase = await createClient();
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  // Get bet totals
  const { data: betData } = await supabase
    .from('entries')
    .select('total_amount')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .eq('status', 'confirmed');

  const totalBets = betData?.length || 0;
  const totalBetAmount = betData?.reduce((sum, e) => sum + Number(e.total_amount || 0), 0) || 0;

  // Get payout totals
  const { data: payoutData } = await supabase
    .from('entries')
    .select('payout_amount')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .eq('status', 'won');

  const totalWinners = payoutData?.length || 0;
  const totalPayout = payoutData?.reduce((sum, e) => sum + Number(e.payout_amount || 0), 0) || 0;

  // Get commission from agents
  const { data: commissionData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('transaction_type', 'commission')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const commission = commissionData?.reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;

  const grossProfit = totalBetAmount - totalPayout;
  const netProfit = grossProfit - commission;
  const margin = totalBetAmount > 0 ? (netProfit / totalBetAmount) * 100 : 0;

  return {
    date,
    totalBets,
    totalBetAmount,
    totalWinners,
    totalPayout,
    grossProfit,
    commission,
    netProfit,
    margin: Math.round(margin * 100) / 100,
  };
}

// =============================================
// AGENT-LEVEL P/L
// =============================================

export async function getAgentPL(
  agentId: string,
  startDate: string,
  endDate: string
): Promise<AgentPLReport | null> {
  const supabase = await createClient();

  // Get agent info
  const { data: agent } = await supabase
    .from('agents')
    .select('id, code, name, commission_rate, share_percent')
    .eq('id', agentId)
    .single();

  if (!agent) return null;

  // Get bet totals for this agent
  const { data: betData } = await supabase
    .from('bet_logs')
    .select('amount')
    .eq('agent_id', agentId)
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lte('created_at', `${endDate}T23:59:59.999Z`);

  const totalBets = betData?.length || 0;
  const totalBetAmount = betData?.reduce((sum, b) => sum + Number(b.amount || 0), 0) || 0;

  // Get payout totals
  const { data: payoutData } = await supabase
    .from('bet_logs')
    .select('actual_payout')
    .eq('agent_id', agentId)
    .eq('is_winner', true)
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lte('created_at', `${endDate}T23:59:59.999Z`);

  const totalPayout = payoutData?.reduce((sum, b) => sum + Number(b.actual_payout || 0), 0) || 0;

  const commissionRate = Number(agent.commission_rate) || 5;
  const sharePercent = Number(agent.share_percent) || 50;
  const commission = (totalBetAmount * commissionRate) / 100;
  const grossProfit = totalBetAmount - totalPayout;
  const netSettlement = grossProfit - commission;
  const masterShare = (netSettlement * (100 - sharePercent)) / 100;
  const agentShare = (netSettlement * sharePercent) / 100;

  return {
    agentId: agent.id,
    agentCode: agent.code,
    agentName: agent.name,
    totalBets,
    totalBetAmount,
    totalPayout,
    commission,
    commissionRate,
    netSettlement,
    sharePercent,
    masterShare,
    agentShare,
  };
}

// =============================================
// MASTER-LEVEL P/L REPORT
// =============================================

export async function getMasterPLReport(filters: PLFilters): Promise<MasterPLReport> {
  const supabase = await createClient();
  const { startDate, endDate, lotteryId } = filters;

  // Build query for entries
  let entriesQuery = supabase
    .from('entries')
    .select(`
      id,
      total_amount,
      payout_amount,
      status,
      created_at,
      lottery_id,
      lotteries (
        id,
        name
      )
    `)
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lte('created_at', `${endDate}T23:59:59.999Z`)
    .in('status', ['confirmed', 'won', 'lost']);

  if (lotteryId) {
    entriesQuery = entriesQuery.eq('lottery_id', lotteryId);
  }

  const { data: entries } = await entriesQuery;

  // Calculate summary
  const totalBetAmount = entries?.reduce((sum, e) => sum + Number(e.total_amount || 0), 0) || 0;
  const totalPayout = entries?.filter(e => e.status === 'won')
    .reduce((sum, e) => sum + Number(e.payout_amount || 0), 0) || 0;

  // Get all agents P/L
  const { data: agents } = await supabase
    .from('agents')
    .select('id, code, name, commission_rate, share_percent')
    .eq('status', 'active');

  const agentReports: AgentPLReport[] = [];
  let totalCommission = 0;

  if (agents) {
    for (const agent of agents) {
      const report = await getAgentPL(agent.id, startDate, endDate);
      if (report && report.totalBets > 0) {
        agentReports.push(report);
        totalCommission += report.commission;
      }
    }
  }

  // Calculate by lottery
  const lotteryMap = new Map<string, {
    lotteryId: string;
    lotteryName: string;
    totalBets: number;
    totalBetAmount: number;
    totalPayout: number;
  }>();

  entries?.forEach(entry => {
    const lottery = entry.lotteries as any;
    const key = entry.lottery_id || 'unknown';
    const existing = lotteryMap.get(key) || {
      lotteryId: key,
      lotteryName: lottery?.name || 'Unknown',
      totalBets: 0,
      totalBetAmount: 0,
      totalPayout: 0,
    };

    existing.totalBets++;
    existing.totalBetAmount += Number(entry.total_amount || 0);
    if (entry.status === 'won') {
      existing.totalPayout += Number(entry.payout_amount || 0);
    }

    lotteryMap.set(key, existing);
  });

  const byLottery = Array.from(lotteryMap.values()).map(l => ({
    ...l,
    profit: l.totalBetAmount - l.totalPayout,
  }));

  // Calculate daily trend
  const dailyTrend: DailyPLSummary[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dailyPL = await getDailyPL(dateStr);
    dailyTrend.push(dailyPL);
  }

  const grossProfit = totalBetAmount - totalPayout;
  const netProfit = grossProfit - totalCommission;
  const margin = totalBetAmount > 0 ? (netProfit / totalBetAmount) * 100 : 0;

  return {
    period: { startDate, endDate },
    summary: {
      totalBetAmount,
      totalPayout,
      grossProfit,
      totalCommission,
      netProfit,
      margin: Math.round(margin * 100) / 100,
    },
    byLottery,
    byAgent: agentReports.sort((a, b) => b.totalBetAmount - a.totalBetAmount),
    dailyTrend,
  };
}

// =============================================
// EXCEL EXPORT
// =============================================

export function generatePLExcelData(report: MasterPLReport) {
  // Summary sheet data
  const summaryData = [
    ['FIN LOTTO R+ - Daily P/L Report'],
    [''],
    ['Period', `${report.period.startDate} to ${report.period.endDate}`],
    [''],
    ['SUMMARY'],
    ['Total Bet Amount', report.summary.totalBetAmount],
    ['Total Payout', report.summary.totalPayout],
    ['Gross Profit', report.summary.grossProfit],
    ['Total Commission', report.summary.totalCommission],
    ['Net Profit', report.summary.netProfit],
    ['Margin %', `${report.summary.margin}%`],
  ];

  // By Lottery sheet data
  const lotteryData = [
    ['Lottery', 'Total Bets', 'Bet Amount', 'Payout', 'Profit'],
    ...report.byLottery.map(l => [
      l.lotteryName,
      l.totalBets,
      l.totalBetAmount,
      l.totalPayout,
      l.profit,
    ]),
  ];

  // By Agent sheet data
  const agentData = [
    ['Agent Code', 'Agent Name', 'Total Bets', 'Bet Amount', 'Payout', 'Commission', 'Net Settlement', 'Master Share', 'Agent Share'],
    ...report.byAgent.map(a => [
      a.agentCode,
      a.agentName,
      a.totalBets,
      a.totalBetAmount,
      a.totalPayout,
      a.commission,
      a.netSettlement,
      a.masterShare,
      a.agentShare,
    ]),
  ];

  // Daily Trend sheet data
  const trendData = [
    ['Date', 'Total Bets', 'Bet Amount', 'Winners', 'Payout', 'Gross Profit', 'Commission', 'Net Profit', 'Margin %'],
    ...report.dailyTrend.map(d => [
      d.date,
      d.totalBets,
      d.totalBetAmount,
      d.totalWinners,
      d.totalPayout,
      d.grossProfit,
      d.commission,
      d.netProfit,
      d.margin,
    ]),
  ];

  return {
    summary: summaryData,
    byLottery: lotteryData,
    byAgent: agentData,
    dailyTrend: trendData,
  };
}

// =============================================
// QUICK STATS FOR DASHBOARD
// =============================================

export async function getQuickPLStats() {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const [todayPL, yesterdayPL] = await Promise.all([
    getDailyPL(today),
    getDailyPL(yesterday),
  ]);

  const profitChange = yesterdayPL.netProfit !== 0
    ? ((todayPL.netProfit - yesterdayPL.netProfit) / Math.abs(yesterdayPL.netProfit)) * 100
    : 0;

  return {
    today: todayPL,
    yesterday: yesterdayPL,
    profitChange: Math.round(profitChange * 100) / 100,
    isUp: todayPL.netProfit > yesterdayPL.netProfit,
  };
}
