'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import { useEntries, useCustomers, useSettings } from '@/hooks/use-lottery';
import { BET_TYPE_LABELS, BET_TYPE_COLORS, type BetType } from '@/types/lottery';
import {
  Banknote,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Hash,
  Crown,
  Sparkles,
  Loader2,
  Cloud,
  Ticket,
  BarChart3,
  ArrowRight,
  DollarSign,
  PieChart,
  Bell,
  CreditCard,
  ArrowDownToLine,
  AlertTriangle,
  UserPlus,
  ArrowUpToLine,
  ArrowDownFromLine,
  PenLine,
  History,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { LotteryStatusList } from '@/components/lottery/lottery-status';
import { Lottery } from '@/lib/lottery-utils';
import { getBusinessDay, getTodayDateRange } from '@/lib/daily-reset';
import { useAuth } from '@/hooks/use-auth';
import { fetcher } from '@/lib/fetcher';

const betTypes: BetType[] = ['3top', '3tod', '2top', '2bot', '1top', '1bot'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Redirect Agent ไป Agent Dashboard
  useEffect(() => {
    if (!authLoading && user) {
      // Check if user is any type of agent (role-based or user_type-based)
      const isAgent = user.role === 'agent' || 
                      user.role === 'agent_key' || 
                      user.user_type === 'manual_key_agent';
      if (isAgent) {
        router.replace('/agent-dashboard');
      }
    }
  }, [user, authLoading, router]);
  
  const { entries: rawEntries, isLoading: entriesLoading, isError: entriesError } = useEntries();
  const { customers: rawCustomers, isLoading: customersLoading, isError: customersError } = useCustomers();
  const { settings: rawSettings } = useSettings();
  const { data: lotteriesData, error: lotteriesError } = useSWR<Lottery[]>('/api/lotteries', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });
  
  // Fetch profit/loss data for today
  const { data: profitLossData } = useSWR('/api/profit-loss?period=today', fetcher, {
    refreshInterval: 30000,
  });

  // Fetch dashboard stats (deposits/withdraws by period)
  const { data: dashboardStats } = useSWR('/api/dashboard/stats', fetcher, {
    refreshInterval: 30000,
  });

  // Fetch pending counts for notifications
  const { data: pendingCounts } = useSWR<{
    topupPending: number;
    withdrawPending: number;
    newCustomersToday: number;
    newEntriesToday: number;
    depositIssuesPending: number;
    totalPending: number;
  }>('/api/admin/pending-counts', fetcher, {
    refreshInterval: 5000,
  });

  // Fetch daily closing status
  const { data: dailyClosingStatus } = useSWR<{
    isOpen: boolean;
    closingData?: {
      closing_date: string;
      status: string;
      net_profit: number;
    };
  }>('/api/admin/daily-closing?type=status', fetcher, {
    refreshInterval: 60000,
  });

  // Safe fallbacks - never let undefined break the page
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const customers = Array.isArray(rawCustomers) ? rawCustomers : [];
  const lotteries = Array.isArray(lotteriesData) ? lotteriesData : [];
  const settings = rawSettings || { site_name: 'Lotto Agent' };
  const profitSummary = profitLossData?.summary || { totalBets: 0, totalPayout: 0, netProfit: 0, isProfit: true };
  const periodStats = dashboardStats?.stats?.periods || null;

  // Log errors for debugging only
  if (entriesError) console.error('Dashboard entries error:', entriesError);
  if (customersError) console.error('Dashboard customers error:', customersError);
  if (lotteriesError) console.error('Dashboard lotteries error:', lotteriesError);

  const grandTotal = useMemo(() => {
    try {
      return entries.reduce((sum, e) => sum + (e?.amount || 0), 0);
    } catch {
      return 0;
    }
  }, [entries]);

  const getTotalByBetType = (type: BetType) => {
    try {
      return entries.filter(e => e?.bet_type === type).reduce((sum, e) => sum + (e?.amount || 0), 0);
    } catch {
      return 0;
    }
  };

  const topNumbers = useMemo(() => {
    try {
      const grouped = entries.reduce((acc, e) => {
        if (!e?.number || !e?.bet_type) return acc;
        const key = `${e.number}-${e.bet_type}`;
        if (!acc[key]) {
          acc[key] = { number: e.number, betType: e.bet_type as BetType, count: 0, totalAmount: 0 };
        }
        acc[key].count += 1;
        acc[key].totalAmount += e?.amount || 0;
        return acc;
      }, {} as Record<string, { number: string; betType: BetType; count: number; totalAmount: number }>);
      
      return Object.values(grouped)
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10);
    } catch {
      return [];
    }
  }, [entries]);

  const chartData = useMemo(() => {
    try {
      const dailyMap = entries.reduce((acc, e) => {
        if (!e?.created_at) return acc;
        const date = e.created_at.split('T')[0];
        if (!acc[date]) acc[date] = { date, amount: 0, count: 0 };
        acc[date].amount += e?.amount || 0;
        acc[date].count += 1;
        return acc;
      }, {} as Record<string, { date: string; amount: number; count: number }>);
      
      return Object.values(dailyMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7)
        .map(d => ({
          date: new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
          amount: d.amount,
          count: d.count,
        }));
    } catch {
      return [];
    }
  }, [entries]);

  const chartConfig = {
    amount: {
      label: 'ยอดรวม',
      color: 'var(--chart-1)',
    },
  };

  // Filter entries for today's business day (resets at 01:00 AM Thailand time)
  const todayEntries = useMemo(() => {
    try {
      const todayRange = getTodayDateRange();
      return entries.filter(e => {
        if (!e?.created_at) return false;
        const entryTime = e.created_at;
        return entryTime >= todayRange.start && entryTime <= todayRange.end;
      });
    } catch {
      return [];
    }
  }, [entries]);

  // Summary by lottery
  const summaryByLottery = useMemo(() => {
    try {
      const summary: Record<string, { name: string; total: number; count: number }> = {};
      
      entries.forEach(entry => {
        if (!entry) return;
        const lotteryId = entry.lottery_id || 'none';
        const lotteryName = entry.lottery?.name || 'ไม่ระบุ';
        
        if (!summary[lotteryId]) {
          summary[lotteryId] = { name: lotteryName, total: 0, count: 0 };
        }
        summary[lotteryId].total += entry?.amount || 0;
        summary[lotteryId].count += 1;
      });
      
      return Object.entries(summary)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10) // Top 10 lotteries
        .map(([id, data]) => ({ id, ...data }));
    } catch {
      return [];
    }
  }, [entries]);

  const todayTotal = useMemo(() => {
    try {
      return todayEntries.reduce((sum, e) => sum + (e?.amount || 0), 0);
    } catch {
      return 0;
    }
  }, [todayEntries]);

  const isLoading = entriesLoading || customersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="size-8 animate-spin text-accent mx-auto" />
          <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#F8FAFC] min-h-screen p-6 -m-6">
      {/* Header - Premium Gold */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A] flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.3)]">
              <Crown className="size-6 text-white" />
            </div>
            <span className="text-gold-gradient">FIN LOTTO R+</span>
          </h1>
          <p className="text-[#64748B] mt-1">ยินดีต้อนรับสู่ {settings.site_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#10B981] text-[#10B981] hidden sm:flex gap-1 hover-lift">
            <Cloud className="size-3 sync-rotating" />
            Cloud Sync
          </Badge>
          <Badge className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-white hidden sm:flex gap-1 shadow-lg shadow-[rgba(234,179,8,0.3)]">
            <Sparkles className="size-3" />
            Premium
          </Badge>
        </div>
      </div>

      {/* Pending Notifications */}
      {pendingCounts && pendingCounts.totalPending > 0 && (
        <Card className="bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-destructive/20">
                <Bell className="size-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-destructive">รายการรอดำเนินการ</h3>
                <p className="text-xs text-muted-foreground">มี {pendingCounts.totalPending} รายการที่ต้องตรวจสอบ</p>
              </div>
            </div>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              {pendingCounts.topupPending > 0 && (
                <Link href="/topup-requests">
                  <div className="p-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-amber-500" />
                      <span className="text-sm font-medium">เติมเงิน</span>
                    </div>
                    <p className="text-xl font-bold text-amber-500 mt-1">{pendingCounts.topupPending}</p>
                  </div>
                </Link>
              )}
              {pendingCounts.withdrawPending > 0 && (
                <Link href="/withdraw-requests">
                  <div className="p-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="size-4 text-red-500" />
                      <span className="text-sm font-medium">ถอนเงิน</span>
                    </div>
                    <p className="text-xl font-bold text-red-500 mt-1">{pendingCounts.withdrawPending}</p>
                  </div>
                </Link>
              )}
              {pendingCounts.depositIssuesPending > 0 && (
                <Link href="/deposit-issues">
                  <div className="p-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-orange-500" />
                      <span className="text-sm font-medium">แจ้งปัญหา</span>
                    </div>
                    <p className="text-xl font-bold text-orange-500 mt-1">{pendingCounts.depositIssuesPending}</p>
                  </div>
                </Link>
              )}
              {pendingCounts.newCustomersToday > 0 && (
                <Link href="/customers">
                  <div className="p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <UserPlus className="size-4 text-blue-500" />
                      <span className="text-sm font-medium">สมาชิกใหม่</span>
                    </div>
                    <p className="text-xl font-bold text-blue-500 mt-1">{pendingCounts.newCustomersToday}</p>
                  </div>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Stats Note */}
      <Card className="bg-gradient-to-r from-[#1E293B] to-[#0F172A] border-[#334155]">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Badge className="bg-[#EAB308]/20 text-[#EAB308] border-[#EAB308]/30">
                รีเซ็ตยอด 01:00 น.
              </Badge>
              <p className="text-xs text-[#94A3B8]">
                ยอดวันนี้นับตั้งแต่ 01:00 น. - 00:59 น. วันถัดไป (เวลาไทย)
              </p>
              {/* Daily Closing Status */}
              {dailyClosingStatus && (
                <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-[#334155]">
                  {dailyClosingStatus.isOpen ? (
                    <Badge variant="outline" className="gap-1 text-amber-400 border-amber-400/30 bg-amber-400/10">
                      <Clock className="size-3" />
                      ยังไม่ปิดยอด
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                      <CheckCircle2 className="size-3" />
                      ปิดยอดแล้ว
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/reports/daily-closing">
                <Button variant="outline" size="sm" className="h-7 text-xs border-[#334155] text-[#94A3B8] hover:bg-[#334155] hover:text-white gap-1">
                  <History className="size-3" />
                  รายงานย้อนหลัง
                </Button>
              </Link>
              <Link href="/profit-loss?period=yesterday">
                <Button variant="outline" size="sm" className="h-7 text-xs border-[#334155] text-[#94A3B8] hover:bg-[#334155] hover:text-white">
                  ดูยอดเมื่อวาน
                  <ArrowRight className="size-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats Cards - Glassmorphism Gold */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card-gold hover-lift overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#EAB308]/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">ยอดรวมทั้งหมด</p>
                <p className="text-2xl md:text-3xl font-bold text-deep-gold mt-1">
                  {grandTotal.toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">บาท</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.4)]">
                <Banknote className="size-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#EAB308]/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">ยอดวันนี้</p>
                <p className="text-2xl md:text-3xl font-bold text-[#B8860B] mt-1">
                  {todayTotal.toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">{todayEntries.length} รายการ</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.4)]">
                <TrendingUp className="size-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#EAB308]/15 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">จำนวนรายการ</p>
                <p className="text-2xl md:text-3xl font-bold text-[#0F172A] mt-1">
                  {entries.length.toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">รายการทั้งหมด</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.4)]">
                <FileText className="size-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#EAB308]/15 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">ลูกค้า</p>
                <p className="text-2xl md:text-3xl font-bold text-[#0F172A] mt-1">
                  {customers.length.toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">คน</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.4)]">
                <Users className="size-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profit/Loss Summary Cards - Premium */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {/* ยอดฝากวันนี้ */}
        <Card className="glass-card-gold hover-lift overflow-hidden relative border-[#10B981]/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#10B981]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">ยอดฝากวันนี้</p>
                <p className="text-2xl md:text-3xl font-bold text-[#10B981] mt-1">
                  +{(periodStats?.today?.financial?.totalDeposit || 0).toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">บาท</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] shadow-lg shadow-[rgba(16,185,129,0.4)]">
                <ArrowUpToLine className="size-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ยอดถอนวันนี้ */}
        <Card className="glass-card-gold hover-lift overflow-hidden relative border-[#F59E0B]/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">ยอดถอนวันนี้</p>
                <p className="text-2xl md:text-3xl font-bold text-[#F59E0B] mt-1">
                  -{(periodStats?.today?.financial?.totalWithdraw || 0).toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">บาท</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] shadow-lg shadow-[rgba(245,158,11,0.4)]">
                <ArrowDownFromLine className="size-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ยอดแทงวันนี้ */}
        <Card className="glass-card-gold hover-lift overflow-hidden relative border-[#3B82F6]/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#3B82F6]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">ยอดแทงวันนี้</p>
                <p className="text-2xl md:text-3xl font-bold text-[#3B82F6] mt-1">
                  {(periodStats?.today?.financial?.totalBets || 0).toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">บาท</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#2563EB] shadow-lg shadow-[rgba(59,130,246,0.4)]">
                <PenLine className="size-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* กำไรสุทธิวันนี้ */}
        <Card className={`glass-card-gold hover-lift overflow-hidden relative ${profitSummary.isProfit ? 'border-[#10B981]/30' : 'border-[#EF4444]/30'}`}>
          <div className={`absolute top-0 right-0 w-24 h-24 ${profitSummary.isProfit ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'} rounded-full -translate-y-1/2 translate-x-1/2`} />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">{profitSummary.isProfit ? 'กำไรสุทธิวันนี้' : 'ขาดทุนสุทธิวันนี้'}</p>
                <p className={`text-2xl md:text-3xl font-bold mt-1 ${profitSummary.isProfit ? 'profit-glow' : 'text-[#EF4444]'}`}>
                  {profitSummary.isProfit ? '+' : '-'}{Math.abs(profitSummary.netProfit).toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">บาท</p>
              </div>
              <div className={`p-3 rounded-xl shadow-lg ${profitSummary.isProfit ? 'bg-gradient-to-br from-[#10B981] to-[#059669] shadow-[rgba(16,185,129,0.4)]' : 'bg-gradient-to-br from-[#EF4444] to-[#DC2626] shadow-[rgba(239,68,68,0.4)]'}`}>
                {profitSummary.isProfit ? (
                  <TrendingUp className="size-5 text-white" />
                ) : (
                  <TrendingDown className="size-5 text-white" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ยอดจ่ายรวมวันนี้ */}
        <Card className="glass-card-gold hover-lift overflow-hidden relative border-[#EF4444]/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#EF4444]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#64748B]">ยอดจ่ายรวมวันนี้</p>
                <p className="text-2xl md:text-3xl font-bold text-[#EF4444] mt-1">
                  {profitSummary.totalPayout.toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">บาท</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EF4444] to-[#DC2626] shadow-lg shadow-[rgba(239,68,68,0.4)]">
                <DollarSign className="size-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 glass-card-gold hover-lift overflow-hidden relative">
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.4)]">
                  <PieChart className="size-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-[#64748B]">ดูรายงานกำไร/ขาดทุนเพิ่มเติม</p>
                  <p className="text-sm font-medium text-[#0F172A] mt-1">วิเคราะห์แยกตามหวย, กราฟ, Top 10</p>
                </div>
              </div>
              <Link href="/profit-loss">
                <Button className="btn-reflective-gold gap-1">
                  ดูรายงาน
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deposit/Withdraw Period Stats - Premium */}
      {periodStats && (
        <Card className="midnight-section overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#10B981] to-[#059669]">
                <Banknote className="size-4 text-white" />
              </div>
              สรุปยอดฝาก/ถูกรางวัล/กำไร
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {/* Today */}
              <div className="midnight-card p-4">
                <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#EAB308]" />
                  วันนี้
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#94A3B8]">ยอดแทงรวม</span>
                    <span className="text-lg font-bold text-[#3B82F6]">
                      {(periodStats.today?.financial?.totalBets || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#94A3B8]">ยอดถูกรางวัล</span>
                    <span className="text-lg font-bold text-[#F59E0B]">
                      -{(periodStats.today?.financial?.totalPayout || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#64748B]">ยอดฝาก/ถอน</span>
                    <span className="text-[#64748B]">
                      +{(periodStats.today?.financial?.totalDeposit || 0).toLocaleString()} / -{(periodStats.today?.financial?.totalWithdraw || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-[#334155] pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium text-white">กำไรสุทธิ</span>
                    <span className={`text-xl font-bold ${(periodStats.today?.financial?.netProfit || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {(periodStats.today?.financial?.netProfit || 0) >= 0 ? '+' : ''}{(periodStats.today?.financial?.netProfit || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* This Week */}
              <div className="midnight-card p-4">
                <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                  สัปดาห์นี้
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#94A3B8]">ยอดแทงรวม</span>
                    <span className="text-lg font-bold text-[#3B82F6]">
                      {(periodStats.week?.financial?.totalBets || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#94A3B8]">ยอดถูกรางวัล</span>
                    <span className="text-lg font-bold text-[#F59E0B]">
                      -{(periodStats.week?.financial?.totalPayout || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#64748B]">ยอดฝาก/ถอน</span>
                    <span className="text-[#64748B]">
                      +{(periodStats.week?.financial?.totalDeposit || 0).toLocaleString()} / -{(periodStats.week?.financial?.totalWithdraw || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-[#334155] pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium text-white">กำไรสุทธิ</span>
                    <span className={`text-xl font-bold ${(periodStats.week?.financial?.netProfit || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {(periodStats.week?.financial?.netProfit || 0) >= 0 ? '+' : ''}{(periodStats.week?.financial?.netProfit || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* This Month */}
              <div className="midnight-card p-4">
                <h4 className="text-sm font-medium text-[#94A3B8] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                  เดือนนี้
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#94A3B8]">ยอดแทงรวม</span>
                    <span className="text-lg font-bold text-[#3B82F6]">
                      {(periodStats.month?.financial?.totalBets || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#94A3B8]">ยอดถูกรางวัล</span>
                    <span className="text-lg font-bold text-[#F59E0B]">
                      -{(periodStats.month?.financial?.totalPayout || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#64748B]">ยอดฝาก/ถอน</span>
                    <span className="text-[#64748B]">
                      +{(periodStats.month?.financial?.totalDeposit || 0).toLocaleString()} / -{(periodStats.month?.financial?.totalWithdraw || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-[#334155] pt-2 flex justify-between items-center">
                    <span className="text-sm font-medium text-white">กำไรสุทธิ</span>
                    <span className={`text-xl font-bold ${(periodStats.month?.financial?.netProfit || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {(periodStats.month?.financial?.netProfit || 0) >= 0 ? '+' : ''}{(periodStats.month?.financial?.netProfit || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bet Type Summary - Midnight Blue Theme */}
      <Card className="midnight-section overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#EAB308] to-[#B8860B]">
              <Hash className="size-4 text-white" />
            </div>
            สรุปยอดตามประเภท
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {betTypes.map((type) => {
              const total = getTotalByBetType(type);
              const maxLimit = 50000; // Example limit for progress bar
              const percentage = Math.min((total / maxLimit) * 100, 100);
              return (
                <div 
                  key={type} 
                  className="midnight-card p-4 hover-lift"
                >
                  <Badge className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A] font-semibold mb-3">
                    {BET_TYPE_LABELS[type]}
                  </Badge>
                  <p className="text-2xl font-bold font-mono text-[#EAB308]">
                    {total.toLocaleString()}
                  </p>
                  <p className="text-xs text-[#94A3B8] mb-2">บาท</p>
                  {/* Progress bar showing ratio to limit */}
                  <div className="progress-gold h-1.5 mt-2">
                    <div 
                      className="progress-gold-bar" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary by Lottery */}
      {summaryByLottery.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Ticket className="size-5 text-accent" />
              ยอดแยกตามหวย
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {summaryByLottery.map((item) => (
                <div 
                  key={item.id} 
                  className="p-4 rounded-xl bg-secondary/50 border border-border/50 hover:border-accent/30 transition-colors"
                >
                  <p className="text-sm text-muted-foreground truncate">{item.name}</p>
                  <p className="text-xl font-bold font-mono text-accent">
                    {item.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.count} รายการ</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lottery Status */}
      {lotteries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Ticket className="size-5 text-accent" />
              สถานะหวยวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LotteryStatusList lotteries={lotteries} title="" />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-accent" />
              ยอดรายวัน (7 วันล่าสุด)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area 
                    type="monotone"
                    dataKey="amount" 
                    stroke="var(--chart-1)" 
                    strokeWidth={2}
                    fill="url(#colorAmount)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="size-12 mb-4 opacity-30" />
                <p>ยังไม่มีข้อมูล</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Numbers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Crown className="size-5 text-accent" />
                เลขยอดนิยมสูงสุด
              </CardTitle>
              <Link href="/analysis">
                <Button variant="outline" size="sm" className="gap-1">
                  <BarChart3 className="size-4" />
                  วิเคราะห์เพิ่ม
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topNumbers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>เลข</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead className="text-right">ยอดรวม</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topNumbers.slice(0, 5).map((item, index) => (
                      <TableRow key={`${item.number}-${item.betType}`}>
                        <TableCell>
                          {index < 3 ? (
                            <div className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-accent text-accent-foreground' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              'bg-amber-700 text-white'
                            }`}>
                              {index + 1}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono font-bold text-lg ${index === 0 ? 'text-accent' : ''}`}>
                            {item.number}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {BET_TYPE_LABELS[item.betType]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.count}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">
                          {item.totalAmount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                <Hash className="size-12 mb-4 opacity-30" />
                <p>ยังไม่มีข้อมูล</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
