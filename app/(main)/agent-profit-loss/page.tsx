'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Users,
  Wallet,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Network,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AgentProfitLossPage() {
  const { canAccess, branchId, isMasterBranch } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedAgent !== 'all') params.set('agent_id', selectedAgent);
    if (branchId && !isMasterBranch) params.set('branch_id', branchId);
    params.set('period', period);
    if (period === 'custom') {
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
    }
    return params.toString();
  }, [selectedAgent, branchId, isMasterBranch, period, startDate, endDate]);

  const { data, isLoading, mutate } = useSWR(
    `/api/agent-profit-loss?${queryParams}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const agents = data?.agents || [];
  const summary = data?.summary || {
    total_agents: 0,
    total_sales: 0,
    total_payout: 0,
    total_commission: 0,
    total_profit: 0,
    profitable_agents: 0,
    loss_agents: 0,
  };

  // Chart data - top 10 agents by profit
  const chartData = useMemo(() => {
    return agents.slice(0, 10).map((agent: any) => ({
      name: agent.display_name || agent.username,
      profit: agent.profit,
      sales: agent.total_sales,
    }));
  }, [agents]);

  // Export to CSV
  const handleExport = () => {
    const headers = ['ชื่อ', 'ระดับ', 'ยอดขาย', 'จ่ายรางวัล', 'คอมฯ', 'กำไร/ขาดทุน', 'อัตรากำไร'];
    const rows = agents.map((a: any) => [
      a.display_name || a.username,
      a.role,
      a.total_sales,
      a.total_payout,
      a.total_commission,
      a.profit,
      `${a.profit_margin}%`,
    ]);

    const csv = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agent-profit-loss-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (!canAccess('admin')) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="size-6 text-accent" />
            กำไร/ขาดทุน สายงาน
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            วิเคราะห์กำไรขาดทุนของเอเย่นต์และพาร์ทเนอร์ใต้สายงาน - ข้อมูลส่งเข้าระบบแม่ Realtime
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
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
              <Label className="text-xs">เอเย่นต์</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.display_name || a.username}
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายรวม</CardTitle>
            <DollarSign className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.total_sales)} ฿</div>
            <p className="text-xs text-muted-foreground mt-1">
              จาก {summary.total_agents} เอเย่นต์
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">จ่ายรางวัล</CardTitle>
            <TrendingDown className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.total_payout)} ฿</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">คอมมิชชั่น</CardTitle>
            <PieChart className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(summary.total_commission)} ฿</div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${summary.total_profit >= 0 
          ? 'from-green-500/10 to-green-600/5 border-green-500/20' 
          : 'from-red-500/10 to-red-600/5 border-red-500/20'}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {summary.total_profit >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}
            </CardTitle>
            {summary.total_profit >= 0 ? (
              <TrendingUp className="size-4 text-green-500" />
            ) : (
              <TrendingDown className="size-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.total_profit >= 0 ? '+' : ''}{formatCurrency(summary.total_profit)} ฿
            </div>
            <div className="flex gap-2 mt-1">
              <Badge className="bg-green-500/20 text-green-600 text-xs">
                <ArrowUpRight className="size-3 mr-1" />
                กำไร {summary.profitable_agents}
              </Badge>
              <Badge className="bg-red-500/20 text-red-600 text-xs">
                <ArrowDownRight className="size-3 mr-1" />
                ขาดทุน {summary.loss_agents}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4" />
            Top 10 กำไร/ขาดทุน
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={(value: number) => `฿${formatCurrency(value)}`} />
                <Bar dataKey="profit" name="กำไร/ขาดทุน">
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              ยังไม่มีข้อมูล
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="size-4" />
            รายละเอียดกำไรขาดทุนแต่ละเอเย่นต์
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เอเย่นต์</TableHead>
                <TableHead>ระดับ</TableHead>
                <TableHead className="text-center">ลูกค้า</TableHead>
                <TableHead className="text-center">ลูกข่าย</TableHead>
                <TableHead className="text-right">ยอดขาย</TableHead>
                <TableHead className="text-right">จ่ายรางวัล</TableHead>
                <TableHead className="text-right">คอมฯ</TableHead>
                <TableHead className="text-right">กำไร/ขาดทุน</TableHead>
                <TableHead className="text-right">อัตรากำไร</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Users className="size-12 mx-auto mb-4 opacity-50" />
                    ไม่พบข้อมูลเอเย่นต์
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((agent: any) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{agent.display_name || agent.username}</p>
                        <p className="text-xs text-muted-foreground">@{agent.username}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {agent.role === 'partner' ? 'พาร์ทเนอร์' : 
                         agent.role === 'agent' ? 'เอเย่นต์' : 
                         agent.role === 'admin' ? 'แอดมิน' : agent.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{agent.customer_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{agent.downline_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(agent.total_sales)} ฿
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(agent.total_payout)} ฿
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      {formatCurrency(agent.total_commission)} ฿
                    </TableCell>
                    <TableCell className={`text-right font-bold ${agent.is_profit ? 'text-green-600' : 'text-red-600'}`}>
                      {agent.is_profit ? '+' : ''}{formatCurrency(agent.profit)} ฿
                    </TableCell>
                    <TableCell className={`text-right ${Number(agent.profit_margin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {agent.profit_margin}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
