'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  UserCheck,
  Wallet,
  TrendingUp,
  TrendingDown,
  Crown,
  Search,
  Download,
  Printer,
  Eye,
  Loader2,
  UsersRound,
  DollarSign,
  FileText,
  Infinity,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '@/hooks/use-auth';
import { USER_ROLE_LABELS } from '@/types/lottery';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return { members: [], summary: null };
  return res.json();
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  agent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  partner: 'bg-green-500/20 text-green-400 border-green-500/30',
  staff: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  member: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function MemberSummaryPage() {
  const { isSuperAdmin, isAdmin, user } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Build query params
  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  if (roleFilter && roleFilter !== 'all') queryParams.set('role', roleFilter);
  if (dateFrom) queryParams.set('date_from', dateFrom);
  if (dateTo) queryParams.set('date_to', dateTo);

  const { data, isLoading } = useSWR(
    `/api/member-summary?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const members = data?.members || [];
  const summary = data?.summary || {
    totalMembers: 0,
    totalCustomers: 0,
    totalCreditInSystem: 0,
    totalProfit: 0,
    totalLoss: 0,
    topMember: null,
    worstMember: null,
  };

  // Chart data - bets by member
  const betsChartData = useMemo(() => {
    return members
      .sort((a: { totalBets: number }, b: { totalBets: number }) => b.totalBets - a.totalBets)
      .slice(0, 10)
      .map((m: { displayName: string; totalBets: number; netProfit: number; isProfit: boolean }) => ({
        name: m.displayName?.substring(0, 10) || 'N/A',
        bets: m.totalBets,
        profit: m.isProfit ? m.netProfit : -m.netProfit,
      }));
  }, [members]);

  // Pie chart data - credit distribution
  const creditPieData = useMemo(() => {
    return members
      .filter((m: { creditBalance: number }) => m.creditBalance > 0)
      .sort((a: { creditBalance: number }, b: { creditBalance: number }) => b.creditBalance - a.creditBalance)
      .slice(0, 6)
      .map((m: { displayName: string; creditBalance: number }) => ({
        name: m.displayName?.substring(0, 10) || 'N/A',
        value: m.creditBalance,
      }));
  }, [members]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Username', 'ชื่อ', 'Role', 'ลูกค้า', 'โพย', 'เครดิต', 'ยอดแทง', 'ยอดจ่าย', 'กำไร/ขาดทุน'];
    const rows = members.map((m: {
      username: string;
      displayName: string;
      role: string;
      customerCount: number;
      entryCount: number;
      creditBalance: number;
      totalBets: number;
      totalPayout: number;
      isProfit: boolean;
      netProfit: number;
    }) => [
      m.username,
      m.displayName,
      USER_ROLE_LABELS[m.role as keyof typeof USER_ROLE_LABELS] || m.role,
      m.customerCount,
      m.entryCount,
      m.creditBalance,
      m.totalBets,
      m.totalPayout,
      m.isProfit ? m.netProfit : -m.netProfit,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `member-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Permission check
  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="size-16 text-amber-500" />
        <h2 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-muted-foreground">คุณไม่มีสิทธิ์ดูหน้านี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <UsersRound className="size-7 text-accent" />
            สรุปแมมเบอร์ / สายงาน
          </h1>
          <p className="text-muted-foreground mt-1">ดูข้อมูลสมาชิก เครดิต กำไร/ขาดทุน แต่ละสาย</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4 mr-1" />
            พิมพ์
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Users className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สมาชิกทั้งหมด</p>
                <p className="text-2xl font-bold">{summary.totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/20">
                <UserCheck className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ลูกค้าทั้งหมด</p>
                <p className="text-2xl font-bold">{summary.totalCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/20">
                <Wallet className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เครดิตรวม</p>
                <p className="text-2xl font-bold">{summary.totalCreditInSystem.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/20">
                <TrendingUp className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">กำไรรวม</p>
                <p className="text-2xl font-bold text-green-500">+{summary.totalProfit.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/20 via-red-500/10 to-transparent border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-red-500/20">
                <TrendingDown className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ขาดทุนรวม</p>
                <p className="text-2xl font-bold text-red-500">-{summary.totalLoss.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Crown className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top Member</p>
                <p className="text-lg font-bold truncate">{summary.topMember?.displayName || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา username หรือชื่อ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="เลือก Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุก Role</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
              placeholder="จากวันที่"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
              placeholder="ถึงวันที่"
            />
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setRoleFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
            >
              ล้างตัวกรอง
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bets Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="size-5 text-accent" />
              ยอดแทงแต่ละสมาชิก (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {betsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={betsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    formatter={(value: number) => [value.toLocaleString() + ' บาท']}
                  />
                  <Bar dataKey="bets" fill="#f59e0b" name="ยอดแทง" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                ยังไม่มีข้อมูล
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-accent" />
              สัดส่วนเครดิต (Top 6)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {creditPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={creditPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {creditPieData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value.toLocaleString() + ' บาท']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                ยังไม่มีข้อมูล
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5 text-accent" />
            รายชื่อสมาชิก ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-accent" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="size-12 mb-4 opacity-50" />
              <p>ยังไม่มีสมาชิก</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>สายงาน</TableHead>
                    <TableHead className="text-right">ลูกค้า</TableHead>
                    <TableHead className="text-right">โพย</TableHead>
                    <TableHead className="text-right">เครดิต</TableHead>
                    <TableHead className="text-right">ยอดแทง</TableHead>
                    <TableHead className="text-right">ยอดจ่าย</TableHead>
                    <TableHead className="text-right">กำไร/ขาดทุน</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member: {
                    id: string;
                    username: string;
                    displayName: string;
                    role: string;
                    parentName: string | null;
                    hierarchyLevel: number;
                    customerCount: number;
                    entryCount: number;
                    creditBalance: number;
                    isUnlimitedCredit: boolean;
                    totalBets: number;
                    totalPayout: number;
                    isProfit: boolean;
                    netProfit: number;
                  }, index: number) => (
                    <TableRow 
                      key={member.id}
                      className={index === 0 && member.totalBets > 0 ? 'bg-amber-500/10 border-amber-500/30' : ''}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {index === 0 && member.totalBets > 0 && (
                            <Crown className="size-4 text-amber-500" />
                          )}
                          {member.username}
                        </div>
                      </TableCell>
                      <TableCell>{member.displayName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_COLORS[member.role] || ''}>
                          {USER_ROLE_LABELS[member.role as keyof typeof USER_ROLE_LABELS] || member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.parentName ? (
                          <span className="text-muted-foreground">{member.parentName}</span>
                        ) : (
                          <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            หัวสาย
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{member.customerCount}</TableCell>
                      <TableCell className="text-right">{member.entryCount}</TableCell>
                      <TableCell className="text-right">
                        {member.isUnlimitedCredit ? (
                          <span className="flex items-center justify-end gap-1 text-purple-400">
                            <Infinity className="size-4" />
                            Unlimited
                          </span>
                        ) : (
                          member.creditBalance.toLocaleString()
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {member.totalBets.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-400">
                        {member.totalPayout.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={member.isProfit ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                          {member.isProfit ? '+' : '-'}{member.netProfit.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/member-summary/${member.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="size-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
