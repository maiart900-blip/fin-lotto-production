'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Crown, TrendingUp, Users, Globe, DollarSign, Activity, 
  ArrowUpRight, ArrowDownRight, Zap, Shield, AlertTriangle,
  Play, Pause, RefreshCw, Settings, ExternalLink, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// =============================================================================
// ANIMATED COUNTER COMPONENT
// =============================================================================

function AnimatedCounter({ 
  value, 
  prefix = '', 
  suffix = '',
  duration = 2000,
  className = ''
}: { 
  value: number; 
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (endValue - startValue) * easeOut;
      setDisplayValue(Math.floor(currentValue));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('th-TH');
  };

  return (
    <span className={className}>
      {prefix}{formatNumber(displayValue)}{suffix}
    </span>
  );
}

// =============================================================================
// LIVE PULSE INDICATOR
// =============================================================================

function LivePulse({ isActive = true }: { isActive?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={cn(
          "size-3 rounded-full",
          isActive ? "bg-emerald-500" : "bg-red-500"
        )} />
        {isActive && (
          <div className="absolute inset-0 size-3 rounded-full bg-emerald-500 animate-ping" />
        )}
      </div>
      <span className={cn(
        "text-xs font-medium",
        isActive ? "text-emerald-400" : "text-red-400"
      )}>
        {isActive ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  );
}

// =============================================================================
// MAIN VIP DASHBOARD
// =============================================================================

export default function VIPDashboardPage() {
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulated real-time data
  const [stats, setStats] = useState({
    totalVolume: 2847500000, // 2.8 Billion
    todayVolume: 125800000,
    totalProfit: 427125000,
    todayProfit: 18870000,
    totalMembers: 49270,
    activeUsers: 4032,
    totalSites: 12,
    activeSites: 10,
    betsPerSecond: 847,
    transactionsToday: 285400,
  });

  // Site breakdown data
  const [sites, setSites] = useState([
    { id: 1, name: 'Lucky Lotto 888', volume: 520000000, profit: 78000000, users: 1250, status: 'active' },
    { id: 2, name: 'Thai Lotto King', volume: 680000000, profit: 102000000, users: 2100, status: 'active' },
    { id: 3, name: 'Super Huay Pro', volume: 380000000, profit: 57000000, users: 680, status: 'active' },
    { id: 4, name: 'Mega Jackpot', volume: 450000000, profit: 67500000, users: 890, status: 'active' },
    { id: 5, name: 'VIP Lotto Club', volume: 290000000, profit: 43500000, users: 520, status: 'warning' },
  ]);

  // Real-time activity feed
  const [activityFeed, setActivityFeed] = useState([
    { id: 1, type: 'bet', site: 'Lucky Lotto 888', amount: 5000, time: '2 วินาทีที่แล้ว' },
    { id: 2, type: 'deposit', site: 'Thai Lotto King', amount: 50000, time: '5 วินาทีที่แล้ว' },
    { id: 3, type: 'win', site: 'Super Huay Pro', amount: 120000, time: '8 วินาทีที่แล้ว' },
    { id: 4, type: 'bet', site: 'Mega Jackpot', amount: 2000, time: '12 วินาทีที่แล้ว' },
    { id: 5, type: 'withdraw', site: 'VIP Lotto Club', amount: 30000, time: '15 วินาทีที่แล้ว' },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        totalVolume: prev.totalVolume + Math.floor(Math.random() * 50000),
        todayVolume: prev.todayVolume + Math.floor(Math.random() * 20000),
        totalProfit: prev.totalProfit + Math.floor(Math.random() * 7500),
        todayProfit: prev.todayProfit + Math.floor(Math.random() * 3000),
        betsPerSecond: 800 + Math.floor(Math.random() * 200),
        activeUsers: 3900 + Math.floor(Math.random() * 300),
        transactionsToday: prev.transactionsToday + Math.floor(Math.random() * 10),
      }));
      setLastUpdate(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive]);

  const formatBigNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-[0_0_30px_rgba(255,215,0,0.3)]">
            <Crown className="size-8 text-black" />
          </div>
          <div>
            <h1 
              className="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
              style={{ textShadow: '0 0 40px rgba(255,215,0,0.4)' }}
            >
              VIP Master Dashboard
            </h1>
            <p className="text-slate-400 text-sm">
              FIN LOTTO R+ Empire Control Center | อัปเดตล่าสุด: {lastUpdate.toLocaleTimeString('th-TH')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LivePulse isActive={isLive} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className={cn(
              "border-amber-500/30",
              isLive ? "text-amber-400" : "text-slate-400"
            )}
          >
            {isLive ? <Pause className="size-4 mr-2" /> : <Play className="size-4 mr-2" />}
            {isLive ? 'หยุด' : 'เริ่ม'}
          </Button>
          <Button variant="outline" size="sm" className="border-amber-500/30 text-amber-400">
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Stats - Empire Total */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-black/60 via-amber-950/20 to-black/60 backdrop-blur-xl p-6 md:p-8">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,215,0,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,215,0,0.05),transparent_50%)]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold px-3">
              INFINITY CREDIT
            </Badge>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400">
              SUPER ADMIN
            </Badge>
          </div>

          <div className="text-center mb-8">
            <p className="text-slate-400 mb-2">ยอดรวมทั้งอาณาจักร (Total Empire Volume)</p>
            <div 
              className="text-5xl md:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200"
              style={{ 
                textShadow: '0 0 60px rgba(255,215,0,0.5)',
                fontFamily: 'monospace'
              }}
            >
              <AnimatedCounter 
                value={stats.totalVolume} 
                prefix="฿" 
                duration={500}
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-4">
              <ArrowUpRight className="size-5 text-emerald-400" />
              <span className="text-emerald-400 font-bold">
                +฿{formatBigNumber(stats.todayVolume)} วันนี้
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-amber-400">
                {stats.betsPerSecond} bets/sec
              </span>
            </div>
          </div>

          {/* Sub Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="size-4 text-emerald-400" />
                <span className="text-xs text-slate-400">กำไรสุทธิรวม</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                ฿<AnimatedCounter value={stats.totalProfit} duration={500} />
              </p>
              <p className="text-xs text-emerald-400/70">+฿{formatBigNumber(stats.todayProfit)} วันนี้</p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="size-4 text-blue-400" />
                <span className="text-xs text-slate-400">สมาชิกทั้งหมด</span>
              </div>
              <p className="text-2xl font-bold text-white">
                <AnimatedCounter value={stats.totalMembers} duration={500} />
              </p>
              <p className="text-xs text-blue-400">{stats.activeUsers.toLocaleString()} online</p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="size-4 text-purple-400" />
                <span className="text-xs text-slate-400">เว็บลูกในเครือ</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalSites}</p>
              <p className="text-xs text-emerald-400">{stats.activeSites} active</p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="size-4 text-amber-400" />
                <span className="text-xs text-slate-400">Transactions วันนี้</span>
              </div>
              <p className="text-2xl font-bold text-white">
                <AnimatedCounter value={stats.transactionsToday} duration={500} />
              </p>
              <p className="text-xs text-amber-400">{stats.betsPerSecond}/sec</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sites Performance - 2 columns */}
        <div className="lg:col-span-2">
          <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <Globe className="size-5" />
                ผลประกอบการเว็บลูก
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-amber-400">
                ดูทั้งหมด <ChevronRight className="size-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sites.map((site, index) => (
                <div 
                  key={site.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-black/40 border border-amber-500/10 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex items-center justify-center size-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 font-bold text-amber-400">
                    #{index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-white truncate">{site.name}</p>
                      {site.status === 'warning' && (
                        <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{site.users.toLocaleString()} users</span>
                      <span className="text-emerald-400">
                        +฿{formatBigNumber(site.profit)} profit
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-white">฿{formatBigNumber(site.volume)}</p>
                    <p className="text-xs text-slate-400">volume</p>
                  </div>

                  <Button variant="ghost" size="icon" className="shrink-0 text-slate-400 hover:text-amber-400">
                    <ExternalLink className="size-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed - 1 column */}
        <div>
          <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <Activity className="size-5" />
                Live Activity
              </CardTitle>
              <LivePulse isActive={isLive} />
            </CardHeader>
            <CardContent className="space-y-3">
              {activityFeed.map((activity) => (
                <div 
                  key={activity.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    activity.type === 'bet' && "bg-blue-500/5 border-blue-500/20",
                    activity.type === 'deposit' && "bg-emerald-500/5 border-emerald-500/20",
                    activity.type === 'withdraw' && "bg-amber-500/5 border-amber-500/20",
                    activity.type === 'win' && "bg-purple-500/5 border-purple-500/20"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg",
                    activity.type === 'bet' && "bg-blue-500/20",
                    activity.type === 'deposit' && "bg-emerald-500/20",
                    activity.type === 'withdraw' && "bg-amber-500/20",
                    activity.type === 'win' && "bg-purple-500/20"
                  )}>
                    {activity.type === 'bet' && <Zap className="size-4 text-blue-400" />}
                    {activity.type === 'deposit' && <ArrowUpRight className="size-4 text-emerald-400" />}
                    {activity.type === 'withdraw' && <ArrowDownRight className="size-4 text-amber-400" />}
                    {activity.type === 'win' && <Crown className="size-4 text-purple-400" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {activity.type === 'bet' && 'แทงหวย'}
                      {activity.type === 'deposit' && 'เติมเงิน'}
                      {activity.type === 'withdraw' && 'ถอนเงิน'}
                      {activity.type === 'win' && 'ถูกรางวัล'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{activity.site}</p>
                  </div>

                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-bold",
                      activity.type === 'win' && "text-purple-400",
                      activity.type === 'deposit' && "text-emerald-400",
                      activity.type === 'withdraw' && "text-amber-400",
                      activity.type === 'bet' && "text-blue-400"
                    )}>
                      ฿{activity.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button 
          className="h-auto p-4 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 hover:border-amber-400 text-left flex flex-col items-start gap-2"
          variant="ghost"
        >
          <Globe className="size-6 text-amber-400" />
          <div>
            <p className="font-medium text-white">Site Manager</p>
            <p className="text-xs text-slate-400">จัดการเว็บลูก</p>
          </div>
        </Button>

        <Button 
          className="h-auto p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 hover:border-emerald-400 text-left flex flex-col items-start gap-2"
          variant="ghost"
        >
          <DollarSign className="size-6 text-emerald-400" />
          <div>
            <p className="font-medium text-white">Financial Hub</p>
            <p className="text-xs text-slate-400">ศูนย์การเงิน</p>
          </div>
        </Button>

        <Button 
          className="h-auto p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 hover:border-blue-400 text-left flex flex-col items-start gap-2"
          variant="ghost"
        >
          <Shield className="size-6 text-blue-400" />
          <div>
            <p className="font-medium text-white">Risk Control</p>
            <p className="text-xs text-slate-400">ควบคุมความเสี่ยง</p>
          </div>
        </Button>

        <Button 
          className="h-auto p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 hover:border-purple-400 text-left flex flex-col items-start gap-2"
          variant="ghost"
        >
          <TrendingUp className="size-6 text-purple-400" />
          <div>
            <p className="font-medium text-white">Reports</p>
            <p className="text-xs text-slate-400">รายงานทั้งหมด</p>
          </div>
        </Button>
      </div>

      {/* Target Progress */}
      <Card className="bg-black/40 border-amber-500/30 backdrop-blur-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-slate-400 text-sm">เป้าหมาย 1,000 ล้าน (1 Billion Target)</p>
              <p className="text-3xl font-bold text-amber-400">
                {((stats.totalVolume / 1000000000) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-sm">คงเหลือ</p>
              <p className="text-xl font-bold text-white">
                ฿{formatBigNumber(Math.max(0, 1000000000 - stats.totalVolume))}
              </p>
            </div>
          </div>
          
          <div className="relative h-4 rounded-full bg-black/40 overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (stats.totalVolume / 1000000000) * 100)}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          </div>
          
          {stats.totalVolume >= 1000000000 && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-center">
              <Crown className="size-8 text-amber-400 mx-auto mb-2" />
              <p className="text-amber-400 font-bold text-lg">
                BILLION ACHIEVED! CONGRATULATIONS!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
