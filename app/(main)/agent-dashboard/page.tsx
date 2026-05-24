'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  Lock,
  RefreshCw,
  Calendar,
  Target,
  Percent,
  UserPlus,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import useSWR from 'swr';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

// Chart colors
const CHART_COLORS = ['#D4AF37', '#F5D061', '#B8860B', '#8B6914', '#FFE082', '#FFC107'];

interface TeamMember {
  id: string;
  username: string;
  display_name: string;
  role: string;
  credit_balance: number;
  total_bets: number;
  total_commission: number;
  is_active: boolean;
  created_at: string;
}

interface AgentStats {
  totalMembers: number;
  activeMembers: number;
  totalTurnover: number;
  totalCommission: number;
  todayTurnover: number;
  todayCommission: number;
  weeklyTurnover: number;
  weeklyCommission: number;
  monthlyTurnover: number;
  monthlyCommission: number;
  profitLoss: number;
  newMembersThisWeek: number;
}

export default function AgentDashboardPage() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [dateRange, setDateRange] = useState('today');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch agent's team data (scoped to their downline only)
  const { data: teamData, mutate } = useSWR(
    user?.id ? `/api/agent/team?agent_id=${user.id}&range=${dateRange}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch turnover chart data
  const { data: chartData } = useSWR(
    user?.id ? `/api/agent/turnover-chart?agent_id=${user.id}&range=${dateRange}` : null,
    fetcher
  );

  const stats: AgentStats = teamData?.stats || {
    totalMembers: 0,
    activeMembers: 0,
    totalTurnover: 0,
    totalCommission: 0,
    todayTurnover: 0,
    todayCommission: 0,
    weeklyTurnover: 0,
    weeklyCommission: 0,
    monthlyTurnover: 0,
    monthlyCommission: 0,
    profitLoss: 0,
    newMembersThisWeek: 0,
  };

  const teamMembers: TeamMember[] = teamData?.members || [];

  // Mock chart data for demo
  const turnoverChartData = chartData?.daily || [
    { date: 'จ.', turnover: 45000, commission: 4500 },
    { date: 'อ.', turnover: 52000, commission: 5200 },
    { date: 'พ.', turnover: 38000, commission: 3800 },
    { date: 'พฤ.', turnover: 61000, commission: 6100 },
    { date: 'ศ.', turnover: 72000, commission: 7200 },
    { date: 'ส.', turnover: 89000, commission: 8900 },
    { date: 'อา.', turnover: 95000, commission: 9500 },
  ];

  const betTypeDistribution = chartData?.betTypes || [
    { name: '3 ตัวบน', value: 35 },
    { name: '2 ตัวบน', value: 25 },
    { name: '2 ตัวล่าง', value: 20 },
    { name: 'วิ่งบน', value: 12 },
    { name: 'วิ่งล่าง', value: 8 },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 border border-[#D4AF37]/30 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()} บาท
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            Agent Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {user?.displayName || 'Agent'} - ข้อมูลเฉพาะสายงานของคุณ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px] bg-black/40 border-amber-500/30 text-white">
              <Calendar className="size-4 mr-2 text-[#D4AF37]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-amber-500/30">
              <SelectItem value="today">วันนี้</SelectItem>
              <SelectItem value="week">สัปดาห์นี้</SelectItem>
              <SelectItem value="month">เดือนนี้</SelectItem>
              <SelectItem value="year">ปีนี้</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            Agent Level
          </Badge>
        </div>
      </div>

      {/* Scoped Data Notice */}
      <div className="relative p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Target className="size-5 text-amber-400" />
          </div>
          <div>
            <p className="text-amber-400 font-medium">ข้อมูลเฉพาะสายงาน (Scoped Data)</p>
            <p className="text-slate-400 text-sm">
              แดชบอร์ดนี้แสดงเฉพาะสถิติของลูกทีมภายใต้สายงานของคุณเท่านั้น
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 shadow-[0_0_20px_rgba(255,215,0,0.1)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Users className="size-8 text-[#D4AF37]" />
              <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                +{stats.newMembersThisWeek} ใหม่
              </Badge>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalMembers}</p>
            <p className="text-sm text-slate-400">ลูกทีมทั้งหมด</p>
            <p className="text-xs text-emerald-400 mt-1">
              {stats.activeMembers} ใช้งานอยู่
            </p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 shadow-[0_0_20px_rgba(255,215,0,0.1)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="size-8 text-[#D4AF37]" />
              <ArrowUpRight className="size-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-white">
              {(dateRange === 'today' ? stats.todayTurnover : 
                dateRange === 'week' ? stats.weeklyTurnover : 
                stats.monthlyTurnover).toLocaleString()}
            </p>
            <p className="text-sm text-slate-400">ยอดเล่นรวม</p>
            <p className="text-xs text-[#D4AF37] mt-1">
              {dateRange === 'today' ? 'วันนี้' : dateRange === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 shadow-[0_0_20px_rgba(255,215,0,0.1)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Percent className="size-8 text-[#D4AF37]" />
              <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                ค่าคอม
              </Badge>
            </div>
            <p className="text-2xl font-bold text-white">
              {(dateRange === 'today' ? stats.todayCommission : 
                dateRange === 'week' ? stats.weeklyCommission : 
                stats.monthlyCommission).toLocaleString()}
            </p>
            <p className="text-sm text-slate-400">คอมมิชชั่น</p>
            <p className="text-xs text-emerald-400 mt-1">
              +12% จากช่วงก่อน
            </p>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 shadow-[0_0_20px_rgba(255,215,0,0.1)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <Wallet className="size-8 text-[#D4AF37]" />
              {stats.profitLoss >= 0 ? (
                <ArrowUpRight className="size-5 text-emerald-400" />
              ) : (
                <ArrowDownRight className="size-5 text-red-400" />
              )}
            </div>
            <p className={`text-2xl font-bold ${stats.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stats.profitLoss >= 0 ? '+' : ''}{stats.profitLoss.toLocaleString()}
            </p>
            <p className="text-sm text-slate-400">กำไร/ขาดทุน</p>
            <p className="text-xs text-slate-500 mt-1">
              สายงานของคุณ
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Turnover Chart - Takes 2 columns */}
        <Card className="lg:col-span-2 bg-black/40 backdrop-blur-xl border-amber-500/30 shadow-[0_0_30px_rgba(255,215,0,0.1)]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="size-5 text-[#D4AF37]" />
              กราฟยอดเล่นของลูกทีม
            </CardTitle>
            <CardDescription className="text-slate-400">
              สรุปยอด Turnover รายวันของสายงาน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={turnoverChartData}>
                  <defs>
                    <linearGradient id="turnoverGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="commissionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748B" />
                  <YAxis stroke="#64748B" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="turnover"
                    stroke="#D4AF37"
                    strokeWidth={2}
                    fill="url(#turnoverGradient)"
                    name="ยอดเล่น"
                  />
                  <Area
                    type="monotone"
                    dataKey="commission"
                    stroke="#22C55E"
                    strokeWidth={2}
                    fill="url(#commissionGradient)"
                    name="คอมมิชชั่น"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bet Type Distribution */}
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 shadow-[0_0_30px_rgba(255,215,0,0.1)]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="size-5 text-[#D4AF37]" />
              ประเภทการแทง
            </CardTitle>
            <CardDescription className="text-slate-400">
              สัดส่วนการแทงแต่ละประเภท
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={betTypeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {betTypeDistribution.map((entry: { name: string; value: number }, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(0,0,0,0.9)',
                      border: '1px solid rgba(212,175,55,0.3)',
                      borderRadius: '8px',
                    }}
                    itemStyle={{ color: '#D4AF37' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-slate-300 text-xs">{value}</span>}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 shadow-[0_0_30px_rgba(255,215,0,0.1)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="size-5 text-[#D4AF37]" />
                ลูกทีมในสายงาน
              </CardTitle>
              <CardDescription className="text-slate-400">
                รายชื่อสมาชิกภายใต้สายงานของคุณ
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <UserPlus className="size-4 mr-2" />
              เพิ่มลูกทีม
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">ชื่อ</TableHead>
                <TableHead className="text-slate-400">สถานะ</TableHead>
                <TableHead className="text-slate-400 text-right">ยอดเล่น</TableHead>
                <TableHead className="text-slate-400 text-right">คอมมิชชั่น</TableHead>
                <TableHead className="text-slate-400 text-right">เครดิต</TableHead>
                <TableHead className="text-slate-400 text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    ยังไม่มีลูกทีมในสายงาน
                  </TableCell>
                </TableRow>
              ) : (
                teamMembers.map((member) => (
                  <TableRow key={member.id} className="border-slate-800 hover:bg-white/5">
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">{member.display_name}</p>
                        <p className="text-xs text-slate-500">{member.username}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={member.is_active 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }>
                        {member.is_active ? 'ใช้งาน' : 'ระงับ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-white font-mono">
                      {member.total_bets.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-emerald-400 font-mono">
                      {member.total_commission.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[#D4AF37] font-mono">
                      {member.credit_balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white"
                      >
                        <Activity className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Admin Actions (Locked for non-Super Admin) */}
      <Card className="bg-black/40 backdrop-blur-xl border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="size-5 text-red-400" />
            การตั้งค่าระบบ (Super Admin Only)
          </CardTitle>
          <CardDescription className="text-slate-400">
            ฟังก์ชันเหล่านี้ต้องการสิทธิ์ Super Admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              disabled={!isSuperAdmin}
              className={`h-auto py-4 flex-col gap-2 ${
                isSuperAdmin 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-600 hover:to-amber-700'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <DollarSign className="size-6" />
              <span className="text-xs">ตั้งค่าเรท</span>
              {!isSuperAdmin && <Lock className="size-3 absolute top-2 right-2" />}
            </Button>

            <Button
              disabled={!isSuperAdmin}
              className={`h-auto py-4 flex-col gap-2 ${
                isSuperAdmin 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-600 hover:to-amber-700'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Crown className="size-6" />
              <span className="text-xs">จัดการเว็บลูก</span>
              {!isSuperAdmin && <Lock className="size-3 absolute top-2 right-2" />}
            </Button>

            <Button
              disabled={!isSuperAdmin}
              className={`h-auto py-4 flex-col gap-2 ${
                isSuperAdmin 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-600 hover:to-amber-700'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Wallet className="size-6" />
              <span className="text-xs">ฝาก-ถอนกลาง</span>
              {!isSuperAdmin && <Lock className="size-3 absolute top-2 right-2" />}
            </Button>

            <Button
              disabled={!isSuperAdmin}
              className={`h-auto py-4 flex-col gap-2 ${
                isSuperAdmin 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-600 hover:to-amber-700'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <BarChart3 className="size-6" />
              <span className="text-xs">รายงานรวม</span>
              {!isSuperAdmin && <Lock className="size-3 absolute top-2 right-2" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
