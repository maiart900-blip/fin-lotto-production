'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  BarChart3,
  Wallet,
  List,
  Crown,
  Network
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AutoStats {
  totalAgents: number;
  activeAgents: number;
  totalCustomers: number;
  activeCustomers: number;
  todayEntries: number;
  todayAmount: number;
  todayWinnings: number;
  todayProfit: number;
  pendingPayouts: number;
  pendingCount: number;
  monthlyStats: {
    entries: number;
    amount: number;
    profit: number;
  };
}

interface RecentEntry {
  id: string;
  customer_name: string;
  lottery_name: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function AutoSystemPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data: stats, mutate: refreshStats } = useSWR<AutoStats>(
    '/api/auto-system/stats',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  const { data: recentEntries } = useSWR<RecentEntry[]>(
    '/api/auto-system/recent-entries',
    fetcher,
    { refreshInterval: 10000 }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshStats();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const profitPercent = stats && stats.todayAmount > 0 
    ? ((stats.todayProfit / stats.todayAmount) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#0F172A]">
            <Zap className="h-6 w-6 text-[#EAB308]" />
            ระบบออโต้
          </h1>
          <p className="text-[#64748B]">ภาพรวมระบบหวยออโต้ทั้งหมด - Real-time Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#EAB308] text-[#EAB308]">
            <Activity className="h-3 w-3 mr-1 animate-pulse" />
            Live
          </Badge>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-[#EAB308] text-[#B8860B] hover:bg-[rgba(234,179,8,0.1)]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">เอเย่นออโต้</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalAgents || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">{stats?.activeAgents || 0} ใช้งาน</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ลูกค้าออโต้</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">{stats?.activeCustomers || 0} ใช้งานวันนี้</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ยอดแทงวันนี้</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.todayAmount || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.todayEntries || 0} รายการ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">กำไรวันนี้</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(stats?.todayProfit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(stats?.todayProfit || 0)}
            </div>
            <p className="text-xs text-muted-foreground flex items-center">
              {(stats?.todayProfit || 0) >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
              )}
              {profitPercent}% margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second Row Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ยอดจ่ายรางวัล</CardTitle>
            <Wallet className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -{formatCurrency(stats?.todayWinnings || 0)}
            </div>
            <p className="text-xs text-muted-foreground">ถูกรางวัลวันนี้</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">รอจ่ายรางวัล</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats?.pendingPayouts || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingCount || 0} รายการรอดำเนินการ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ยอดเดือนนี้</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.monthlyStats?.amount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              กำไร: <span className={`font-medium ${(stats?.monthlyStats?.profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(stats?.monthlyStats?.profit || 0)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">รายการล่าสุด</TabsTrigger>
          <TabsTrigger value="activity">กิจกรรม</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">รายการแทงล่าสุด</CardTitle>
              <CardDescription>อัพเดททุก 10 วินาที</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEntries && recentEntries.length > 0 ? (
                <div className="space-y-3">
                  {recentEntries.map((entry) => (
                    <div 
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          entry.status === 'won' ? 'bg-green-100 text-green-600' :
                          entry.status === 'lost' ? 'bg-red-100 text-red-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {entry.status === 'won' ? <CheckCircle className="h-4 w-4" /> :
                           entry.status === 'lost' ? <XCircle className="h-4 w-4" /> :
                           <Clock className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium">{entry.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{entry.lottery_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(entry.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleTimeString('th-TH')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มีรายการวันนี้</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">กิจกรรมระบบ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">ระบบออโต้ทำงานปกติ</p>
                    <p className="text-sm text-green-600 dark:text-green-400">อัพเดทล่าสุด: {new Date().toLocaleTimeString('th-TH')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <Zap className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">Auto Payout พร้อมใช้งาน</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">จ่ายรางวัลอัตโนมัติเปิดใช้งาน</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card className="bg-white border-[rgba(234,179,8,0.2)]">
        <CardHeader>
          <CardTitle className="text-lg text-[#B8860B]">การดำเนินการด่วน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 border-[rgba(234,179,8,0.3)] hover:bg-[rgba(234,179,8,0.1)] hover:border-[#EAB308]" asChild>
              <a href="/auto-system/entries">
                <List className="h-5 w-5 text-[#EAB308]" />
                <span className="text-[#0F172A]">รายการทั้งหมด</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 border-[rgba(234,179,8,0.3)] hover:bg-[rgba(234,179,8,0.1)] hover:border-[#EAB308]" asChild>
              <a href="/auto-system/customers">
                <Users className="h-5 w-5 text-[#EAB308]" />
                <span className="text-[#0F172A]">จัดการลูกค้า</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 border-[rgba(234,179,8,0.3)] hover:bg-[rgba(234,179,8,0.1)] hover:border-[#EAB308]" asChild>
              <a href="/auto-agents">
                <Users className="h-5 w-5 text-[#EAB308]" />
                <span className="text-[#0F172A]">จัดการเอเย่นต์</span>
              </a>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 border-[rgba(234,179,8,0.3)] hover:bg-[rgba(234,179,8,0.1)] hover:border-[#EAB308]" asChild>
              <a href="/auto-system/settings">
                <Settings className="h-5 w-5 text-[#EAB308]" />
                <span className="text-[#0F172A]">ตั้งค่าระบบ</span>
              </a>
            </Button>
            <Button className="h-auto py-4 flex flex-col gap-2 premium-gold-btn" asChild>
              <a href="/master/agent-network">
                <Crown className="h-5 w-5" />
                <span>Master Control</span>
              </a>
            </Button>
            <Button className="h-auto py-4 flex flex-col gap-2 bg-gradient-to-b from-[#1E293B] to-[#0F172A] text-white hover:from-[#334155] hover:to-[#1E293B]" asChild>
              <a href="/master/agent-report">
                <BarChart3 className="h-5 w-5" />
                <span>รายงานสายงาน</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
