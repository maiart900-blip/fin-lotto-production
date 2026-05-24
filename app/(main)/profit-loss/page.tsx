'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Trophy,
  AlertTriangle,
  Download,
  Printer,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const PERIOD_OPTIONS = [
  { value: 'today', label: 'วันนี้' },
  { value: 'yesterday', label: 'เมื่อวาน' },
  { value: '7days', label: '7 วันล่าสุด' },
  { value: '30days', label: '30 วันล่าสุด' },
  { value: 'custom', label: 'กำหนดเอง' },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ProfitLossPage() {
  const [selectedLottery, setSelectedLottery] = useState<string>('all');
  const [period, setPeriod] = useState<string>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedLottery && selectedLottery !== 'all') {
      params.set('lottery_id', selectedLottery);
    }
    if (period !== 'custom') {
      params.set('period', period);
    } else {
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
    }
    return params.toString();
  }, [selectedLottery, period, startDate, endDate]);

  const { data, isLoading, error } = useSWR(
    `/api/profit-loss?${queryParams}`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds for realtime
  );

  const summary = data?.summary || {
    totalBets: 0,
    totalPayout: 0,
    netProfit: 0,
    isProfit: true,
    totalEntries: 0,
    totalCustomers: 0,
    bestLottery: null,
    worstLottery: null,
  };

  const lotteryStats = data?.lotteryStats || [];
  const dailyStats = data?.dailyStats || [];
  const lotteries = data?.lotteries || [];

  // Pie chart data
  const pieData = useMemo(() => {
    if (summary.totalBets === 0) return [];
    return [
      { name: 'กำไร', value: Math.max(0, summary.netProfit), color: '#22c55e' },
      { name: 'จ่ายรางวัล', value: summary.totalPayout, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [summary]);

  // Top profitable lotteries
  const topProfitable = useMemo(() => {
    return [...lotteryStats].filter(l => l.netProfit > 0).slice(0, 10);
  }, [lotteryStats]);

  // Top risky lotteries (negative profit)
  const topRisky = useMemo(() => {
    return [...lotteryStats].filter(l => l.netProfit < 0).sort((a, b) => a.netProfit - b.netProfit).slice(0, 10);
  }, [lotteryStats]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['ชื่อหวย', 'จำนวนโพย', 'ยอดแทงรวม', 'ยอดจ่าย', 'กำไรสุทธิ', 'สถานะ'];
    const rows = lotteryStats.map((l: any) => [
      l.name,
      l.entryCount,
      l.totalBets,
      l.totalPayout,
      l.netProfit,
      l.netProfit >= 0 ? 'กำไร' : 'ขาดทุน',
    ]);
    
    const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profit-loss-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="size-6 text-accent" />
            สรุปกำไร / ขาดทุนรวม
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            ดูผลรวมกำไร ขาดทุน ของทุกหวยทั้งหมด
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4 mr-1" />
            พิมพ์
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">ช่วงเวลา</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">หวย</Label>
              <Select value={selectedLottery} onValueChange={setSelectedLottery}>
                <SelectTrigger>
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {lotteries.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {period === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">วันที่เริ่มต้น</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">วันที่สิ้นสุด</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Bets */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">ยอดแทงรวม</p>
                    <p className="text-xl font-bold text-blue-600">
                      ฿{formatCurrency(summary.totalBets)}
                    </p>
                  </div>
                  <div className="size-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Banknote className="size-5 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Payout */}
            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">ยอดจ่ายรวม</p>
                    <p className="text-xl font-bold text-red-600">
                      ฿{formatCurrency(summary.totalPayout)}
                    </p>
                  </div>
                  <div className="size-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <DollarSign className="size-5 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className={`bg-gradient-to-br ${summary.isProfit ? 'from-green-500/10 to-green-600/5 border-green-500/20' : 'from-red-500/10 to-red-600/5 border-red-500/20'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {summary.isProfit ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}
                    </p>
                    <p className={`text-xl font-bold ${summary.isProfit ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.isProfit ? '+' : '-'}฿{formatCurrency(Math.abs(summary.netProfit))}
                    </p>
                  </div>
                  <div className={`size-10 rounded-full flex items-center justify-center ${summary.isProfit ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {summary.isProfit ? (
                      <TrendingUp className="size-5 text-green-500" />
                    ) : (
                      <TrendingDown className="size-5 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Entries */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">จำนวนโพย</p>
                    <p className="text-xl font-bold text-purple-600">
                      {summary.totalEntries.toLocaleString()}
                    </p>
                  </div>
                  <div className="size-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <FileText className="size-5 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second Row Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Customers */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">จำนวนลูกค้า</p>
                    <p className="text-xl font-bold">{summary.totalCustomers}</p>
                  </div>
                  <Users className="size-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Best Lottery */}
            <Card className="border-green-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">หวยกำไรสูงสุด</p>
                    {summary.bestLottery ? (
                      <>
                        <p className="text-sm font-medium truncate">{summary.bestLottery.name}</p>
                        <p className="text-green-600 text-xs">+฿{formatCurrency(summary.bestLottery.profit)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">-</p>
                    )}
                  </div>
                  <Trophy className="size-5 text-green-500" />
                </div>
              </CardContent>
            </Card>

            {/* Worst Lottery */}
            <Card className="border-red-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">หวยขาดทุนสูงสุด</p>
                    {summary.worstLottery ? (
                      <>
                        <p className="text-sm font-medium truncate">{summary.worstLottery.name}</p>
                        <p className="text-red-600 text-xs">-฿{formatCurrency(summary.worstLottery.loss)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">-</p>
                    )}
                  </div>
                  <AlertTriangle className="size-5 text-red-500" />
                </div>
              </CardContent>
            </Card>

            {/* Profit Margin */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">อัตรากำไร</p>
                    <p className={`text-xl font-bold ${summary.isProfit ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.totalBets > 0
                        ? `${((summary.netProfit / summary.totalBets) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                  <BarChart3 className="size-5 text-accent" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
            {/* Daily Profit Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  กำไร/ขาดทุน รายวัน
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailyStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => [`฿${formatCurrency(value)}`, '']}
                        labelFormatter={(d) => new Date(d).toLocaleDateString('th-TH')}
                      />
                      <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} name="กำไร" />
                      <Line type="monotone" dataKey="bets" stroke="#3b82f6" strokeWidth={2} name="ยอดแทง" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    ยังไม่มีข้อมูล
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="size-4" />
                  สัดส่วนกำไร/จ่ายรางวัล
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <RePieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `฿${formatCurrency(value)}`} />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    ยังไม่มีข้อมูล
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Profitable / Risky */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
            {/* Top Profitable */}
            <Card className="border-green-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-green-600">
                  <ArrowUpRight className="size-4" />
                  Top 10 หวยกำไรสูงสุด
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProfitable.length > 0 ? (
                  <div className="space-y-2">
                    {topProfitable.map((l: any, i) => (
                      <div key={l.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="size-6 rounded-full bg-green-500/20 text-green-600 text-xs flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{l.name}</span>
                        </div>
                        <span className="text-green-600 font-semibold">+฿{formatCurrency(l.netProfit)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">ยังไม่มีข้อมูล</p>
                )}
              </CardContent>
            </Card>

            {/* Top Risky */}
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-600">
                  <ArrowDownRight className="size-4" />
                  Top 10 หวยเสี่ยงแตก
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topRisky.length > 0 ? (
                  <div className="space-y-2">
                    {topRisky.map((l: any, i) => (
                      <div key={l.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="size-6 rounded-full bg-red-500/20 text-red-600 text-xs flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{l.name}</span>
                        </div>
                        <span className="text-red-600 font-semibold">-฿{formatCurrency(Math.abs(l.netProfit))}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">ยังไม่มีหวยขาดทุน</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lottery Stats Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-4" />
                สรุปแต่ละหวย
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lotteryStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>หวย</TableHead>
                        <TableHead className="text-right">จำนวนโพย</TableHead>
                        <TableHead className="text-right">ยอดแทง</TableHead>
                        <TableHead className="text-right">ยอดจ่าย</TableHead>
                        <TableHead className="text-right">กำไรสุทธิ</TableHead>
                        <TableHead className="text-center">สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lotteryStats.map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell className="text-right">{l.entryCount}</TableCell>
                          <TableCell className="text-right text-blue-600">฿{formatCurrency(l.totalBets)}</TableCell>
                          <TableCell className="text-right text-red-600">฿{formatCurrency(l.totalPayout)}</TableCell>
                          <TableCell className={`text-right font-semibold ${l.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {l.netProfit >= 0 ? '+' : '-'}฿{formatCurrency(Math.abs(l.netProfit))}
                          </TableCell>
                          <TableCell className="text-center">
                            {l.netProfit > 0 ? (
                              <Badge className="bg-green-500/20 text-green-600 border-green-500/30">กำไร</Badge>
                            ) : l.netProfit < 0 ? (
                              <Badge variant="destructive">ขาดทุน</Badge>
                            ) : (
                              <Badge variant="secondary">เสมอ</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">ยังไม่มีข้อมูล</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
