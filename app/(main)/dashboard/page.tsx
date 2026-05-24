'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Ticket,
  RefreshCw,
  DollarSign,
  CreditCard,
  Banknote,
  PiggyBank,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function formatNumber(num: number): string {
  return new Intl.NumberFormat('th-TH').format(num);
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue',
  href,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple';
  href?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    red: 'bg-red-500/10 text-red-600',
    orange: 'bg-orange-500/10 text-orange-600',
    purple: 'bg-purple-500/10 text-purple-600',
  };

  const content = (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
            {trend && trendValue && (
              <div className="flex items-center gap-1 text-xs">
                {trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                ) : trend === 'down' ? (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                ) : null}
                <span className={trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'}>
                  {trendValue}
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

function PendingCard({
  title,
  count,
  amount,
  href,
  color = 'orange',
}: {
  title: string;
  count: number;
  amount: number;
  href: string;
  color?: 'orange' | 'blue' | 'red';
}) {
  const colorClasses = {
    orange: 'border-orange-200 bg-orange-50',
    blue: 'border-blue-200 bg-blue-50',
    red: 'border-red-200 bg-red-50',
  };

  return (
    <Link href={href}>
      <Card className={`${colorClasses[color]} hover:shadow-md transition-shadow cursor-pointer`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-lg font-bold">{count} รายการ</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(amount)} บาท</p>
            </div>
            <Badge variant="secondary" className="bg-white">
              รอดำเนินการ
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  
  const { data, isLoading, error, mutate } = useSWR('/api/dashboard/stats', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  const stats = data?.stats;
  const periodData = stats?.periods?.[period];

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-red-700">ไม่สามารถโหลดข้อมูลได้</p>
              <p className="text-sm text-red-600">{error.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => mutate()} className="ml-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              ลองใหม่
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            ภาพรวมระบบ FIN LOTTO
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          {stats?.lastUpdated && (
            <span className="text-xs text-muted-foreground">
              อัปเดตล่าสุด: {new Date(stats.lastUpdated).toLocaleTimeString('th-TH')}
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="ลูกค้าทั้งหมด"
              value={formatNumber(stats?.customers?.total || 0)}
              subValue={`ใหม่วันนี้ +${stats?.customers?.newToday || 0}`}
              icon={Users}
              color="blue"
              href="/customers"
            />
            <StatCard
              title="ยอดเครดิตลูกค้า"
              value={`${formatCurrency(stats?.customers?.totalBalance || 0)}`}
              subValue="บาท"
              icon={Wallet}
              color="purple"
              href="/customers"
            />
            <StatCard
              title="หวยเปิดรับ"
              value={stats?.lotteries?.active || 0}
              subValue="งวด"
              icon={Ticket}
              color="green"
              href="/lotteries"
            />
            <StatCard
              title="โพยวันนี้"
              value={formatNumber(stats?.bets?.total || 0)}
              subValue={`ถูก ${stats?.bets?.won || 0} | เสีย ${stats?.bets?.lost || 0} | รอ ${stats?.bets?.pending || 0}`}
              icon={CreditCard}
              color="orange"
              href="/bets"
            />
          </>
        )}
      </div>

      {/* Pending Actions */}
      {!isLoading && (stats?.financial?.pendingDeposits > 0 || stats?.financial?.pendingWithdraws > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats?.deposits?.pending + stats?.topups?.pending > 0 && (
            <PendingCard
              title="คำขอฝากเงินรอตรวจสอบ"
              count={stats?.deposits?.pending + stats?.topups?.pending}
              amount={(stats?.deposits?.totalAmount || 0) + (stats?.topups?.totalAmount || 0)}
              href="/topup-requests"
              color="orange"
            />
          )}
          {stats?.withdraws?.pending > 0 && (
            <PendingCard
              title="คำขอถอนเงินรอตรวจสอบ"
              count={stats?.withdraws?.pending}
              amount={stats?.withdraws?.totalAmount || 0}
              href="/withdraw-requests"
              color="red"
            />
          )}
        </div>
      )}

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">วันนี้</TabsTrigger>
          <TabsTrigger value="week">สัปดาห์นี้</TabsTrigger>
          <TabsTrigger value="month">เดือนนี้</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Financial Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      ยอดฝากรวม
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">
                      +{formatCurrency(periodData?.financial?.totalDeposit || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ฝาก {periodData?.deposits?.approved || 0} + เติม {periodData?.topups?.approved || 0} รายการ
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      ยอดถอนรวม
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-600">
                      -{formatCurrency(periodData?.financial?.totalWithdraw || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {periodData?.withdraws?.approved || 0} รายการ
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-orange-500" />
                      ยอดแทง / ถูกรางวัล
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatCurrency(periodData?.financial?.totalBets || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ถูกรางวัล {formatCurrency(periodData?.financial?.totalPayout || 0)} บาท
                    </p>
                  </CardContent>
                </Card>

                <Card className={(periodData?.financial?.netProfit || 0) >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <PiggyBank className="h-4 w-4" />
                      กำไรสุทธิ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-bold ${(periodData?.financial?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(periodData?.financial?.netProfit || 0) >= 0 ? '+' : ''}{formatCurrency(periodData?.financial?.netProfit || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      = ยอดแทง - ถูกรางวัล
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">การฝากเงิน</CardTitle>
                    <CardDescription>สลิป + เติมเงินโดยแอดมิน</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">รออนุมัติ</span>
                      <Badge variant="outline" className="bg-orange-50">
                        {(periodData?.deposits?.pending || 0) + (periodData?.topups?.pending || 0)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">อนุมัติแล้ว</span>
                      <Badge variant="outline" className="bg-green-50">
                        {(periodData?.deposits?.approved || 0) + (periodData?.topups?.approved || 0)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">ยอดรวม</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(periodData?.financial?.totalDeposit || 0)} บาท
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">การถอนเงิน</CardTitle>
                    <CardDescription>คำขอถอนจากลูกค้า</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">รออนุมัติ</span>
                      <Badge variant="outline" className="bg-orange-50">
                        {periodData?.withdraws?.pending || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">อนุมัติแล้ว</span>
                      <Badge variant="outline" className="bg-green-50">
                        {periodData?.withdraws?.approved || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">ยอดรวม</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(periodData?.financial?.totalWithdraw || 0)} บาท
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">การแทงหวย</CardTitle>
                    <CardDescription>ยอดแทงและถูกรางวัล</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">ยอดแทงรวม</span>
                      <span className="font-semibold">
                        {formatCurrency(periodData?.financial?.totalBets || 0)} บาท
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">จ่ายรางวัล</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(periodData?.financial?.totalPayout || 0)} บาท
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">กำไร</span>
                      <span className={`font-semibold ${(periodData?.financial?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(periodData?.financial?.netProfit || 0)} บาท
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ทางลัด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link href="/customers">
                <Users className="h-5 w-5" />
                <span className="text-xs">ลูกค้า</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link href="/topup-requests">
                <TrendingUp className="h-5 w-5" />
                <span className="text-xs">คำขอเติมเงิน</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link href="/withdraw-requests">
                <TrendingDown className="h-5 w-5" />
                <span className="text-xs">คำขอถอนเงิน</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link href="/bets">
                <Ticket className="h-5 w-5" />
                <span className="text-xs">รายการแทง</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link href="/result-announcement">
                <Clock className="h-5 w-5" />
                <span className="text-xs">ออกผล</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1">
              <Link href="/reports">
                <DollarSign className="h-5 w-5" />
                <span className="text-xs">รายงาน</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
