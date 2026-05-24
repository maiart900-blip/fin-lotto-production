'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  FileSpreadsheet,
  Calendar,
  RefreshCw,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Format number with commas
function formatNumber(num: number) {
  return new Intl.NumberFormat('th-TH').format(num);
}

// Format currency
function formatCurrency(num: number) {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Gold color palette for charts
const GOLD_COLORS = ['#EAB308', '#F5E1A4', '#CA8A04', '#FDE047', '#A16207'];

export default function ProfitLossReportPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch P/L data
  const { data, error, isLoading, mutate } = useSWR(
    `/api/reports/profit-loss?type=master&startDate=${startDate}&endDate=${endDate}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch quick stats
  const { data: quickStats } = useSWR(
    '/api/reports/profit-loss?type=quick',
    fetcher,
    { refreshInterval: 10000 }
  );

  // Export to Excel
  const handleExport = useCallback(async () => {
    if (!data?.data) return;
    
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/reports/profit-loss?type=master&startDate=${startDate}&endDate=${endDate}&format=excel`
      );
      const result = await response.json();
      
      if (result.sheets) {
        const wb = XLSX.utils.book_new();
        
        // Add Summary sheet
        const summaryWs = XLSX.utils.aoa_to_sheet(result.sheets.summary);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
        
        // Add By Lottery sheet
        const lotteryWs = XLSX.utils.aoa_to_sheet(result.sheets.byLottery);
        XLSX.utils.book_append_sheet(wb, lotteryWs, 'By Lottery');
        
        // Add By Agent sheet
        const agentWs = XLSX.utils.aoa_to_sheet(result.sheets.byAgent);
        XLSX.utils.book_append_sheet(wb, agentWs, 'By Agent');
        
        // Add Daily Trend sheet
        const trendWs = XLSX.utils.aoa_to_sheet(result.sheets.dailyTrend);
        XLSX.utils.book_append_sheet(wb, trendWs, 'Daily Trend');
        
        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(blob, `PL_Report_${startDate}_to_${endDate}.xlsx`);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  }, [data, startDate, endDate]);

  const report = data?.data;
  const stats = quickStats?.data;

  return (
    <div className="live-midnight-canvas min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-glow-gold text-[#EAB308]">
              Daily P/L Report
            </h1>
            <p className="text-[#64748B] mt-1">
              Profit & Loss Analytics for Master and Agent Levels
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#1E293B]/80 rounded-lg p-2">
              <Calendar className="size-4 text-[#EAB308]" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36 bg-transparent border-[#334155] text-[#F8FAFC] focus:border-[#EAB308]"
              />
              <span className="text-[#64748B]">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36 bg-transparent border-[#334155] text-[#F8FAFC] focus:border-[#EAB308]"
              />
            </div>
            
            <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
              <SelectTrigger className="w-32 bg-[#1E293B]/80 border-[#334155] text-[#F8FAFC]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1E293B] border-[#334155]">
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={() => mutate()} 
              variant="outline"
              className="border-[#EAB308] text-[#EAB308] hover:bg-[#EAB308]/10"
            >
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
            
            <Button 
              onClick={handleExport}
              disabled={isExporting || !report}
              className="bg-gradient-to-r from-[#EAB308] to-[#CA8A04] text-[#0F172A] hover:from-[#FDE047] hover:to-[#EAB308]"
            >
              {isExporting ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4 mr-2" />
              )}
              Export Excel
            </Button>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Today's Net Profit */}
          <Card className="ultra-glass-card border-[#F5E1A4]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#94A3B8]">Today&apos;s Net Profit</p>
                  <p className="text-2xl font-bold text-[#FDE047] mt-1">
                    {formatCurrency(stats?.today?.netProfit || 0)}
                  </p>
                  {stats && (
                    <div className={`flex items-center gap-1 mt-2 text-sm ${
                      stats.isUp ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {stats.isUp ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownRight className="size-4" />
                      )}
                      <span>{Math.abs(stats.profitChange)}% vs yesterday</span>
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-full bg-[#EAB308]/20">
                  {stats?.isUp ? (
                    <TrendingUp className="size-6 text-[#EAB308]" />
                  ) : (
                    <TrendingDown className="size-6 text-red-400" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Bet Amount */}
          <Card className="ultra-glass-card border-[#F5E1A4]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#94A3B8]">Period Bet Amount</p>
                  <p className="text-2xl font-bold text-[#F8FAFC] mt-1">
                    {formatCurrency(report?.summary?.totalBetAmount || 0)}
                  </p>
                  <p className="text-sm text-[#64748B] mt-2">
                    {formatNumber(report?.dailyTrend?.reduce((s: number, d: any) => s + d.totalBets, 0) || 0)} bets
                  </p>
                </div>
                <div className="p-3 rounded-full bg-[#3B82F6]/20">
                  <DollarSign className="size-6 text-[#3B82F6]" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Payout */}
          <Card className="ultra-glass-card border-[#F5E1A4]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#94A3B8]">Total Payout</p>
                  <p className="text-2xl font-bold text-[#EF4444] mt-1">
                    -{formatCurrency(report?.summary?.totalPayout || 0)}
                  </p>
                  <p className="text-sm text-[#64748B] mt-2">
                    {formatNumber(report?.dailyTrend?.reduce((s: number, d: any) => s + d.totalWinners, 0) || 0)} winners
                  </p>
                </div>
                <div className="p-3 rounded-full bg-red-500/20">
                  <Download className="size-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profit Margin */}
          <Card className="ultra-glass-card border-[#F5E1A4]/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#94A3B8]">Profit Margin</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {report?.summary?.margin || 0}%
                  </p>
                  <p className="text-sm text-[#64748B] mt-2">
                    Net: {formatCurrency(report?.summary?.netProfit || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-500/20">
                  <TrendingUp className="size-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Daily Trend Chart */}
          <Card className="ultra-glass-card border-[#F5E1A4]/30">
            <CardHeader>
              <CardTitle className="text-[#F8FAFC] flex items-center gap-2">
                <TrendingUp className="size-5 text-[#EAB308]" />
                Profit Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-[#EAB308]" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={report?.dailyTrend || []}>
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#64748B"
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis 
                      stroke="#64748B"
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1E293B', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#F8FAFC'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Net Profit']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="netProfit" 
                      stroke="#EAB308" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorProfit)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* By Lottery Chart */}
          <Card className="ultra-glass-card border-[#F5E1A4]/30">
            <CardHeader>
              <CardTitle className="text-[#F8FAFC] flex items-center gap-2">
                <Building2 className="size-5 text-[#EAB308]" />
                Profit by Lottery
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-[#EAB308]" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report?.byLottery?.slice(0, 5) || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      type="number" 
                      stroke="#64748B"
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="lotteryName" 
                      stroke="#64748B"
                      tick={{ fill: '#94A3B8', fontSize: 12 }}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1E293B', 
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#F8FAFC'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Profit']}
                    />
                    <Bar dataKey="profit" fill="#EAB308" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agent Performance Table */}
        <Card className="ultra-glass-card border-[#F5E1A4]/30">
          <CardHeader>
            <CardTitle className="text-[#F8FAFC] flex items-center gap-2">
              <Users className="size-5 text-[#EAB308]" />
              Agent Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#334155] hover:bg-transparent">
                    <TableHead className="text-[#94A3B8]">Agent</TableHead>
                    <TableHead className="text-[#94A3B8] text-right">Bets</TableHead>
                    <TableHead className="text-[#94A3B8] text-right">Bet Amount</TableHead>
                    <TableHead className="text-[#94A3B8] text-right">Payout</TableHead>
                    <TableHead className="text-[#94A3B8] text-right">Commission</TableHead>
                    <TableHead className="text-[#94A3B8] text-right">Net Settlement</TableHead>
                    <TableHead className="text-[#94A3B8] text-right">Master Share</TableHead>
                    <TableHead className="text-[#94A3B8] text-right">Agent Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <Loader2 className="size-6 animate-spin text-[#EAB308] mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : report?.byAgent?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-[#64748B]">
                        No agent data for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    report?.byAgent?.map((agent: any) => (
                      <TableRow key={agent.agentId} className="border-[#334155] hover:bg-[#1E293B]/50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-[#F8FAFC]">{agent.agentName}</p>
                            <p className="text-sm text-[#64748B]">{agent.agentCode}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-[#F8FAFC]">
                          {formatNumber(agent.totalBets)}
                        </TableCell>
                        <TableCell className="text-right text-[#F8FAFC]">
                          {formatCurrency(agent.totalBetAmount)}
                        </TableCell>
                        <TableCell className="text-right text-red-400">
                          -{formatCurrency(agent.totalPayout)}
                        </TableCell>
                        <TableCell className="text-right text-[#F59E0B]">
                          -{formatCurrency(agent.commission)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          agent.netSettlement >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(agent.netSettlement)}
                        </TableCell>
                        <TableCell className="text-right text-[#EAB308] font-medium">
                          {formatCurrency(agent.masterShare)}
                        </TableCell>
                        <TableCell className="text-right text-[#94A3B8]">
                          {formatCurrency(agent.agentShare)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Totals Row */}
            {report?.byAgent?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#334155] flex justify-end gap-8">
                <div className="text-right">
                  <p className="text-sm text-[#64748B]">Total Master Share</p>
                  <p className="text-xl font-bold text-[#EAB308]">
                    {formatCurrency(
                      report.byAgent.reduce((s: number, a: any) => s + a.masterShare, 0)
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#64748B]">Total Agent Share</p>
                  <p className="text-xl font-bold text-[#94A3B8]">
                    {formatCurrency(
                      report.byAgent.reduce((s: number, a: any) => s + a.agentShare, 0)
                    )}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Footer */}
        {report && (
          <Card className="bg-gradient-to-r from-[#EAB308]/10 to-[#CA8A04]/10 border-[#EAB308]/30">
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-5">
                <div className="text-center">
                  <p className="text-sm text-[#94A3B8]">Total Bet Amount</p>
                  <p className="text-xl font-bold text-[#F8FAFC]">
                    {formatCurrency(report.summary.totalBetAmount)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#94A3B8]">Total Payout</p>
                  <p className="text-xl font-bold text-red-400">
                    -{formatCurrency(report.summary.totalPayout)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#94A3B8]">Gross Profit</p>
                  <p className="text-xl font-bold text-[#F8FAFC]">
                    {formatCurrency(report.summary.grossProfit)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#94A3B8]">Commission</p>
                  <p className="text-xl font-bold text-[#F59E0B]">
                    -{formatCurrency(report.summary.totalCommission)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#94A3B8]">Net Profit</p>
                  <p className={`text-2xl font-bold ${
                    report.summary.netProfit >= 0 ? 'text-[#EAB308]' : 'text-red-400'
                  }`}>
                    {formatCurrency(report.summary.netProfit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
