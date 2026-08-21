'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Crown, Globe, Wallet, Shield, TrendingUp,
  AlertTriangle, Activity, Users, 
  ArrowUpRight, RefreshCw, Settings,
  Eye, Zap, Lock, BarChart3, PieChart, Building2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useBetSummary, formatAmount, formatAmountShort, getProfitLossColor } from '@/hooks/use-bet-summary';

const formatCurrency = (amount: number) => {
  if (amount >= 1000000000) {
    return `฿${(amount / 1000000000).toFixed(2)}B`;
  }
  if (amount >= 1000000) {
    return `฿${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `฿${(amount / 1000).toFixed(1)}K`;
  }
  return `฿${amount.toLocaleString()}`;
};

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

export default function BillionDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // ===== ใช้ useBetSummary() แทน fetch เอง =====
  const { data: betSummary, isLoading, error, refresh } = useBetSummary({
    debug: false,
    refreshInterval: 30000,
  });
  
  // Map data to stats format
  const stats = {
    totalVolume: betSummary.totalAmount,
    todayVolume: betSummary.todayAmount,
    totalProfit: betSummary.profitLoss,
    todayProfit: betSummary.todayAmount - (betSummary.totalPayoutAmount - betSummary.pendingPayoutAmount),
    totalSites: 0, // TODO: ดึงจาก sites table
    activeSites: 0,
    totalMembers: betSummary.totalCount,
    activeToday: betSummary.todayCount,
    totalAgents: 0, // TODO: ดึงจาก agents table
    totalCreditsIssued: 0,
    riskLevel: betSummary.profitLoss < -50000 ? 'high' : betSummary.profitLoss < 0 ? 'medium' : 'low',
    pendingPayouts: betSummary.pendingPayoutAmount,
    alerts: [] as string[],
    sites: [],
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-12 animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-amber-400">กำลังโหลดข้อมูล Dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="size-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <Button onClick={() => refresh()} className="bg-amber-500 text-black">
            <RefreshCw className="size-4 mr-2" />
            ลองใหม่
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/50 shadow-[0_0_40px_rgba(255,215,0,0.3)]">
              <Crown className="size-10 text-amber-400" />
            </div>
            <div className="absolute -top-1 -right-1 size-4 bg-green-500 rounded-full border-2 border-[#030712] animate-pulse" />
          </div>
          <div>
            <h1 
              className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
              style={{ textShadow: '0 0 40px rgba(255,215,0,0.4)' }}
            >
              BILLION DASHBOARD
            </h1>
            <p className="text-slate-400">Master Platform Control Center</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            อัปเดตล่าสุด: {lastUpdate.toLocaleTimeString('th-TH')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className={cn("size-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Infinity Credit Banner */}
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-amber-900/40 border border-amber-500/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-500/30">
              <Wallet className="size-8 text-white" />
            </div>
            <div>
              <p className="text-amber-400/70 text-sm font-medium">MASTER CREDIT LIMIT</p>
              <p 
                className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300"
                style={{ textShadow: '0 0 30px rgba(255,215,0,0.5)' }}
              >
                {stats.totalCreditsIssued > 0 ? formatCurrency(stats.totalCreditsIssued) : 'INFINITY'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <p className="text-slate-400 text-sm">Credits Issued to Network</p>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(stats.totalCreditsIssued)}</p>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Total Volume */}
        <div className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20 hover:border-amber-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
              <BarChart3 className="size-5 text-blue-400" />
            </div>
            {stats.totalVolume > 0 && (
              <Badge className="bg-green-500/20 text-green-400 text-xs">
                <ArrowUpRight className="size-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
          <p className="text-slate-400 text-xs mb-1">TOTAL VOLUME (ALL TIME)</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalVolume)}</p>
          <p className="text-xs text-slate-500 mt-1">Today: {formatCurrency(stats.todayVolume)}</p>
        </div>

        {/* Total Profit */}
        <div className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20 hover:border-amber-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
              <TrendingUp className="size-5 text-emerald-400" />
            </div>
            {stats.totalProfit > 0 && (
              <Badge className="bg-green-500/20 text-green-400 text-xs">
                <ArrowUpRight className="size-3 mr-1" />
                Profit
              </Badge>
            )}
          </div>
          <p className="text-slate-400 text-xs mb-1">TOTAL PROFIT</p>
          <p className={cn("text-2xl font-bold", stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
            {stats.totalProfit >= 0 ? '+' : ''}{formatCurrency(stats.totalProfit)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Today: {stats.todayProfit >= 0 ? '+' : ''}{formatCurrency(stats.todayProfit)}</p>
        </div>

        {/* Sites */}
        <div className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20 hover:border-amber-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30">
              <Globe className="size-5 text-purple-400" />
            </div>
            <Link href="/site-manager">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300">
                <Settings className="size-3 mr-1" />
                Manage
              </Button>
            </Link>
          </div>
          <p className="text-slate-400 text-xs mb-1">WHITE LABEL SITES</p>
          {stats.totalSites > 0 ? (
            <>
              <p className="text-2xl font-bold text-white">{stats.activeSites} <span className="text-slate-500 text-lg">/ {stats.totalSites}</span></p>
              <p className="text-xs text-green-400 mt-1">{stats.activeSites} Active</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-500">0</p>
              <p className="text-xs text-slate-500 mt-1">ยังไม่มีเว็บลูก</p>
            </>
          )}
        </div>

        {/* Members */}
        <div className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20 hover:border-amber-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
              <Users className="size-5 text-amber-400" />
            </div>
            {stats.activeToday > 0 && (
              <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                {formatNumber(stats.activeToday)} online
              </Badge>
            )}
          </div>
          <p className="text-slate-400 text-xs mb-1">TOTAL MEMBERS</p>
          <p className="text-2xl font-bold text-white">{formatNumber(stats.totalMembers)}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.totalMembers > 0 ? 'Across all sites' : 'ยังไม่มีสมาชิก'}</p>
        </div>
      </div>

      {/* Risk & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Risk Control */}
        <div className="p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30">
                <Shield className="size-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Risk Control</h3>
            </div>
            <Link href="/risk-control">
              <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300">
                <Eye className="size-4 mr-1" />
                View
              </Button>
            </Link>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">System Status</span>
              <Badge className={cn(
                stats.riskLevel === 'low' && "bg-green-500/20 text-green-400",
                stats.riskLevel === 'normal' && "bg-blue-500/20 text-blue-400",
                stats.riskLevel === 'high' && "bg-orange-500/20 text-orange-400",
                stats.riskLevel === 'critical' && "bg-red-500/20 text-red-400"
              )}>
                <Activity className="size-3 mr-1 animate-pulse" />
                {stats.riskLevel === 'low' ? 'Low' : stats.riskLevel === 'normal' ? 'Normal' : stats.riskLevel === 'high' ? 'High' : 'Critical'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Pending Payouts</span>
              <span className={cn("font-bold", stats.pendingPayouts > 0 ? "text-orange-400" : "text-slate-500")}>
                {formatCurrency(stats.pendingPayouts)}
              </span>
            </div>
            <div className="pt-3 border-t border-amber-500/20">
              <Link href="/risk-control">
                <Button className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white">
                  <AlertTriangle className="size-4 mr-2" />
                  Emergency Stop
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="size-5 text-amber-400" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/site-manager">
              <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <Globe className="size-5" />
                <span className="text-xs">Sites</span>
              </Button>
            </Link>
            <Link href="/financial-hub">
              <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <Wallet className="size-5" />
                <span className="text-xs">Finance</span>
              </Button>
            </Link>
            <Link href="/master-rates">
              <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <BarChart3 className="size-5" />
                <span className="text-xs">Rates</span>
              </Button>
            </Link>
            <Link href="/settlement">
              <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <PieChart className="size-5" />
                <span className="text-xs">Settlement</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-orange-400" />
              Recent Alerts
            </h3>
            <Link href="/audit-logs">
              <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 text-xs">
                View All
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {stats.alerts && stats.alerts.length > 0 ? (
              stats.alerts.map((alert: any) => (
                <div 
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    alert.type === 'critical' && "bg-red-500/10 border-red-500/30",
                    alert.type === 'warning' && "bg-orange-500/10 border-orange-500/30",
                    alert.type === 'info' && "bg-blue-500/10 border-blue-500/30"
                  )}
                >
                  <p className={cn(
                    "text-sm",
                    alert.type === 'critical' && "text-red-300",
                    alert.type === 'warning' && "text-orange-300",
                    alert.type === 'info' && "text-blue-300"
                  )}>
                    {alert.message}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{alert.time}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <AlertTriangle className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">ยังไม่มีการแจ้งเตือน</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sites Performance Table */}
      <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-amber-500/20 overflow-hidden">
        <div className="p-4 border-b border-amber-500/20 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="size-5 text-amber-400" />
            Sites Performance
          </h3>
          <Link href="/reports/omni-channel">
            <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300">
              Full Report
              <ArrowUpRight className="size-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          {stats.sites && stats.sites.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-amber-500/10">
                  <th className="text-left p-4 text-amber-400 font-medium text-sm">Site</th>
                  <th className="text-right p-4 text-amber-400 font-medium text-sm">Volume</th>
                  <th className="text-right p-4 text-amber-400 font-medium text-sm">Profit</th>
                  <th className="text-right p-4 text-amber-400 font-medium text-sm">Members</th>
                  <th className="text-center p-4 text-amber-400 font-medium text-sm">Status</th>
                  <th className="text-right p-4 text-amber-400 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.sites.map((site: any) => (
                  <tr key={site.id} className="border-b border-amber-500/5 hover:bg-amber-500/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                          <Globe className="size-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{site.name}</p>
                          <p className="text-xs text-slate-500">{site.domain}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-bold text-white">{formatCurrency(site.volume || 0)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-bold text-emerald-400">{formatCurrency(site.profit || 0)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="text-white">{formatNumber(site.members || 0)}</p>
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={cn(
                        site.status === 'active' && "bg-green-500/20 text-green-400",
                        site.status !== 'active' && "bg-orange-500/20 text-orange-400"
                      )}>
                        {site.status === 'active' ? 'Active' : site.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300">
                          <Settings className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          <Eye className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <Building2 className="size-12 mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 mb-2">ยังไม่มีเว็บลูกในระบบ</p>
              <p className="text-slate-500 text-sm mb-4">สร้างเว็บลูกใหม่เพื่อเริ่มต้นใช้งาน</p>
              <Link href="/site-manager">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold">
                  <Globe className="size-4 mr-2" />
                  ไปที่ Site Manager
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
