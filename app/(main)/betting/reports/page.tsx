'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Ticket,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Gamepad2,
  Dices,
  Trophy,
  Percent,
  Target,
  BarChart3,
  PieChart,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/fetcher';

interface ReportStats {
  totalBets: number;
  totalTurnover: number;
  totalWins: number;
  totalLoss: number;
  payoutRatio: string | number;
  byGameType: {
    lottery: { bets: number; turnover: number; wins: number };
    casino: { bets: number; turnover: number; wins: number };
    slots: { bets: number; turnover: number; wins: number };
    sports: { bets: number; turnover: number; wins: number };
  };
  topWinners: Array<{ id: string; name: string; wins: number }>;
  topLotteryTypes: Array<{ type: string; count: number; turnover: number }>;
}

const gameTypeLabels: Record<string, string> = {
  lottery: 'หวย',
  casino: 'คาสิโน',
  slots: 'สล็อต',
  sports: 'กีฬา',
};

const gameTypeIcons: Record<string, React.ReactNode> = {
  lottery: <Ticket className="size-5 text-amber-500" />,
  casino: <Dices className="size-5 text-purple-500" />,
  slots: <Gamepad2 className="size-5 text-pink-500" />,
  sports: <Trophy className="size-5 text-cyan-500" />,
};

export default function BettingReportsPage() {
  const [period, setPeriod] = useState<string>('today');
  const [reportType, setReportType] = useState<string>('summary');

  const { data, mutate, isLoading } = useSWR(
    `/api/betting/history?limit=1000`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const stats = data?.stats || {
    totalBets: 0,
    totalTurnover: 0,
    totalWins: 0,
    totalLoss: 0,
    payoutRatio: 0,
    byGameType: {
      lottery: 0,
      casino: 0,
      slots: 0,
      sports: 0,
    },
  };

  // Calculate derived stats
  const profitLoss = stats.totalTurnover - stats.totalWins;
  const profitMargin = stats.totalTurnover > 0 ? ((profitLoss / stats.totalTurnover) * 100).toFixed(2) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <BarChart3 className="size-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">รายงานการเดิมพัน</h1>
            <p className="text-muted-foreground">
              สรุปยอดแทง, ชนะ, แพ้, Turnover แยกตามประเภท
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="size-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">วันนี้</SelectItem>
              <SelectItem value="yesterday">เมื่อวาน</SelectItem>
              <SelectItem value="week">สัปดาห์นี้</SelectItem>
              <SelectItem value="month">เดือนนี้</SelectItem>
              <SelectItem value="year">ปีนี้</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('size-4 mr-2', isLoading && 'animate-spin')} />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm">
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Activity className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">รายการทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-500">
                  {stats.totalBets.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Target className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Turnover</p>
                <p className="text-2xl font-bold text-amber-500">
                  ฿{stats.totalTurnover.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <TrendingDown className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">จ่ายรางวัล</p>
                <p className="text-2xl font-bold text-red-500">
                  ฿{stats.totalWins.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">กำไร</p>
                <p className={cn(
                  'text-2xl font-bold',
                  profitLoss >= 0 ? 'text-emerald-500' : 'text-red-500'
                )}>
                  {profitLoss >= 0 ? '+' : ''}฿{profitLoss.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Percent className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profit Margin</p>
                <p className="text-2xl font-bold text-purple-500">
                  {profitMargin}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList>
          <TabsTrigger value="summary">ภาพรวม</TabsTrigger>
          <TabsTrigger value="by-game">แยกตามเกม</TabsTrigger>
          <TabsTrigger value="by-provider">แยกตาม Provider</TabsTrigger>
          <TabsTrigger value="by-tenant">แยกตาม Tenant</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Game Type Breakdown */}
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(gameTypeLabels).map(([key, label]) => {
              const count = stats.byGameType?.[key as keyof typeof stats.byGameType] || 0;
              return (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {gameTypeIcons[key]}
                      {label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">รายการ</span>
                        <span className="font-medium">{typeof count === 'number' ? count.toLocaleString() : 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">สัดส่วน</span>
                        <Badge variant="outline">
                          {stats.totalBets > 0 ? ((typeof count === 'number' ? count : 0) / stats.totalBets * 100).toFixed(1) : 0}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="size-5" />
                สรุปรายละเอียด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">ยอดแทงรวม</p>
                    <p className="text-xl font-bold">฿{stats.totalTurnover.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">จ่ายรางวัลรวม</p>
                    <p className="text-xl font-bold text-red-500">฿{stats.totalWins.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">กำไรสุทธิ</p>
                    <p className={cn('text-xl font-bold', profitLoss >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                      {profitLoss >= 0 ? '+' : ''}฿{profitLoss.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Payout Ratio</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.min(Number(stats.payoutRatio), 100)}%` }}
                        />
                      </div>
                      <span className="font-bold">{stats.payoutRatio}%</span>
                    </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Profit Margin</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            'h-full rounded-full',
                            Number(profitMargin) >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                          )}
                          style={{ width: `${Math.abs(Number(profitMargin))}%` }}
                        />
                      </div>
                      <span className="font-bold">{profitMargin}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-game">
          <Card>
            <CardHeader>
              <CardTitle>รายงานแยกตามประเภทเกม</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                รายงานละเอียดแยกตามประเภทเกม (หวย, คาสิโน, สล็อต, กีฬา)
                <br />
                <span className="text-sm">กรุณาเลือกช่วงเวลาและกดสร้างรายงาน</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-provider">
          <Card>
            <CardHeader>
              <CardTitle>รายงานแยกตาม Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                รายงานยอดแยกตาม Provider (ผู้ให้บริการเกม)
                <br />
                <span className="text-sm">แสดงยอด Turnover, Win, Loss ของแต่ละ Provider</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-tenant">
          <Card>
            <CardHeader>
              <CardTitle>รายงานแยกตาม Tenant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                รายงานยอดแยกตามเว็บลูก (Tenant)
                <br />
                <span className="text-sm">แสดงยอด Turnover, Win, Loss ของแต่ละเว็บลูก</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
