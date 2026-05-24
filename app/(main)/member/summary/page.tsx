'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, 
  Users, Ticket, RefreshCw, Download, Calendar
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function MemberSummaryPage() {
  const { data, mutate, isLoading } = useSWR('/api/member/summary', fetcher);

  const summary = data || {
    totalSales: 0,
    totalWinnings: 0,
    totalCommission: 0,
    totalCustomers: 0,
    totalEntries: 0,
    netProfit: 0,
    todaySales: 0,
    todayWinnings: 0,
    weekSales: 0,
    monthSales: 0
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37]">สรุปยอด</h1>
          <p className="text-[#A0A0A0]">ภาพรวมยอดขายและรายได้ของคุณ</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm">
            <Download className="size-4 mr-2" />
            ส่งออก
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <DollarSign className="size-4" />
              ยอดขายรวม
            </div>
            <div className="text-2xl font-bold text-[#D4AF37]">{summary.totalSales.toLocaleString()}</div>
            <div className="text-xs text-[#666]">บาท</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <TrendingUp className="size-4 text-green-500" />
              ยอดถูกรางวัล
            </div>
            <div className="text-2xl font-bold text-green-500">{summary.totalWinnings.toLocaleString()}</div>
            <div className="text-xs text-[#666]">บาท</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <BarChart3 className="size-4 text-blue-500" />
              คอมมิชชั่น
            </div>
            <div className="text-2xl font-bold text-blue-500">{summary.totalCommission.toLocaleString()}</div>
            <div className="text-xs text-[#666]">บาท</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <Users className="size-4" />
              ลูกค้าทั้งหมด
            </div>
            <div className="text-2xl font-bold text-white">{summary.totalCustomers.toLocaleString()}</div>
            <div className="text-xs text-[#666]">คน</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <Ticket className="size-4" />
              รายการทั้งหมด
            </div>
            <div className="text-2xl font-bold text-white">{summary.totalEntries.toLocaleString()}</div>
            <div className="text-xs text-[#666]">รายการ</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              {summary.netProfit >= 0 ? (
                <TrendingUp className="size-4 text-green-500" />
              ) : (
                <TrendingDown className="size-4 text-red-500" />
              )}
              กำไรสุทธิ
            </div>
            <div className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {summary.netProfit >= 0 ? '+' : ''}{summary.netProfit.toLocaleString()}
            </div>
            <div className="text-xs text-[#666]">บาท</div>
          </CardContent>
        </Card>
      </div>

      {/* Period Tabs */}
      <Tabs defaultValue="today" className="space-y-4">
        <TabsList className="bg-[#1A1A1A]">
          <TabsTrigger value="today">วันนี้</TabsTrigger>
          <TabsTrigger value="week">สัปดาห์นี้</TabsTrigger>
          <TabsTrigger value="month">เดือนนี้</TabsTrigger>
          <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                  <Calendar className="size-5" />
                  สรุปยอดวันนี้
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg">
                  <span className="text-[#A0A0A0]">ยอดขาย</span>
                  <span className="text-[#D4AF37] font-bold">{summary.todaySales.toLocaleString()} บาท</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg">
                  <span className="text-[#A0A0A0]">ยอดถูกรางวัล</span>
                  <span className="text-green-500 font-bold">{summary.todayWinnings.toLocaleString()} บาท</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg">
                  <span className="text-[#A0A0A0]">กำไร/ขาดทุน</span>
                  <span className={`font-bold ${(summary.todaySales - summary.todayWinnings) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {(summary.todaySales - summary.todayWinnings) >= 0 ? '+' : ''}{(summary.todaySales - summary.todayWinnings).toLocaleString()} บาท
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-[#D4AF37]">สถานะ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg">
                  <span className="text-[#A0A0A0]">สถานะบัญชี</span>
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/30">ใช้งานปกติ</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg">
                  <span className="text-[#A0A0A0]">เครดิตคงเหลือ</span>
                  <span className="text-[#D4AF37] font-bold">10,000 บาท</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#0D0D0D] rounded-lg">
                  <span className="text-[#A0A0A0]">อัตราคอมมิชชั่น</span>
                  <span className="text-white font-bold">5%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="week">
          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader>
              <CardTitle className="text-[#D4AF37]">สรุปยอดสัปดาห์นี้</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-4xl font-bold text-[#D4AF37]">{summary.weekSales.toLocaleString()}</div>
                <div className="text-[#A0A0A0]">ยอดขายรวม (บาท)</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month">
          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader>
              <CardTitle className="text-[#D4AF37]">สรุปยอดเดือนนี้</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-4xl font-bold text-[#D4AF37]">{summary.monthSales.toLocaleString()}</div>
                <div className="text-[#A0A0A0]">ยอดขายรวม (บาท)</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader>
              <CardTitle className="text-[#D4AF37]">สรุปยอดทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-4xl font-bold text-[#D4AF37]">{summary.totalSales.toLocaleString()}</div>
                <div className="text-[#A0A0A0]">ยอดขายรวมทั้งหมด (บาท)</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
