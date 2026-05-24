'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, 
  Download, RefreshCw, Target, AlertTriangle 
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ManualKeyReportPage() {
  const [reportType, setReportType] = useState<string>('sales');
  const [dateRange, setDateRange] = useState<string>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, mutate } = useSWR<{ 
    summary: any, 
    chartData: any[], 
    topAgents: any[], 
    topNumbers: any[],
    riskNumbers: any[]
  }>(
    `/api/manual-key-agents/report?type=${reportType}&range=${dateRange}&start=${startDate}&end=${endDate}`,
    fetcher
  );

  const summary = data?.summary || { totalSales: 0, totalProfit: 0, totalLoss: 0, netProfit: 0, winRate: 0 };
  const chartData = data?.chartData || [];
  const topAgents = data?.topAgents || [];
  const topNumbers = data?.topNumbers || [];
  const riskNumbers = data?.riskNumbers || [];

  const formatNumber = (num: number) => new Intl.NumberFormat('th-TH').format(num);

  const handleExport = () => {
    toast.success('กำลังส่งออกรายงาน...');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent flex items-center gap-2">
            <BarChart3 className="size-6" />
            รายงาน (คีย์หวย)
          </h1>
          <p className="text-muted-foreground">รายงานยอดแทง กำไร/ขาดทุน และสถิติต่างๆ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4 mr-2" />
            ส่งออก
          </Button>
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="ช่วงเวลา" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">วันนี้</SelectItem>
                <SelectItem value="yesterday">เมื่อวาน</SelectItem>
                <SelectItem value="week">สัปดาห์นี้</SelectItem>
                <SelectItem value="month">เดือนนี้</SelectItem>
                <SelectItem value="year">ปีนี้</SelectItem>
                <SelectItem value="custom">กำหนดเอง</SelectItem>
              </SelectContent>
            </Select>
            {dateRange === 'custom' && (
              <>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[180px]" />
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[180px]" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/30"><DollarSign className="size-5 text-amber-400" /></div>
              <div>
                <p className="text-sm font-medium text-amber-200/90">ยอดแทงรวม</p>
                <p className="text-xl font-bold text-white">{formatNumber(summary.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/30"><TrendingUp className="size-5 text-green-400" /></div>
              <div>
                <p className="text-sm font-medium text-green-200/90">กำไร</p>
                <p className="text-xl font-bold text-green-400">{formatNumber(summary.totalProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/30"><TrendingDown className="size-5 text-red-400" /></div>
              <div>
                <p className="text-sm font-medium text-red-200/90">ขาดทุน</p>
                <p className="text-xl font-bold text-red-400">{formatNumber(summary.totalLoss)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${summary.netProfit >= 0 ? 'from-green-500/20 to-green-600/10 border-green-500/30' : 'from-red-500/20 to-red-600/10 border-red-500/30'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${summary.netProfit >= 0 ? 'bg-green-500/30' : 'bg-red-500/30'}`}>
                {summary.netProfit >= 0 ? <TrendingUp className="size-5 text-green-400" /> : <TrendingDown className="size-5 text-red-400" />}
              </div>
              <div>
                <p className={`text-sm font-medium ${summary.netProfit >= 0 ? 'text-green-200/90' : 'text-red-200/90'}`}>กำไรสุทธิรวม</p>
                <p className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatNumber(summary.netProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/30"><Target className="size-5 text-blue-400" /></div>
              <div>
                <p className="text-sm font-medium text-blue-200/90">อัตราชนะ</p>
                <p className="text-xl font-bold text-white">{summary.winRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList>
          <TabsTrigger value="sales">ยอดแทง</TabsTrigger>
          <TabsTrigger value="profit">กำไร/ขาดทุน</TabsTrigger>
          <TabsTrigger value="agents">Top เอเย่น</TabsTrigger>
          <TabsTrigger value="numbers">เลขยอดนิยม</TabsTrigger>
          <TabsTrigger value="risk">เลขเสี่ยง</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>กราฟยอดแทงรายวัน</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} />
                    <Bar dataKey="sales" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profit" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>กราฟกำไร/ขาดทุน</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} />
                    <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Top 10 เอเย่นยอดขายสูงสุด</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>อันดับ</TableHead>
                    <TableHead>เอเย่น</TableHead>
                    <TableHead className="text-right">ยอดขาย</TableHead>
                    <TableHead className="text-right">คอมมิชชั่น</TableHead>
                    <TableHead className="text-right">สมาชิก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAgents.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</TableCell></TableRow>
                  ) : topAgents.map((agent, index) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <Badge variant={index < 3 ? 'default' : 'outline'} className={index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : ''}>
                          #{index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{agent.display_name}</p>
                          <p className="text-xs text-muted-foreground">@{agent.username}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatNumber(agent.total_sales)}</TableCell>
                      <TableCell className="text-right text-accent">{formatNumber(agent.commission)}</TableCell>
                      <TableCell className="text-right">{agent.member_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>เลขยอดนิยม</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={topNumbers.slice(0, 6)} dataKey="amount" nameKey="number" cx="50%" cy="50%" outerRadius={100} label>
                        {topNumbers.slice(0, 6).map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลข</TableHead>
                      <TableHead className="text-right">ยอดแทง</TableHead>
                      <TableHead className="text-right">จำนวนครั้ง</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topNumbers.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</TableCell></TableRow>
                    ) : topNumbers.map((num) => (
                      <TableRow key={num.number}>
                        <TableCell className="font-mono font-bold text-lg">{num.number}</TableCell>
                        <TableCell className="text-right">{formatNumber(num.amount)}</TableCell>
                        <TableCell className="text-right">{num.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-red-500" />
                เลขเสี่ยง (ถ้าถูกจะขาดทุน)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลข</TableHead>
                    <TableHead className="text-right">ยอดแทง</TableHead>
                    <TableHead className="text-right">จ่ายถ้าถูก</TableHead>
                    <TableHead className="text-right">ขาดทุน</TableHead>
                    <TableHead className="text-center">ระดับเสี่ยง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskNumbers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ไม่มีเลขเสี่ยง</TableCell></TableRow>
                  ) : riskNumbers.map((num) => (
                    <TableRow key={num.number}>
                      <TableCell className="font-mono font-bold text-lg">{num.number}</TableCell>
                      <TableCell className="text-right">{formatNumber(num.amount)}</TableCell>
                      <TableCell className="text-right">{formatNumber(num.payout)}</TableCell>
                      <TableCell className="text-right text-red-500 font-bold">{formatNumber(num.loss)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={num.risk === 'high' ? 'destructive' : 'secondary'}>
                          {num.risk === 'high' ? 'สูง' : 'กลาง'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
