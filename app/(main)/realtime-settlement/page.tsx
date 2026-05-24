'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, RefreshCw, Clock,
  DollarSign, AlertTriangle, CheckCircle,
  Activity, Zap, Globe, Crown, Wifi, WifiOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useGlobalRealtime } from '@/hooks/use-global-realtime';
import { Skeleton } from '@/components/ui/skeleton';

// Animated Counter Component
function AnimatedCounter({ 
  value, 
  prefix = '฿',
  duration = 1000,
  className 
}: { 
  value: number; 
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num);
  };

  return (
    <span className={className}>
      {prefix}{formatNumber(displayValue)}
    </span>
  );
}

export default function RealtimeSettlementPage() {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // Use real data from Supabase
  const { 
    stats, 
    tenantBreakdown, 
    activity, 
    isLoading, 
    isConnected, 
    refresh 
  } = useGlobalRealtime();

  // Update timestamp when data changes
  useEffect(() => {
    setLastUpdate(new Date());
  }, [stats, activity]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH').format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <TrendingUp className="size-4 text-emerald-400" />;
      case 'withdraw':
        return <TrendingDown className="size-4 text-red-400" />;
      case 'bet':
        return <DollarSign className="size-4 text-blue-400" />;
      case 'win':
        return <CheckCircle className="size-4 text-amber-400" />;
      default:
        return <Activity className="size-4 text-slate-400" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'text-emerald-400';
      case 'withdraw':
        return 'text-red-400';
      case 'bet':
        return 'text-blue-400';
      case 'win':
        return 'text-amber-400';
      default:
        return 'text-slate-400';
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'ฝากเงิน';
      case 'withdraw':
        return 'ถอนเงิน';
      case 'bet':
        return 'แทงหวย';
      case 'win':
        return 'ถูกรางวัล';
      default:
        return type;
    }
  };

  // Calculate total for progress
  const totalRevenue = tenantBreakdown.reduce((sum, t) => sum + t.bets, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 bg-slate-800" />
          <Skeleton className="h-8 w-32 bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            Real-time Settlement
          </h1>
          <p className="text-slate-400 mt-1">Cash Flow วินาทีต่อวินาที - ข้อมูลจาก Database จริง</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={cn(
            "animate-pulse",
            isConnected 
              ? "bg-emerald-500/20 text-emerald-400" 
              : "bg-red-500/20 text-red-400"
          )}>
            {isConnected ? (
              <>
                <Wifi className="size-3 mr-1" />
                CONNECTED
              </>
            ) : (
              <>
                <WifiOff className="size-3 mr-1" />
                OFFLINE
              </>
            )}
          </Badge>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Clock className="size-4" />
            <span>อัปเดตล่าสุด: {lastUpdate.toLocaleTimeString('th-TH')}</span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={() => refresh()}
          >
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Stats - Real-time Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Deposit */}
        <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 backdrop-blur-xl border-emerald-500/30 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-400/80 text-sm font-medium">ยอดฝากวันนี้</p>
                <AnimatedCounter 
                  value={stats.totalDeposits} 
                  className="text-3xl font-bold text-emerald-400"
                />
              </div>
              <div className="size-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="size-7 text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                <Activity className="size-3 mr-1" />
                Real-time from Database
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Withdrawal */}
        <Card className="bg-gradient-to-br from-red-900/40 to-red-950/60 backdrop-blur-xl border-red-500/30 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-400/80 text-sm font-medium">ยอดถอนวันนี้</p>
                <AnimatedCounter 
                  value={stats.totalWithdrawals} 
                  className="text-3xl font-bold text-red-400"
                />
              </div>
              <div className="size-14 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="size-7 text-red-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                <AlertTriangle className="size-3 mr-1" />
                Active Customers: {stats.activeCustomers}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="bg-gradient-to-br from-amber-900/40 to-amber-950/60 backdrop-blur-xl border-amber-500/30 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent" />
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-400/80 text-sm font-medium">กำไรสุทธิวันนี้</p>
                <AnimatedCounter 
                  value={stats.netProfit} 
                  className="text-3xl font-bold text-amber-400"
                />
              </div>
              <div className="size-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <Crown className="size-7 text-amber-400" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                <Zap className="size-3 mr-1" />
                ยอดแทง: ฿{formatCurrency(stats.totalBets)} | จ่าย: ฿{formatCurrency(stats.totalPayouts)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-black/40 backdrop-blur-xl border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-blue-400 flex items-center gap-2">
              <Activity className="size-5" />
              ยอดแทงวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedCounter 
              value={stats.totalBets} 
              className="text-4xl font-bold text-white"
            />
            <div className="mt-4 text-sm text-slate-400">
              จากทั้งหมด {stats.activeTenants} เว็บไซต์
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-purple-400 flex items-center gap-2">
              <DollarSign className="size-5" />
              ยอดจ่ายรางวัลวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedCounter 
              value={stats.totalPayouts} 
              className="text-4xl font-bold text-white"
            />
            <div className="mt-4 text-sm text-slate-400">
              อัตรากำไร: {stats.totalBets > 0 ? ((stats.netProfit / stats.totalBets) * 100).toFixed(1) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Site Breakdown */}
        <div className="lg:col-span-2">
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Globe className="size-5 text-amber-400" />
                รายได้แยกตามเว็บไซต์
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tenantBreakdown.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-amber-500/20 hover:bg-transparent">
                      <TableHead className="text-amber-400">เว็บไซต์</TableHead>
                      <TableHead className="text-amber-400 text-right">ฝาก</TableHead>
                      <TableHead className="text-amber-400 text-right">ถอน</TableHead>
                      <TableHead className="text-amber-400 text-right">ยอดแทง</TableHead>
                      <TableHead className="text-amber-400 text-right">กำไร</TableHead>
                      <TableHead className="text-amber-400">สัดส่วน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantBreakdown.map((site) => {
                      const sharePercent = totalRevenue > 0 ? (site.bets / totalRevenue) * 100 : 0;
                      return (
                        <TableRow key={site.id} className="border-amber-500/10 hover:bg-amber-500/5">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{site.name}</span>
                              {site.isActive && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">ACTIVE</Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{site.domain}</p>
                          </TableCell>
                          <TableCell className="text-right text-emerald-400 font-mono">
                            +฿{formatCurrency(site.deposits)}
                          </TableCell>
                          <TableCell className="text-right text-red-400 font-mono">
                            -฿{formatCurrency(site.withdrawals)}
                          </TableCell>
                          <TableCell className="text-right text-blue-400 font-mono">
                            ฿{formatCurrency(site.bets)}
                          </TableCell>
                          <TableCell className="text-right text-amber-400 font-mono font-bold">
                            ฿{formatCurrency(site.netProfit)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={sharePercent} className="h-2 w-20" />
                              <span className="text-slate-400 text-sm">{sharePercent.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Globe className="size-8 mx-auto mb-2 opacity-50" />
                  <p>ยังไม่มีข้อมูลเว็บไซต์</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Activity Feed */}
        <div>
          <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/20 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Activity className="size-5 text-emerald-400" />
                กิจกรรมล่าสุด
                <Badge className={cn(
                  "text-xs ml-auto",
                  isConnected 
                    ? "bg-emerald-500/20 text-emerald-400 animate-pulse" 
                    : "bg-slate-500/20 text-slate-400"
                )}>
                  {isConnected ? 'LIVE' : 'OFFLINE'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              <div className="space-y-2">
                {activity.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      {getActivityIcon(item.type)}
                      <div>
                        <p className="text-xs text-slate-400">{item.customerName}</p>
                        <p className={cn("text-sm font-medium", getActivityColor(item.type))}>
                          {getActivityLabel(item.type)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-mono font-bold", getActivityColor(item.type))}>
                        {item.type === 'withdraw' ? '-' : '+'}฿{formatCurrency(item.amount)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleTimeString('th-TH')}
                      </p>
                    </div>
                  </div>
                ))}
                {activity.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Activity className="size-8 mx-auto mb-2 opacity-50" />
                    <p>รอข้อมูลกิจกรรม...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
