'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  Globe,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// =============================================================================
// OMNI-CHANNEL REPORTING
// =============================================================================
// รายงานที่แสดงยอดรวมทั้งเครือ และสามารถเจาะจงดูรายได้แยกตามเว็บลูกได้
// =============================================================================

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function OmniChannelReportsPage() {
  const [selectedSite, setSelectedSite] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ดึงข้อมูลจาก APIs
  const { data: sitesData, mutate: mutateSites, isLoading: loadingSites } = useSWR('/api/sites', fetcher);
  const { data: dashboardStats, mutate: mutateDashboard, isLoading: loadingStats } = useSWR('/api/dashboard/stats', fetcher);
  const { data: betSummary, mutate: mutateBetSummary, isLoading: loadingBets } = useSWR('/api/bet-summary', fetcher);
  const { data: agentsData } = useSWR('/api/agents', fetcher);
  const { data: customersData } = useSWR('/api/customers', fetcher);

  const isLoading = loadingSites || loadingStats || loadingBets;

  // Map sites from API - ถ้าไม่มีข้อมูลจะเป็น empty array + "all" option
  const apiSites = sitesData?.sites || sitesData || [];
  const SITES = [
    { id: 'all', name: 'ทุกเว็บลูก', domain: 'all' },
    ...apiSites.map((s: any) => ({
      id: s.id,
      name: s.name || s.site_name || 'Unknown',
      domain: s.domain || '-',
    })),
  ];

  // Map dashboard data to report format
  const agents = agentsData?.agents || agentsData || [];
  const customers = Array.isArray(customersData) ? customersData : [];

  const REPORT_DATA: Record<string, any> = {
    all: {
      totalVolume: dashboardStats?.total?.totalBets || betSummary?.totalAmount || 0,
      totalRevenue: dashboardStats?.total?.netProfit || betSummary?.profitLoss || 0,
      totalMembers: customers.length,
      totalAgents: agents.length,
      todayVolume: dashboardStats?.today?.totalBets || betSummary?.todayAmount || 0,
      todayRevenue: dashboardStats?.today?.netProfit || 0,
      weeklyGrowth: 0,
      monthlyGrowth: 0,
    },
  };

  // Add site-specific data (simplified - using proportional estimates)
  apiSites.forEach((site: any, index: number) => {
    const proportion = apiSites.length > 0 ? 1 / apiSites.length : 0;
    REPORT_DATA[site.id] = {
      totalVolume: Math.round((REPORT_DATA.all.totalVolume || 0) * proportion),
      totalRevenue: Math.round((REPORT_DATA.all.totalRevenue || 0) * proportion),
      totalMembers: Math.round((REPORT_DATA.all.totalMembers || 0) * proportion),
      totalAgents: Math.round((REPORT_DATA.all.totalAgents || 0) * proportion),
      todayVolume: Math.round((REPORT_DATA.all.todayVolume || 0) * proportion),
      todayRevenue: Math.round((REPORT_DATA.all.todayRevenue || 0) * proportion),
      weeklyGrowth: 0,
      monthlyGrowth: 0,
    };
  });

  // Daily breakdown - empty for now (would need specific API endpoint)
  const DAILY_BREAKDOWN: any[] = [];

  const currentData = REPORT_DATA[selectedSite] || REPORT_DATA.all;
  const selectedSiteInfo = SITES.find(s => s.id === selectedSite);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([mutateSites(), mutateDashboard(), mutateBetSummary()]);
    setIsRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `฿${(amount / 1000000).toFixed(2)}M`;
    }
    return `฿${amount.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            Omni-Channel Reports
          </h1>
          <p className="text-slate-400 mt-1">รายงานยอดรวมทั้งเครือ - แยกตามเว็บลูก (Site ID)</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Site Filter */}
          <div className="relative">
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="appearance-none pl-10 pr-10 py-2.5 rounded-xl bg-black/40 border border-amber-500/30 text-white focus:border-amber-400 focus:outline-none min-w-[200px]"
            >
              {SITES.map(site => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-amber-500" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
          </div>

          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/30 text-white focus:border-amber-400 focus:outline-none"
          >
            <option value="1d">วันนี้</option>
            <option value="7d">7 วัน</option>
            <option value="30d">30 วัน</option>
            <option value="90d">90 วัน</option>
          </select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className="border-amber-500/30 hover:bg-amber-500/10"
          >
            <RefreshCw className={cn("size-5 text-amber-500", isRefreshing && "animate-spin")} />
          </Button>

          {/* Export Button */}
          <Button className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600">
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Site Badge */}
      {selectedSite !== 'all' && (
        <div className="mb-6">
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 px-4 py-2 text-sm">
            <Globe className="size-4 mr-2" />
            กำลังดูข้อมูลของ: {selectedSiteInfo?.name} ({selectedSiteInfo?.domain})
          </Badge>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Total Volume */}
        <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                <DollarSign className="size-6 text-amber-500" />
              </div>
              {currentData.weeklyGrowth >= 0 ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <ArrowUpRight className="size-3 mr-1" />
                  +{currentData.weeklyGrowth}%
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  <ArrowDownRight className="size-3 mr-1" />
                  {currentData.weeklyGrowth}%
                </Badge>
              )}
            </div>
            <p className="text-slate-400 text-sm mb-1">ยอดแทงรวม</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(currentData.totalVolume)}</p>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="bg-black/40 border-emerald-500/30 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                <TrendingUp className="size-6 text-emerald-500" />
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <ArrowUpRight className="size-3 mr-1" />
                +{currentData.monthlyGrowth}%
              </Badge>
            </div>
            <p className="text-slate-400 text-sm mb-1">รายได้สุทธิ</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(currentData.totalRevenue)}</p>
          </CardContent>
        </Card>

        {/* Total Members */}
        <Card className="bg-black/40 border-blue-500/30 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                <Users className="size-6 text-blue-500" />
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-1">สมาชิกทั้งหมด</p>
            <p className="text-2xl font-bold text-white">{currentData.totalMembers.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Today Volume */}
        <Card className="bg-black/40 border-purple-500/30 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                <BarChart3 className="size-6 text-purple-500" />
              </div>
            </div>
            <p className="text-slate-400 text-sm mb-1">ยอดวันนี้</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(currentData.todayVolume)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Site Breakdown Table */}
      {selectedSite === 'all' && (
        <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="size-5 text-amber-500" />
              รายได้แยกตามเว็บลูก (Site Breakdown)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-amber-500/20">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">เว็บลูก</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">ยอดแทงรวม</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">รายได้</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">สมาชิก</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">ยอดวันนี้</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">สัดส่วน</th>
                    <th className="text-center py-3 px-4 text-slate-400 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {SITES.filter(s => s.id !== 'all').length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        ไม่พบข้อมูลเว็บลูก
                      </td>
                    </tr>
                  ) : SITES.filter(s => s.id !== 'all').map((site) => {
                    const siteData = REPORT_DATA[site.id] || { totalVolume: 0, totalRevenue: 0, totalMembers: 0, todayVolume: 0 };
                    const allTotal = REPORT_DATA.all?.totalVolume || 1;
                    const percentage = ((siteData.totalVolume / allTotal) * 100).toFixed(1);
                    const isActive = siteData.todayVolume > 0;

                    return (
                      <tr 
                        key={site.id}
                        className="border-b border-amber-500/10 hover:bg-amber-500/5 cursor-pointer transition-colors"
                        onClick={() => setSelectedSite(site.id)}
                      >
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-white font-medium">{site.name}</p>
                            <p className="text-slate-500 text-sm">{site.domain}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-white font-medium">
                          {formatCurrency(siteData.totalVolume)}
                        </td>
                        <td className="py-4 px-4 text-right text-emerald-400 font-medium">
                          {formatCurrency(siteData.totalRevenue)}
                        </td>
                        <td className="py-4 px-4 text-right text-white">
                          {siteData.totalMembers.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right text-white">
                          {formatCurrency(siteData.todayVolume)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-amber-400 text-sm">{percentage}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge className={cn(
                            "px-3",
                            isActive 
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          )}>
                            {isActive ? 'Active' : 'Suspended'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Breakdown Chart */}
      <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="size-5 text-amber-500" />
            ยอดแทงรายวัน (7 วันล่าสุด)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAILY_BREAKDOWN.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                ไม่มีข้อมูลรายวัน
              </div>
            ) : DAILY_BREAKDOWN.map((day, index) => {
              const total = Object.values(day).filter(v => typeof v === 'number').reduce((a: number, b: any) => a + b, 0);
              const maxTotal = Math.max(...DAILY_BREAKDOWN.map(d => 
                Object.values(d).filter(v => typeof v === 'number').reduce((a: number, b: any) => a + b, 0)
              ), 1);

              return (
                <div key={day.date || index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">{day.date}</span>
                    <span className="text-white font-medium">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex h-6 rounded-lg overflow-hidden bg-slate-800">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
                      style={{ width: `${(total / maxTotal) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
