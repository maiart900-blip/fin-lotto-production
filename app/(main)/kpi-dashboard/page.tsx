'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  BarChart3,
  Trophy,
  Target,
  Crown,
  Medal,
  Award,
  Calendar,
  RefreshCw,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Wallet,
  Activity,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { th } from 'date-fns/locale';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Mock data สำหรับ demo
const mockKPIData = {
  summary: {
    dailyProfit: 125000,
    dailyProfitChange: 12.5,
    monthlyProfit: 3250000,
    monthlyProfitChange: 8.3,
    yearlyProfit: 38500000,
    yearlyProfitChange: 15.2,
    totalMembers: 1250,
    activeMembers: 890,
    totalAgents: 45,
    activeAgents: 38,
    avgTransactionValue: 1500,
    conversionRate: 68.5,
  },
  topAgents: [
    { rank: 1, id: 'A001', name: 'สายลม', sales: 2500000, commission: 75000, members: 150, growth: 15.2 },
    { rank: 2, id: 'A002', name: 'สายฝน', sales: 2100000, commission: 63000, members: 120, growth: 10.5 },
    { rank: 3, id: 'A003', name: 'สายฟ้า', sales: 1800000, commission: 54000, members: 95, growth: 8.3 },
    { rank: 4, id: 'A004', name: 'สายน้ำ', sales: 1500000, commission: 45000, members: 80, growth: 5.1 },
    { rank: 5, id: 'A005', name: 'สายดิน', sales: 1200000, commission: 36000, members: 65, growth: 3.8 },
  ],
  topMembers: [
    { rank: 1, id: 'M001', name: 'นายทอง', bets: 500000, wins: 125000, profit: -375000, agent: 'สายลม' },
    { rank: 2, id: 'M002', name: 'นางเงิน', bets: 450000, wins: 85000, profit: -365000, agent: 'สายฝน' },
    { rank: 3, id: 'M003', name: 'นายนาค', bets: 400000, wins: 320000, profit: -80000, agent: 'สายลม' },
    { rank: 4, id: 'M004', name: 'นางฟ้า', bets: 380000, wins: 95000, profit: -285000, agent: 'สายฟ้า' },
    { rank: 5, id: 'M005', name: 'นายเพชร', bets: 350000, wins: 420000, profit: 70000, agent: 'สายน้ำ' },
  ],
  topLotteries: [
    { rank: 1, name: 'หวยรัฐบาลไทย', sales: 5500000, profit: 550000, players: 850, profitRate: 10.0 },
    { rank: 2, name: 'หวยลาว', sales: 3200000, profit: 320000, players: 650, profitRate: 10.0 },
    { rank: 3, name: 'หวยฮานอย', sales: 2800000, profit: 252000, players: 520, profitRate: 9.0 },
    { rank: 4, name: 'หวยยี่กี', sales: 1500000, profit: 180000, players: 380, profitRate: 12.0 },
    { rank: 5, name: 'หวยหุ้นไทย', sales: 1200000, profit: 108000, players: 290, profitRate: 9.0 },
  ],
  riskySummary: {
    highRiskNumbers: 12,
    totalExposure: 2500000,
    maxExposure: 500000,
    avgExposure: 208333,
  },
  dailyTrend: [
    { date: '2024-01-20', profit: 95000, bets: 850000, members: 45 },
    { date: '2024-01-21', profit: 110000, bets: 920000, members: 52 },
    { date: '2024-01-22', profit: 85000, bets: 780000, members: 38 },
    { date: '2024-01-23', profit: 125000, bets: 1050000, members: 61 },
    { date: '2024-01-24', profit: 140000, bets: 1150000, members: 55 },
    { date: '2024-01-25', profit: 115000, bets: 980000, members: 48 },
    { date: '2024-01-26', profit: 125000, bets: 1020000, members: 58 },
  ],
};

export default function KPIDashboardPage() {
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [kpiData, setKpiData] = useState(mockKPIData);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black"><Crown className="size-3 mr-1" /> 1</Badge>;
      case 2:
        return <Badge className="bg-gradient-to-r from-gray-300 to-gray-400 text-black"><Medal className="size-3 mr-1" /> 2</Badge>;
      case 3:
        return <Badge className="bg-gradient-to-r from-amber-600 to-amber-700 text-white"><Award className="size-3 mr-1" /> 3</Badge>;
      default:
        return <Badge variant="outline">{rank}</Badge>;
    }
  };

  const handleExport = async () => {
    toast.success('กำลังส่งออกรายงาน KPI...');
    // TODO: Implement export
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="size-6 text-amber-500" />
            KPI Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            รายงานผลประกอบการและ KPI ของระบบ
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[140px] bg-[#1E293B] border-[#334155]">
              <SelectValue placeholder="เลือกช่วงเวลา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">รายวัน</SelectItem>
              <SelectItem value="monthly">รายเดือน</SelectItem>
              <SelectItem value="yearly">รายปี</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExport}>
            <Download className="size-4" />
            Export
          </Button>
          <Button variant="outline" size="icon" onClick={() => setIsLoading(true)}>
            <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400 flex items-center gap-2">
              <DollarSign className="size-4" />
              กำไรวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(kpiData.summary.dailyProfit)} <span className="text-sm font-normal text-muted-foreground">บาท</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {kpiData.summary.dailyProfitChange >= 0 ? (
                <ArrowUpRight className="size-4 text-emerald-400" />
              ) : (
                <ArrowDownRight className="size-4 text-red-400" />
              )}
              <span className={kpiData.summary.dailyProfitChange >= 0 ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>
                {kpiData.summary.dailyProfitChange}% จากเมื่อวาน
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
              <TrendingUp className="size-4" />
              กำไรเดือนนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(kpiData.summary.monthlyProfit)} <span className="text-sm font-normal text-muted-foreground">บาท</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {kpiData.summary.monthlyProfitChange >= 0 ? (
                <ArrowUpRight className="size-4 text-emerald-400" />
              ) : (
                <ArrowDownRight className="size-4 text-red-400" />
              )}
              <span className={kpiData.summary.monthlyProfitChange >= 0 ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>
                {kpiData.summary.monthlyProfitChange}% จากเดือนก่อน
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-400 flex items-center gap-2">
              <Users className="size-4" />
              สมาชิกใช้งาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(kpiData.summary.activeMembers)} <span className="text-sm font-normal text-muted-foreground">/ {kpiData.summary.totalMembers}</span>
            </div>
            <Progress 
              value={(kpiData.summary.activeMembers / kpiData.summary.totalMembers) * 100} 
              className="mt-2 h-2" 
            />
            <span className="text-xs text-muted-foreground">
              {((kpiData.summary.activeMembers / kpiData.summary.totalMembers) * 100).toFixed(1)}% Active Rate
            </span>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
              <Percent className="size-4" />
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {kpiData.summary.conversionRate}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ค่าเฉลี่ยต่อรายการ: {formatCurrency(kpiData.summary.avgTransactionValue)} บาท
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rankings Tabs */}
      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="bg-[#1E293B]">
          <TabsTrigger value="agents" className="gap-1">
            <Trophy className="size-4" />
            อันดับ Agent
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1">
            <Users className="size-4" />
            อันดับสมาชิก
          </TabsTrigger>
          <TabsTrigger value="lotteries" className="gap-1">
            <BarChart3 className="size-4" />
            อันดับหวย
          </TabsTrigger>
        </TabsList>

        {/* Top Agents */}
        <TabsContent value="agents">
          <Card className="bg-[#0F172A] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="size-5 text-amber-500" />
                อันดับ Agent ยอดขายสูงสุด
              </CardTitle>
              <CardDescription>
                ผลประกอบการ Agent ประจำ{period === 'daily' ? 'วันนี้' : period === 'monthly' ? 'เดือนนี้' : 'ปีนี้'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1E293B]">
                    <TableHead className="w-[80px]">อันดับ</TableHead>
                    <TableHead>รหัส/ชื่อ</TableHead>
                    <TableHead className="text-right">ยอดขาย</TableHead>
                    <TableHead className="text-right">ค่าคอม</TableHead>
                    <TableHead className="text-right">สมาชิก</TableHead>
                    <TableHead className="text-right">Growth</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiData.topAgents.map((agent) => (
                    <TableRow key={agent.id} className="border-[#1E293B]">
                      <TableCell>{getRankBadge(agent.rank)}</TableCell>
                      <TableCell>
                        <div className="font-medium text-white">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.id}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-400">
                        {formatCurrency(agent.sales)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-400">
                        {formatCurrency(agent.commission)}
                      </TableCell>
                      <TableCell className="text-right">{agent.members}</TableCell>
                      <TableCell className="text-right">
                        <span className={agent.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {agent.growth >= 0 ? '+' : ''}{agent.growth}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Members */}
        <TabsContent value="members">
          <Card className="bg-[#0F172A] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="size-5 text-blue-500" />
                อันดับสมาชิกยอดแทงสูงสุด
              </CardTitle>
              <CardDescription>
                สมาชิกที่มียอดแทงสูงสุดประจำ{period === 'daily' ? 'วันนี้' : period === 'monthly' ? 'เดือนนี้' : 'ปีนี้'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1E293B]">
                    <TableHead className="w-[80px]">อันดับ</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead className="text-right">ยอดแทง</TableHead>
                    <TableHead className="text-right">ยอดถูก</TableHead>
                    <TableHead className="text-right">กำไร/ขาดทุน</TableHead>
                    <TableHead>Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiData.topMembers.map((member) => (
                    <TableRow key={member.id} className="border-[#1E293B]">
                      <TableCell>{getRankBadge(member.rank)}</TableCell>
                      <TableCell>
                        <div className="font-medium text-white">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.id}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(member.bets)}
                      </TableCell>
                      <TableCell className="text-right text-amber-400">
                        {formatCurrency(member.wins)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={member.profit >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                          {member.profit >= 0 ? '-' : '+'}{formatCurrency(Math.abs(member.profit))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.agent}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Lotteries */}
        <TabsContent value="lotteries">
          <Card className="bg-[#0F172A] border-[#1E293B]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="size-5 text-purple-500" />
                อันดับหวยกำไรสูงสุด
              </CardTitle>
              <CardDescription>
                หวยที่ทำกำไรสูงสุดประจำ{period === 'daily' ? 'วันนี้' : period === 'monthly' ? 'เดือนนี้' : 'ปีนี้'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1E293B]">
                    <TableHead className="w-[80px]">อันดับ</TableHead>
                    <TableHead>ชื่อหวย</TableHead>
                    <TableHead className="text-right">ยอดขาย</TableHead>
                    <TableHead className="text-right">กำไร</TableHead>
                    <TableHead className="text-right">อัตรากำไร</TableHead>
                    <TableHead className="text-right">ผู้เล่น</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiData.topLotteries.map((lottery) => (
                    <TableRow key={lottery.name} className="border-[#1E293B]">
                      <TableCell>{getRankBadge(lottery.rank)}</TableCell>
                      <TableCell className="font-medium text-white">{lottery.name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(lottery.sales)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-400">
                        {formatCurrency(lottery.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-emerald-500/20 text-emerald-400">
                          {lottery.profitRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{lottery.players}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Risk Summary */}
      <Card className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-red-400">
            <Activity className="size-5" />
            สรุปความเสี่ยง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400">{kpiData.riskySummary.highRiskNumbers}</div>
              <div className="text-sm text-muted-foreground">เลขเสี่ยงสูง</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{formatCurrency(kpiData.riskySummary.totalExposure)}</div>
              <div className="text-sm text-muted-foreground">Exposure รวม</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">{formatCurrency(kpiData.riskySummary.maxExposure)}</div>
              <div className="text-sm text-muted-foreground">Exposure สูงสุด</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{formatCurrency(kpiData.riskySummary.avgExposure)}</div>
              <div className="text-sm text-muted-foreground">Exposure เฉลี่ย</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
