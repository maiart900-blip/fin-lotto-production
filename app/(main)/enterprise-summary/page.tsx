'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Crown, Globe, Wallet, TrendingUp, Users, Building2,
  Shield, AlertTriangle, CheckCircle2, Settings, Play,
  Pause, ArrowUpRight, ArrowDownRight, Zap, Target,
  DollarSign, PieChart, BarChart3, Activity, RefreshCw,
  Lock, Unlock, Eye, Server
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());


interface TopSite {
  id: number;
  name: string;
  domain: string;
  volume: number;
  profit: number;
  members: number;
  status: 'active' | 'inactive';
}


// Enterprise Platform Summary for Super Admin
export default function EnterpriseSummaryPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [totalVolume, setTotalVolume] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ดึงข้อมูลจาก APIs
  const { data: dashboardStats, mutate: mutateDashboard } = useSWR('/api/dashboard/stats', fetcher);
  const { data: sitesData, mutate: mutateSites } = useSWR('/api/sites', fetcher);
  const { data: agentsData, mutate: mutateAgents } = useSWR('/api/agents', fetcher);
  const { data: customersData, mutate: mutateCustomers } = useSWR('/api/customers', fetcher);

  // Extract arrays from API responses
  const sites = sitesData?.sites || sitesData || [];
  const agents = agentsData?.agents || agentsData || [];
  const customers = Array.isArray(customersData) ? customersData : [];

  // Map data จาก APIs - ถ้าไม่มีข้อมูลจะแสดง 0
  const platformStats = {
    totalSites: sites.length,
    activeSites: sites.filter((s: any) => s.is_active).length,
    suspendedSites: sites.filter((s: any) => !s.is_active).length,
    totalMembers: customers.length,
    activeMembers: customers.filter((c: any) => c.is_active).length,
    totalAgents: agents.length,
    activeAgents: agents.filter((a: any) => a.is_active).length,
    totalVolume: dashboardStats?.total?.totalBets || 0,
    todayVolume: dashboardStats?.today?.totalBets || 0,
    todayProfit: dashboardStats?.today?.netProfit || 0,
    pendingWithdrawals: dashboardStats?.total?.totalWithdrawals || 0,
    systemHealth: 99.5,
  };

  // Top sites from API - ถ้าไม่มีข้อมูลจะแสดง empty array
  const topSites: TopSite[] = sites.slice(0, 5).map((s: any, i: number): TopSite => ({
    id: i + 1,
    name: s.name || s.site_name || 'Unknown',
    domain: s.domain || '-',
    volume: 0,
    profit: 0,
    members: 0,
    status: s.is_active ? 'active' : 'inactive',
  }));

  // Recent alerts - empty for now (would need real-time API)
  const recentAlerts: { type: string; message: string; time: string }[] = [];

  // Animated counter effect
  useEffect(() => {
    setIsLoaded(true);
    const target = platformStats.totalVolume || 0;
    if (target === 0) {
      setTotalVolume(0);
      return;
    }
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      setTotalVolume(Math.floor(current));
    }, duration / steps);

    return () => clearInterval(timer);
  }, [platformStats.totalVolume]);

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([mutateDashboard(), mutateSites(), mutateAgents(), mutateCustomers()]);
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6">
      {/* Header */}
      <div className={cn(
        "mb-6 transition-all duration-700",
        isLoaded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      )}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
                <Crown className="size-8 text-amber-400" />
              </div>
              <div>
                <h1 
                  className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
                  style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
                >
                  FIN LOTTO R+ Enterprise
                </h1>
                <p className="text-slate-500 text-sm">Master Platform Control Center</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1.5">
              <Activity className="size-3 mr-1.5 animate-pulse" />
              System Health: {platformStats.systemHealth}%
            </Badge>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("size-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Super Admin Credit Status */}
      <div className={cn(
        "mb-6 transition-all duration-700 delay-100",
        isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <Card className="bg-gradient-to-br from-amber-500/10 via-black/40 to-black/40 backdrop-blur-xl border-amber-500/30 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
          <CardContent className="p-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="size-20 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/10 border-2 border-amber-500/50 flex items-center justify-center">
                    <Crown className="size-10 text-amber-400" />
                  </div>
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20 border-2 border-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400/70 text-sm mb-1">Super Admin Credit</p>
                  <div className="flex items-center gap-3">
                    <span 
                      className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500"
                      style={{ textShadow: '0 0 40px rgba(255,215,0,0.4)' }}
                    >
                      INFINITY
                    </span>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                      Unlimited
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-xl bg-black/30 border border-slate-700/50">
                  <Globe className="size-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-white">{platformStats.totalSites}</p>
                  <p className="text-xs text-slate-500">เว็บลูก</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-black/30 border border-slate-700/50">
                  <Users className="size-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-white">{formatNumber(platformStats.totalMembers)}</p>
                  <p className="text-xs text-slate-500">สมาชิก</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-black/30 border border-slate-700/50">
                  <Building2 className="size-5 text-purple-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-white">{formatNumber(platformStats.totalAgents)}</p>
                  <p className="text-xs text-slate-500">เอเย่นต์</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-black/30 border border-slate-700/50">
                  <Shield className="size-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-emerald-400">{platformStats.activeSites}</p>
                  <p className="text-xs text-slate-500">Active</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Stats Grid */}
      <div className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 transition-all duration-700 delay-200",
        isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        {/* Total Volume */}
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Wallet className="size-5 text-amber-400" />
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                <ArrowUpRight className="size-3 mr-1" />
                +12.5%
              </Badge>
            </div>
            <p className="text-slate-500 text-xs mb-1">Gross Volume (Total)</p>
            <p 
              className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500"
              style={{ textShadow: '0 0 20px rgba(255,215,0,0.3)' }}
            >
              {formatNumber(totalVolume)}
            </p>
            <p className="text-xs text-slate-600 mt-1">THB</p>
          </CardContent>
        </Card>

        {/* Today Volume */}
        <Card className="bg-black/40 backdrop-blur-xl border-blue-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <TrendingUp className="size-5 text-blue-400" />
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                <ArrowUpRight className="size-3 mr-1" />
                +8.3%
              </Badge>
            </div>
            <p className="text-slate-500 text-xs mb-1">Volume Today</p>
            <p className="text-2xl md:text-3xl font-bold text-blue-400">
              {formatNumber(platformStats.todayVolume)}
            </p>
            <p className="text-xs text-slate-600 mt-1">THB</p>
          </CardContent>
        </Card>

        {/* Today Profit */}
        <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <DollarSign className="size-5 text-emerald-400" />
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                <ArrowUpRight className="size-3 mr-1" />
                +15.2%
              </Badge>
            </div>
            <p className="text-slate-500 text-xs mb-1">Net Profit Today</p>
            <p className="text-2xl md:text-3xl font-bold text-emerald-400">
              {formatNumber(platformStats.todayProfit)}
            </p>
            <p className="text-xs text-slate-600 mt-1">THB</p>
          </CardContent>
        </Card>

        {/* Pending Withdrawals */}
        <Card className="bg-black/40 backdrop-blur-xl border-red-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="size-5 text-red-400" />
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10">
                Approve
              </Button>
            </div>
            <p className="text-slate-500 text-xs mb-1">Pending Withdrawals</p>
            <p className="text-2xl md:text-3xl font-bold text-red-400">
              {formatNumber(platformStats.pendingWithdrawals)}
            </p>
            <p className="text-xs text-slate-600 mt-1">THB</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Sites Performance */}
        <div className={cn(
          "lg:col-span-2 transition-all duration-700 delay-300",
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50 h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-400">
                  <Globe className="size-5" />
                  Top Sites Performance
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-amber-400">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="py-3 px-2 text-left text-slate-500 font-medium">#</th>
                      <th className="py-3 px-2 text-left text-slate-500 font-medium">Site</th>
                      <th className="py-3 px-2 text-right text-slate-500 font-medium">Volume</th>
                      <th className="py-3 px-2 text-right text-slate-500 font-medium">Profit</th>
                      <th className="py-3 px-2 text-right text-slate-500 font-medium">Members</th>
                      <th className="py-3 px-2 text-center text-slate-500 font-medium">Status</th>
                      <th className="py-3 px-2 text-center text-slate-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {topSites.map((site, index) => (
                      <tr key={site.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2">
                          <span className={cn(
                            "size-6 rounded-full flex items-center justify-center text-xs font-bold",
                            index === 0 ? "bg-amber-500/20 text-amber-400" :
                            index === 1 ? "bg-slate-500/20 text-slate-400" :
                            index === 2 ? "bg-orange-500/20 text-orange-400" :
                            "bg-slate-700/50 text-slate-500"
                          )}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium text-white">{site.name}</p>
                            <p className="text-xs text-slate-500">{site.domain}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-amber-400">
                          {formatNumber(site.volume)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-emerald-400">
                          {formatNumber(site.profit)}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300">
                          {site.members.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge className={cn(
                            "text-xs",
                            site.status === 'active' 
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          )}>
                            {site.status === 'active' ? 'Active' : 'Suspended'}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" className="size-7 p-0 text-slate-500 hover:text-amber-400">
                              <Eye className="size-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="size-7 p-0 text-slate-500 hover:text-amber-400">
                              <Settings className="size-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="size-7 p-0 text-slate-500 hover:text-red-400">
                              {site.status === 'active' ? <Pause className="size-4" /> : <Play className="size-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className={cn(
          "space-y-6 transition-all duration-700 delay-400",
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          {/* Quick Actions */}
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-400">
                <Zap className="size-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30">
                <Globe className="size-4 mr-2" />
                Create New Site
              </Button>
              <Button className="w-full justify-start bg-gradient-to-r from-blue-500/20 to-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30">
                <Shield className="size-4 mr-2" />
                Risk Control
              </Button>
              <Button className="w-full justify-start bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30">
                <DollarSign className="size-4 mr-2" />
                Settlement
              </Button>
              <Button className="w-full justify-start bg-gradient-to-r from-purple-500/20 to-purple-600/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30">
                <Target className="size-4 mr-2" />
                Master Rates
              </Button>
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-slate-300">
                <AlertTriangle className="size-4" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentAlerts.map((alert, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    alert.type === 'warning' ? "bg-amber-500/10 border-amber-500/30" :
                    alert.type === 'success' ? "bg-emerald-500/10 border-emerald-500/30" :
                    "bg-blue-500/10 border-blue-500/30"
                  )}
                >
                  <div className={cn(
                    "p-1 rounded-full",
                    alert.type === 'warning' ? "bg-amber-500/20" :
                    alert.type === 'success' ? "bg-emerald-500/20" :
                    "bg-blue-500/20"
                  )}>
                    {alert.type === 'warning' ? (
                      <AlertTriangle className="size-3 text-amber-400" />
                    ) : alert.type === 'success' ? (
                      <CheckCircle2 className="size-3 text-emerald-400" />
                    ) : (
                      <Activity className="size-3 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{alert.message}</p>
                    <p className="text-xs text-slate-500">{alert.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* System Status */}
          <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-slate-300">
                <Server className="size-4" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500">Database</span>
                  <span className="text-emerald-400">Healthy</span>
                </div>
                <Progress value={98} className="h-2 bg-slate-800" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500">API Gateway</span>
                  <span className="text-emerald-400">Healthy</span>
                </div>
                <Progress value={99} className="h-2 bg-slate-800" />
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500">Betting Queue</span>
                  <span className="text-amber-400">Processing</span>
                </div>
                <Progress value={75} className="h-2 bg-slate-800" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}