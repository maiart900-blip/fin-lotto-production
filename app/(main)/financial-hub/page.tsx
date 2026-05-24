'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Crown, TrendingUp, TrendingDown, Wallet, Building2, 
  DollarSign, ArrowUpRight, ArrowDownRight, Globe,
  Calendar, Download, Filter, RefreshCw, Eye, PieChart,
  BarChart3, Activity, Banknote, CreditCard, CircleDollarSign,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Format number with Thai style
const formatCurrency = (amount: number, showSign = false) => {
  const formatted = new Intl.NumberFormat('th-TH').format(Math.abs(amount));
  if (showSign && amount > 0) return '+' + formatted;
  if (amount < 0) return '-' + formatted;
  return formatted;
};

const formatShort = (amount: number) => {
  if (amount >= 1000000000) return (amount / 1000000000).toFixed(2) + 'B';
  if (amount >= 1000000) return (amount / 1000000).toFixed(2) + 'M';
  if (amount >= 1000) return (amount / 1000).toFixed(1) + 'K';
  return amount.toString();
};

export default function FinancialHubPage() {
  const [period, setPeriod] = useState('today');
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  // Fetch real data from API
  const { data: dashboardData, error, isLoading, mutate } = useSWR('/api/master-dashboard', fetcher, {
    refreshInterval: 30000,
  });

  // Fetch sites data
  const { data: sitesData, error: sitesError } = useSWR('/api/sites', fetcher, {
    refreshInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]">
        <Loader2 className="size-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // Handle unauthorized error
  if (error || dashboardData?.code === 'UNAUTHORIZED' || dashboardData?.error === 'Unauthorized') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]">
        <Card className="bg-red-900/20 border-red-500/30 p-8 max-w-md">
          <div className="text-center">
            <Crown className="size-12 mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
            <p className="text-slate-400 mb-4">
              หน้านี้สำหรับ Super Admin เท่านั้น
              <br />
              กรุณาเข้าสู่ระบบด้วยบัญชี Super Admin
            </p>
            <Button 
              variant="outline" 
              className="border-red-500/30 text-red-400"
              onClick={() => window.location.href = '/login'}
            >
              เข้าสู่ระบบใหม่
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Use real data or defaults
  const stats = dashboardData || {
    totalRevenue: 0,
    totalBets: 0,
    totalPayouts: 0,
    totalAgents: 0,
    totalCustomers: 0,
    todayRevenue: 0,
    todayBets: 0,
    todayPayouts: 0,
    netProfit: 0,
    pendingPayouts: 0,
    totalSites: 0,
  };

  const sites = sitesData?.sites || [];
  const totalMembers = stats.totalCustomers + stats.totalAgents;
  const todayGrowth = stats.yesterdayBets > 0 
    ? ((stats.todayBets - stats.yesterdayBets) / stats.yesterdayBets) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 flex items-center gap-3"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            <Crown className="size-8 text-amber-400" />
            Financial Hub
          </h1>
          <p className="text-slate-400 mt-1">ศูนย์กลางการเงิน - Real-time Dashboard</p>
        </div>
        
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px] bg-black/40 border-amber-500/30">
              <Calendar className="size-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
              <SelectItem value="today">วันนี้</SelectItem>
              <SelectItem value="yesterday">เมื่อวาน</SelectItem>
              <SelectItem value="week">7 วัน</SelectItem>
              <SelectItem value="month">30 วัน</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" className="border-amber-500/30 text-amber-400" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline" className="border-slate-600">
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Central Wallet - Master View */}
      <Card className="bg-gradient-to-br from-amber-900/30 via-amber-800/20 to-amber-900/30 border-amber-500/40 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-yellow-500/5 to-amber-500/5" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        
        <CardContent className="p-8 relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-amber-400/80 text-sm font-medium flex items-center gap-2">
                <Wallet className="size-4" />
                CENTRAL WALLET (MASTER)
              </p>
              <div className="flex items-baseline gap-3 mt-2">
                <span 
                  className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300"
                  style={{ textShadow: '0 0 40px rgba(255,215,0,0.4)' }}
                >
                  {formatShort(stats.totalRevenue)}
                </span>
                <span className="text-amber-400/60 text-2xl">THB</span>
              </div>
              <p className="text-slate-400 text-sm mt-1">
                = {formatCurrency(stats.totalRevenue)} บาท
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-black/40 border border-amber-500/20">
                <p className="text-xs text-slate-400">เว็บลูกทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{stats.totalSites || sites.length || 1}</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-black/40 border border-blue-500/20">
                <p className="text-xs text-slate-400">สมาชิกรวม</p>
                <p className="text-2xl font-bold text-blue-400">{formatShort(totalMembers)}</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-black/40 border border-emerald-500/20">
                <p className="text-xs text-slate-400">กำไรสุทธิ</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {stats.netProfit >= 0 ? '+' : ''}{formatShort(stats.netProfit)}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-black/40 border border-purple-500/20">
                <p className="text-xs text-slate-400">ยอดเดิมพันวันนี้</p>
                <p className="text-2xl font-bold text-purple-400">{formatShort(stats.todayBets)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flow Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-emerald-500/30 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">ยอดเดิมพันวันนี้</p>
                <p className="text-2xl font-bold text-emerald-400">{formatShort(stats.todayBets)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {todayGrowth >= 0 ? (
                    <ArrowUpRight className="size-3 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="size-3 text-red-400" />
                  )}
                  <span className={cn(
                    "text-xs",
                    todayGrowth >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {todayGrowth >= 0 ? '+' : ''}{todayGrowth.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="size-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Activity className="size-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-blue-500/30 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">ยอดเดิมพันทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-400">{formatShort(stats.totalBets)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  = {formatCurrency(stats.totalBets)} บาท
                </p>
              </div>
              <div className="size-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <BarChart3 className="size-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">กำไรสุทธิ</p>
                <p className={cn(
                  "text-2xl font-bold",
                  stats.netProfit >= 0 ? "text-amber-400" : "text-red-400"
                )}>
                  {stats.netProfit >= 0 ? '+' : ''}{formatShort(stats.netProfit)}
                </p>
                <p className="text-xs text-emerald-400 mt-1">
                  Margin {stats.totalBets > 0 ? ((stats.netProfit / stats.totalBets) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="size-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <TrendingUp className="size-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-orange-500/30 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">จ่ายรางวัลแล้ว</p>
                <p className="text-2xl font-bold text-orange-400">{formatShort(stats.totalPayouts)}</p>
                {stats.pendingPayouts > 0 && (
                  <Badge className="mt-1 text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                    รอจ่าย: {formatShort(stats.pendingPayouts)}
                  </Badge>
                )}
              </div>
              <div className="size-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Banknote className="size-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sites List (if available) */}
      {sites.length > 0 && (
        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <Globe className="size-5" />
              เว็บไซต์ในระบบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sites.map((site: any) => (
                <div 
                  key={site.id}
                  className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-amber-500/30 transition-all cursor-pointer"
                  onClick={() => setSelectedSite(site.id === selectedSite ? null : site.id)}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="size-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg flex-shrink-0"
                      style={{ 
                        background: `linear-gradient(135deg, ${site.theme_color || '#3B82F6'}, ${site.theme_color || '#3B82F6'}99)`,
                        boxShadow: `0 0 20px ${site.theme_color || '#3B82F6'}40`
                      }}
                    >
                      {site.name?.substring(0, 2) || 'ST'}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-white">{site.name}</h3>
                        <Badge className={cn(
                          "text-xs",
                          site.is_active 
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        )}>
                          {site.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-400">{site.domain || 'No domain'}</p>
                    </div>
                    
                    <div className="hidden md:grid grid-cols-3 gap-6 text-right">
                      <div>
                        <p className="text-xs text-slate-400">ลูกค้า</p>
                        <p className="font-bold text-white">{site.customer_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">เอเย่นต์</p>
                        <p className="font-bold text-blue-400">{site.agent_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">สถานะ</p>
                        <p className="font-bold text-emerald-400">{site.is_active ? 'Online' : 'Offline'}</p>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-amber-400 flex-shrink-0">
                      <Eye className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 border-emerald-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="size-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">เอเย่นต์ทั้งหมด</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.totalAgents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <CreditCard className="size-7 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">ลูกค้าทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-400">{stats.totalCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <PieChart className="size-7 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">หวยทั้งหมด</p>
                <p className="text-2xl font-bold text-purple-400">{stats.totalLotteries || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
