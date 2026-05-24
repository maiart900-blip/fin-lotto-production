'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle,
  AlertTriangle,
  Network,
  BarChart3,
  PieChart,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
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
} from 'recharts';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const PERIOD_OPTIONS = [
  { value: 'today', label: 'วันนี้' },
  { value: '7days', label: '7 วันล่าสุด' },
  { value: '30days', label: '30 วันล่าสุด' },
];

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(dateString: string | null) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'เมื่อสักครู่';
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ชม.ที่แล้ว`;
  return date.toLocaleDateString('th-TH');
}

export default function MasterDashboardPage() {
  const { user, canAccess, isMasterBranch, branchId } = useAuth();
  const [period, setPeriod] = useState('today');
  const [realtimeEvents, setRealtimeEvents] = useState<any[]>([]);

  // Fetch branch reports
  const { data, isLoading, mutate } = useSWR(
    branchId ? `/api/branch/sync-report?master_branch_id=${branchId}&period=${period}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const branches = data?.branches || [];
  const summary = data?.summary || {
    total_branches: 0,
    online_branches: 0,
    synced_branches: 0,
    total_sales: 0,
    total_payout: 0,
    total_profit: 0,
  };

  // Realtime subscription for events
  useEffect(() => {
    if (!branchId) return;

    const supabase = createClient();
    
    const channel = supabase
      .channel('master-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'branch_realtime_events',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          setRealtimeEvents(prev => [payload.new, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId]);

  // Chart data
  const branchChartData = branches.map((b: any) => ({
    name: b.branch_name,
    sales: b.report_data?.summary?.total_sales || 0,
    profit: b.report_data?.summary?.total_profit || 0,
  }));

  const pieData = [
    { name: 'ออนไลน์', value: summary.online_branches, color: '#22c55e' },
    { name: 'ออฟไลน์', value: summary.total_branches - summary.online_branches, color: '#ef4444' },
  ].filter(d => d.value > 0);

  if (!canAccess('admin') || !isMasterBranch) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="size-12 mx-auto text-yellow-500 mb-4" />
          <p className="text-lg font-medium">ไม่มีสิทธิ์เข้าถึง</p>
          <p className="text-muted-foreground">หน้านี้สำหรับระบบแม่ (Master Branch) เท่านั้น</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-accent" />
            Dashboard ระบบแม่
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            ดูข้อมูลจากทุกสาขาแบบ Realtime - อัพเดททุก 10 วินาที
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
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
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">สาขาทั้งหมด</p>
                <p className="text-2xl font-bold text-purple-600">{summary.total_branches}</p>
              </div>
              <Building2 className="size-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ออนไลน์</p>
                <p className="text-2xl font-bold text-green-600">{summary.online_branches}</p>
              </div>
              <Wifi className="size-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sync แล้ว</p>
                <p className="text-2xl font-bold text-blue-600">{summary.synced_branches}</p>
              </div>
              <CheckCircle className="size-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ยอดขายรวม</p>
                <p className="text-2xl font-bold text-cyan-600">{formatCurrency(summary.total_sales)}</p>
              </div>
              <DollarSign className="size-8 text-cyan-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">จ่ายรางวัล</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.total_payout)}</p>
              </div>
              <TrendingDown className="size-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${summary.total_profit >= 0 
          ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' 
          : 'from-rose-500/10 to-rose-600/5 border-rose-500/20'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">กำไรรวม</p>
                <p className={`text-2xl font-bold ${summary.total_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {summary.total_profit >= 0 ? '+' : ''}{formatCurrency(summary.total_profit)}
                </p>
              </div>
              <TrendingUp className={`size-8 ${summary.total_profit >= 0 ? 'text-emerald-500/50' : 'text-rose-500/50'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="branches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="branches">สถานะสาขา</TabsTrigger>
          <TabsTrigger value="charts">กราฟวิเคราะห์</TabsTrigger>
          <TabsTrigger value="realtime">Events Realtime</TabsTrigger>
        </TabsList>

        {/* Branches Tab */}
        <TabsContent value="branches">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="size-4" />
                สถานะสาขาทั้งหมด
              </CardTitle>
              <CardDescription>ข้อมูล Sync จากสาขาลูกเข้าระบบแม่</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>สาขา</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="text-center">Sync ล่าสุด</TableHead>
                    <TableHead className="text-right">ยอดขาย</TableHead>
                    <TableHead className="text-right">จ่ายรางวัล</TableHead>
                    <TableHead className="text-right">กำไร/ขาดทุน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Building2 className="size-12 mx-auto mb-4 opacity-50" />
                        ยังไม่มีสาขาในระบบ
                      </TableCell>
                    </TableRow>
                  ) : (
                    branches.map((branch: any) => {
                      const profit = branch.report_data?.summary?.total_profit || 0;
                      return (
                        <TableRow key={branch.branch_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{branch.branch_name}</p>
                              <p className="text-xs text-muted-foreground">{branch.branch_code}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {branch.branch_type === 'branch' ? 'สาขา' : 
                               branch.branch_type === 'sub_branch' ? 'สาขาย่อย' : branch.branch_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {branch.is_online ? (
                              <Badge className="bg-green-500/20 text-green-400">
                                <Wifi className="size-3 mr-1" />
                                ออนไลน์
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <WifiOff className="size-3 mr-1" />
                                ออฟไลน์
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="size-3 text-muted-foreground" />
                              <span className="text-sm">{formatTime(branch.latest_sync)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(branch.report_data?.summary?.total_sales || 0)} ฿
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(branch.report_data?.summary?.total_payout || 0)} ฿
                          </TableCell>
                          <TableCell className={`text-right font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {profit >= 0 ? '+' : ''}{formatCurrency(profit)} ฿
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="size-4" />
                  ยอดขายแต่ละสาขา
                </CardTitle>
              </CardHeader>
              <CardContent>
                {branchChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={branchChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => `฿${formatCurrency(value)}`} />
                      <Bar dataKey="sales" fill="#3b82f6" name="ยอดขาย" />
                      <Bar dataKey="profit" name="กำไร">
                        {branchChartData.map((entry: any, index: number) => (
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="size-4" />
                  สถานะการเชื่อมต่อ
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    ยังไม่มีข้อมูล
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Realtime Events Tab */}
        <TabsContent value="realtime">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="size-4 text-yellow-500" />
                Events Realtime
              </CardTitle>
              <CardDescription>กิจกรรมล่าสุดจากสาขาลูก</CardDescription>
            </CardHeader>
            <CardContent>
              {realtimeEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="size-12 mx-auto mb-4 opacity-50" />
                  <p>รอรับ events จากสาขาลูก...</p>
                  <p className="text-sm">events จะแสดงที่นี่เมื่อมีกิจกรรมเกิดขึ้น</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {realtimeEvents.map((event: any, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {event.event_type} - {event.event_category}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {formatTime(event.created_at)}
                        </Badge>
                      </div>
                      {event.data?.source_branch_name && (
                        <p className="text-sm mt-2">
                          จาก: <span className="font-medium">{event.data.source_branch_name}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
