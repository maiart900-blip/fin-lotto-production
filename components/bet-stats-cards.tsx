'use client';

import { useBetSummary, formatAmount, getProfitLossColor } from '@/hooks/use-bet-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Activity, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ===== BET STATS CARD COMPONENT =====
// Component กลางสำหรับแสดงสถิติยอดแทง - ทุกหน้าต้องใช้ component นี้
// ห้ามสร้าง stats card เองในแต่ละหน้า

interface BetStatsCardsProps {
  showDebug?: boolean;
  compact?: boolean;
  className?: string;
}

export function BetStatsCards({ showDebug = false, compact = false, className }: BetStatsCardsProps) {
  const { data, isLoading, error, refresh } = useBetSummary({ debug: showDebug });

  if (isLoading) {
    return (
      <div className={cn("grid gap-4", compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4", className)}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card/50 animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-20 mb-2"></div>
              <div className="h-8 bg-muted rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn("bg-red-500/10 border-red-500/30", className)}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="size-5" />
            <span>ไม่สามารถโหลดข้อมูลได้</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refresh()}>
            <RefreshCw className="size-4 mr-1" /> ลองใหม่
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      title: 'ยอดแทงรวม',
      value: `฿${formatAmount(data.totalAmount)}`,
      subValue: `${data.totalCount} รายการ`,
      icon: Wallet,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'ยอดแทงวันนี้',
      value: `฿${formatAmount(data.todayAmount)}`,
      subValue: `${data.todayCount} รายการ`,
      icon: Activity,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'กำไร/ขาดทุน',
      value: `${data.profitLoss >= 0 ? '+' : ''}฿${formatAmount(data.profitLoss)}`,
      subValue: data.profitLoss >= 0 ? 'กำไร' : 'ขาดทุน',
      icon: data.profitLoss >= 0 ? TrendingUp : TrendingDown,
      color: getProfitLossColor(data.profitLoss),
      bgColor: data.profitLoss >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
    },
    {
      title: 'รอจ่ายรางวัล',
      value: `฿${formatAmount(data.pendingPayoutAmount)}`,
      subValue: 'รอดำเนินการ',
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn("grid gap-4", compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4")}>
        {stats.map((stat, index) => (
          <Card key={index} className={cn("border", stat.bgColor)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{stat.title}</span>
                <stat.icon className={cn("size-5", stat.color)} />
              </div>
              <div className={cn("text-2xl font-bold", stat.color)}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.subValue}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Debug Panel */}
      {showDebug && data.debug && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Debug Panel (ชั่วคราว)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-mono text-slate-300 space-y-1">
            <div>Tables: {data.debug.tablesUsed.join(', ')}</div>
            <div>Entries found: {data.debug.entriesFound}</div>
            <div>Bets found: {data.debug.betsFound}</div>
            <div>Today entries: {data.debug.todayEntriesFound}</div>
            <div>Today bets: {data.debug.todayBetsFound}</div>
            <div>Date filter: {data.debug.dateFilter}</div>
            <div>Status filter: {data.debug.statusFilter.join(', ')}</div>
            {data.debug.errors.length > 0 && (
              <div className="text-red-400">Errors: {data.debug.errors.join(', ')}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== COMPACT STATS BAR =====
// แถบสถิติแบบกะทัดรัด สำหรับใส่ด้านบนหน้า
export function BetStatsBar({ className }: { className?: string }) {
  const { data, isLoading } = useBetSummary();

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-4 p-2 bg-card/50 rounded-lg animate-pulse", className)}>
        <div className="h-4 bg-muted rounded w-32"></div>
        <div className="h-4 bg-muted rounded w-32"></div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-4 p-2 bg-card/50 rounded-lg text-sm", className)}>
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-blue-400" />
        <span className="text-muted-foreground">วันนี้:</span>
        <span className="font-bold text-blue-400">฿{formatAmount(data.todayAmount)}</span>
      </div>
      <div className="w-px h-4 bg-border"></div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">กำไร:</span>
        <span className={cn("font-bold", getProfitLossColor(data.profitLoss))}>
          {data.profitLoss >= 0 ? '+' : ''}฿{formatAmount(data.profitLoss)}
        </span>
      </div>
      <div className="w-px h-4 bg-border"></div>
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-amber-400" />
        <span className="text-muted-foreground">รอจ่าย:</span>
        <span className="font-bold text-amber-400">฿{formatAmount(data.pendingPayoutAmount)}</span>
      </div>
    </div>
  );
}
