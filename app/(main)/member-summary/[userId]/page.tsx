'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ArrowLeft,
  User,
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  Trophy,
  Crown,
  Loader2,
  Infinity,
  Calendar,
  Hash,
  DollarSign,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useAuth } from '@/hooks/use-auth';
import { USER_ROLE_LABELS, BET_TYPE_LABELS } from '@/types/lottery';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
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

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default function MemberDetailPage({ params }: PageProps) {
  const { userId } = use(params);
  const { isSuperAdmin, isAdmin } = useAuth();

  const { data, isLoading, error } = useSWR(
    `/api/member-summary/${userId}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <User className="size-16 text-amber-500" />
        <h2 className="text-xl font-semibold">ไม่มีสิทธิ์เข้าถึง</h2>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !data || !data.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <User className="size-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">ไม่พบข้อมูลสมาชิก</h2>
        <Link href="/member-summary">
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />
            กลับ
          </Button>
        </Link>
      </div>
    );
  }

  const { user: memberUser, parent, customers, stats, recentEntries, recentWinnings, creditHistory, dailyProfitLoss, topCustomers, topNumbers } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/member-summary">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <User className="size-7 text-accent" />
              {memberUser.displayName}
            </h1>
            <p className="text-muted-foreground mt-1">@{memberUser.username}</p>
          </div>
        </div>
        <Badge variant="outline" className={`${ROLE_COLORS[memberUser.role]} text-lg px-4 py-2`}>
          {USER_ROLE_LABELS[memberUser.role as keyof typeof USER_ROLE_LABELS] || memberUser.role}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Users className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ลูกค้าใต้สาย</p>
                <p className="text-2xl font-bold">{stats.customerCount}</p>
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
                <p className="text-sm text-muted-foreground">เครดิตคงเหลือ</p>
                {memberUser.isUnlimitedCredit ? (
                  <p className="text-xl font-bold flex items-center gap-1 text-purple-400">
                    <Infinity className="size-5" />
                    Unlimited
                  </p>
                ) : (
                  <p className="text-2xl font-bold">{memberUser.creditBalance.toLocaleString()}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/20">
                <TrendingUp className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ยอดแทงรวม</p>
                <p className="text-2xl font-bold">{stats.totalBets.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${stats.isProfit ? 'from-emerald-500/20 via-emerald-500/10 border-emerald-500/30' : 'from-red-500/20 via-red-500/10 border-red-500/30'} to-transparent`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${stats.isProfit ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {stats.isProfit ? (
                  <TrendingUp className="size-5 text-emerald-500" />
                ) : (
                  <TrendingDown className="size-5 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stats.isProfit ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}</p>
                <p className={`text-2xl font-bold ${stats.isProfit ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.isProfit ? '+' : '-'}{Math.abs(stats.netProfit).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parent Info */}
      {parent && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Crown className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">หัวสาย / Parent</p>
                <p className="font-medium">{parent.display_name} (@{parent.username})</p>
              </div>
              <Badge variant="outline" className={ROLE_COLORS[parent.role]}>
                {USER_ROLE_LABELS[parent.role as keyof typeof USER_ROLE_LABELS] || parent.role}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Profit/Loss Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5 text-accent" />
            กำไร/ขาดทุนรายวัน (30 วันล่าสุด)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyProfitLoss && dailyProfitLoss.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={[...dailyProfitLoss].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af" 
                  fontSize={12}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  formatter={(value: number) => [value.toLocaleString() + ' บาท']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="กำไร/ขาดทุน" dot={{ fill: '#10b981' }} />
                <Line type="monotone" dataKey="bets" stroke="#f59e0b" strokeWidth={2} name="ยอดแทง" dot={{ fill: '#f59e0b' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              ยังไม่มีข้อมูล
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="customers">ลูกค้า</TabsTrigger>
          <TabsTrigger value="entries">ประวัติซื้อ</TabsTrigger>
          <TabsTrigger value="winnings">ถูกรางวัล</TabsTrigger>
          <TabsTrigger value="credits">เครดิต</TabsTrigger>
          <TabsTrigger value="top">Top 10</TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-accent" />
                รายชื่อลูกค้าใต้สาย ({customers?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customers && customers.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead>เบอร์โทร</TableHead>
                        <TableHead className="text-right">เครดิต</TableHead>
                        <TableHead>วันที่สมัคร</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer: { id: string; name: string; phone: string; credit_balance: number; created_at: string }) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.phone || '-'}</TableCell>
                          <TableCell className="text-right">{(customer.credit_balance || 0).toLocaleString()}</TableCell>
                          <TableCell>{new Date(customer.created_at).toLocaleDateString('th-TH')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">ยังไม่มีลูกค้า</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entries Tab */}
        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-accent" />
                ประวัติซื้อหวยล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEntries && recentEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เลข</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead className="text-right">จำนวนเงิน</TableHead>
                        <TableHead>ลูกค้า</TableHead>
                        <TableHead>หวย</TableHead>
                        <TableHead>วันที่</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentEntries.map((entry: { id: string; number: string; bet_type: string; amount: number; customer: { name: string } | null; lottery: { name: string } | null; created_at: string }) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono font-bold text-accent">{entry.number}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {BET_TYPE_LABELS[entry.bet_type as keyof typeof BET_TYPE_LABELS] || entry.bet_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{entry.amount.toLocaleString()}</TableCell>
                          <TableCell>{entry.customer?.name || '-'}</TableCell>
                          <TableCell>{entry.lottery?.name || '-'}</TableCell>
                          <TableCell>{new Date(entry.created_at).toLocaleDateString('th-TH')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">ยังไม่มีประวัติ</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Winnings Tab */}
        <TabsContent value="winnings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-accent" />
                ประวัติถูกรางวัล
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentWinnings && recentWinnings.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เลข</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead className="text-right">ยอดจ่าย</TableHead>
                        <TableHead>ลูกค้า</TableHead>
                        <TableHead>วันที่</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentWinnings.map((win: { id: string; payout_amount: number; entry: { number: string; bet_type: string; customer: { name: string } | null } | null; created_at: string }) => (
                        <TableRow key={win.id}>
                          <TableCell className="font-mono font-bold text-green-500">{win.entry?.number || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                              {BET_TYPE_LABELS[win.entry?.bet_type as keyof typeof BET_TYPE_LABELS] || win.entry?.bet_type || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-500">+{win.payout_amount.toLocaleString()}</TableCell>
                          <TableCell>{win.entry?.customer?.name || '-'}</TableCell>
                          <TableCell>{new Date(win.created_at).toLocaleDateString('th-TH')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">ยังไม่มีประวัติถูกรางวัล</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-5 text-accent" />
                ประวัติเครดิต
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditHistory && creditHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ประเภท</TableHead>
                        <TableHead className="text-right">จำนวน</TableHead>
                        <TableHead>ลูกค้า</TableHead>
                        <TableHead>วันที่</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditHistory.map((credit: { id: string; type: string; amount: number; customer: { name: string } | null; created_at: string }) => (
                        <TableRow key={credit.id}>
                          <TableCell>
                            <Badge variant="outline" className={credit.type === 'deposit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                              {credit.type === 'deposit' ? 'เติมเครดิต' : credit.type === 'withdraw' ? 'ถอนเครดิต' : credit.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${credit.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                            {credit.type === 'deposit' ? '+' : '-'}{Math.abs(credit.amount).toLocaleString()}
                          </TableCell>
                          <TableCell>{credit.customer?.name || '-'}</TableCell>
                          <TableCell>{new Date(credit.created_at).toLocaleDateString('th-TH')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">ยังไม่มีประวัติ</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top 10 Tab */}
        <TabsContent value="top">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="size-5 text-accent" />
                  Top 10 ลูกค้าเล่นเยอะสุด
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topCustomers && topCustomers.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topCustomers} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={80} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        formatter={(value: number) => [value.toLocaleString() + ' บาท']}
                      />
                      <Bar dataKey="totalBets" fill="#f59e0b" name="ยอดแทง" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    ยังไม่มีข้อมูล
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Numbers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="size-5 text-accent" />
                  Top 10 เลขที่เล่นเยอะสุด
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topNumbers && topNumbers.length > 0 ? (
                  <div className="space-y-2">
                    {topNumbers.map((num: { number: string; betType: string; totalBets: number; count: number }, index: number) => (
                      <div key={`${num.number}-${num.betType}`} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-muted/50'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold ${index === 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>#{index + 1}</span>
                          <span className="font-mono font-bold text-lg text-accent">{num.number}</span>
                          <Badge variant="outline">{BET_TYPE_LABELS[num.betType as keyof typeof BET_TYPE_LABELS] || num.betType}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{num.totalBets.toLocaleString()} บาท</p>
                          <p className="text-xs text-muted-foreground">{num.count} โพย</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    ยังไม่มีข้อมูล
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
