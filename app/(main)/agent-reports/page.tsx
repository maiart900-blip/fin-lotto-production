'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  PieChart,
  DollarSign,
  Users,
  Target,
  RefreshCw,
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentReportsPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mock data - ในระบบจริงจะดึงจาก API
  const incomeData = {
    today: { income: 15000, bets: 50000, wins: 35000, profit: 15000 },
    week: { income: 85000, bets: 350000, wins: 265000, profit: 85000 },
    month: { income: 350000, bets: 1500000, wins: 1150000, profit: 350000 },
    year: { income: 4200000, bets: 18000000, wins: 13800000, profit: 4200000 },
  };

  const currentData = incomeData[period];

  const dailyBreakdown = [
    { date: '2026-05-19', bets: 50000, wins: 35000, profit: 15000, members: 12 },
    { date: '2026-05-18', bets: 48000, wins: 33000, profit: 15000, members: 10 },
    { date: '2026-05-17', bets: 52000, wins: 38000, profit: 14000, members: 14 },
    { date: '2026-05-16', bets: 45000, wins: 32000, profit: 13000, members: 11 },
    { date: '2026-05-15', bets: 55000, wins: 40000, profit: 15000, members: 15 },
  ];

  const commissionHistory = [
    { id: 1, date: '2026-05-15', amount: 5000, status: 'completed', method: 'ธนาคาร' },
    { id: 2, date: '2026-05-01', amount: 8000, status: 'completed', method: 'ธนาคาร' },
    { id: 3, date: '2026-04-15', amount: 6500, status: 'completed', method: 'ธนาคาร' },
  ];

  const bettingStats = [
    { lottery: 'หวยรัฐบาล', bets: 250000, wins: 180000, profit: 70000, count: 150 },
    { lottery: 'หวยลาว', bets: 180000, wins: 140000, profit: 40000, count: 120 },
    { lottery: 'หวยฮานอย', bets: 150000, wins: 110000, profit: 40000, count: 100 },
    { lottery: 'หวยยี่กี', bets: 320000, wins: 250000, profit: 70000, count: 200 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37]">รายงานเอเย่น</h1>
          <p className="text-muted-foreground">
            รวมรายงานรายได้ กำไร/ขาดทุน คอมมิชชั่น และสถิติการแทง
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 size-4" />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 size-4" />
            ส่งออก Excel
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="income" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
          <TabsTrigger value="income" className="gap-2">
            <TrendingUp className="size-4" />
            <span className="hidden sm:inline">รายได้</span>
          </TabsTrigger>
          <TabsTrigger value="profit-loss" className="gap-2">
            <PieChart className="size-4" />
            <span className="hidden sm:inline">กำไร/ขาดทุน</span>
          </TabsTrigger>
          <TabsTrigger value="commission" className="gap-2">
            <DollarSign className="size-4" />
            <span className="hidden sm:inline">คอมมิชชั่น</span>
          </TabsTrigger>
          <TabsTrigger value="betting-stats" className="gap-2">
            <BarChart3 className="size-4" />
            <span className="hidden sm:inline">สถิติแทง</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: รายได้ */}
        <TabsContent value="income" className="space-y-4">
          {/* Period Filter */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex gap-2">
                  {(['today', 'week', 'month', 'year'] as const).map((p) => (
                    <Button
                      key={p}
                      variant={period === p ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPeriod(p)}
                    >
                      {p === 'today' && 'วันนี้'}
                      {p === 'week' && 'สัปดาห์'}
                      {p === 'month' && 'เดือน'}
                      {p === 'year' && 'ปี'}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                  <span>-</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">ยอดแทงรวม</p>
                    <p className="text-2xl font-bold">{currentData.bets.toLocaleString()}</p>
                  </div>
                  <Target className="size-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">ยอดถูกรางวัล</p>
                    <p className="text-2xl font-bold text-red-500">{currentData.wins.toLocaleString()}</p>
                  </div>
                  <TrendingDown className="size-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">กำไรสุทธิ</p>
                    <p className="text-2xl font-bold text-green-500">+{currentData.profit.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="size-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">รายได้ (คอมฯ)</p>
                    <p className="text-2xl font-bold text-[#D4AF37]">{currentData.income.toLocaleString()}</p>
                  </div>
                  <DollarSign className="size-8 text-[#D4AF37]" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>รายได้รายวัน</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">ยอดแทง</TableHead>
                    <TableHead className="text-right">ถูกรางวัล</TableHead>
                    <TableHead className="text-right">กำไร</TableHead>
                    <TableHead className="text-right">สมาชิก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyBreakdown.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right">{row.bets.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-500">{row.wins.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-500">+{row.profit.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.members}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: กำไร/ขาดทุน */}
        <TabsContent value="profit-loss" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">กำไรรวม</p>
                  <p className="text-3xl font-bold text-green-500">+{currentData.profit.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">ยอดแทงรวม</p>
                  <p className="text-3xl font-bold">{currentData.bets.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">จ่ายรางวัล</p>
                  <p className="text-3xl font-bold text-red-500">-{currentData.wins.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>สรุปกำไร/ขาดทุนตามหวย</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>หวย</TableHead>
                    <TableHead className="text-right">ยอดแทง</TableHead>
                    <TableHead className="text-right">จ่ายรางวัล</TableHead>
                    <TableHead className="text-right">กำไร/ขาดทุน</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bettingStats.map((stat) => (
                    <TableRow key={stat.lottery}>
                      <TableCell className="font-medium">{stat.lottery}</TableCell>
                      <TableCell className="text-right">{stat.bets.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-500">{stat.wins.toLocaleString()}</TableCell>
                      <TableCell className={`text-right ${stat.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {stat.profit >= 0 ? '+' : ''}{stat.profit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {((stat.profit / stat.bets) * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: คอมมิชชั่น */}
        <TabsContent value="commission" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">คอมมิชชั่นรวม</p>
                  <p className="text-3xl font-bold text-[#D4AF37]">25,500</p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">ถอนแล้ว</p>
                  <p className="text-3xl font-bold">19,500</p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">คงเหลือ</p>
                  <p className="text-3xl font-bold text-green-500">6,000</p>
                  <p className="text-xs text-muted-foreground">บาท</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>ประวัติถอนคอมมิชชั่น</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead>ช่องทาง</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionHistory.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right font-medium">{row.amount.toLocaleString()}</TableCell>
                      <TableCell>{row.method}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === 'completed' ? 'default' : 'secondary'}>
                          {row.status === 'completed' ? 'สำเร็จ' : 'รอดำเนินการ'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: สถิติการแทง */}
        <TabsContent value="betting-stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>สถิติการแทงตามประเภทหวย</CardTitle>
              <CardDescription>ยอดแทง จำนวนรายการ และผลกำไรแยกตามหวย</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ประเภทหวย</TableHead>
                    <TableHead className="text-right">จำนวนรายการ</TableHead>
                    <TableHead className="text-right">ยอดแทง</TableHead>
                    <TableHead className="text-right">ถูกรางวัล</TableHead>
                    <TableHead className="text-right">กำไร</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bettingStats.map((stat) => (
                    <TableRow key={stat.lottery}>
                      <TableCell className="font-medium">{stat.lottery}</TableCell>
                      <TableCell className="text-right">{stat.count}</TableCell>
                      <TableCell className="text-right">{stat.bets.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-500">{stat.wins.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-500">+{stat.profit.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>หวยยอดนิยม</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bettingStats
                    .sort((a, b) => b.bets - a.bets)
                    .map((stat, idx) => (
                      <div key={stat.lottery} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 items-center justify-center rounded-full bg-[#D4AF37]/20 text-sm font-bold text-[#D4AF37]">
                            {idx + 1}
                          </span>
                          <span>{stat.lottery}</span>
                        </div>
                        <span className="font-medium">{stat.bets.toLocaleString()} บาท</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>สรุปภาพรวม</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">รายการทั้งหมด</span>
                    <span className="font-bold">{bettingStats.reduce((sum, s) => sum + s.count, 0)} รายการ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ยอดแทงรวม</span>
                    <span className="font-bold">{bettingStats.reduce((sum, s) => sum + s.bets, 0).toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ถูกรางวัลรวม</span>
                    <span className="font-bold text-red-500">{bettingStats.reduce((sum, s) => sum + s.wins, 0).toLocaleString()} บาท</span>
                  </div>
                  <div className="flex justify-between border-t pt-4">
                    <span className="text-muted-foreground">กำไรสุทธิ</span>
                    <span className="font-bold text-green-500">+{bettingStats.reduce((sum, s) => sum + s.profit, 0).toLocaleString()} บาท</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
