'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Ticket,
  Calculator,
  ArrowUpRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentProfitPage() {
  const { user, logout } = useAuth();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [lotteryId, setLotteryId] = useState<string>('all');

  // ดึงข้อมูลกำไร
  const { data: profitData, isLoading } = useSWR(
    `/api/agent/profit?start_date=${startDate}&end_date=${endDate}${lotteryId !== 'all' ? `&lottery_id=${lotteryId}` : ''}`,
    fetcher
  );

  // ดึงรายชื่อหวย
  const { data: lotteries } = useSWR('/api/lotteries', fetcher);

  const summary = profitData?.summary || {};
  const details = profitData?.details || [];

  const menuItems = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', href: '/agent/dashboard' },
    { icon: Ticket, label: 'รายการโพย', href: '/agent/entries' },
    { icon: Calculator, label: 'กำไร/ขาดทุน', href: '/agent/profit', active: true },
    { icon: ArrowUpRight, label: 'ส่งยอด', href: '/agent/settlement' },
    { icon: Users, label: 'พนักงาน', href: '/agent/staff' },
    { icon: Settings, label: 'ตั้งค่า', href: '/agent/settings' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0D1321] border-r border-white/10 p-4 flex flex-col">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-amber-400">ร้านหวย</h1>
          <p className="text-sm text-white/60">{user?.name || 'เอเย่น'}</p>
          <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
            กำไร 90%
          </Badge>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                item.active
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <Button 
          variant="ghost" 
          onClick={() => logout()}
          className="mt-auto text-white/60 hover:text-white justify-start gap-3"
        >
          <LogOut className="size-5" />
          ออกจากระบบ
        </Button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-[#f8f5f0]">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-amber-600">กำไร/ขาดทุน</h2>
          <p className="text-muted-foreground">สรุปยอดกำไรขาดทุนของร้าน</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">วันที่เริ่ม</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">วันที่สิ้นสุด</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">หวย</label>
                <Select value={lotteryId} onValueChange={setLotteryId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="เลือกหวย" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {lotteries?.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-[#0D1321] text-white border-0">
            <CardContent className="p-4">
              <p className="text-white/60 text-sm">ยอดขายรวม</p>
              <p className="text-2xl font-bold">{(summary.total_amount || 0).toLocaleString()}</p>
              <p className="text-white/40 text-xs">{summary.total_bets || 0} รายการ</p>
            </CardContent>
          </Card>

          <Card className="bg-[#0D1321] text-white border-0">
            <CardContent className="p-4">
              <p className="text-white/60 text-sm">จ่ายรางวัล</p>
              <p className="text-2xl font-bold text-red-400">-{(summary.total_payout || 0).toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className={`border-0 ${summary.total_profit >= 0 ? 'bg-green-600' : 'bg-red-600'} text-white`}>
            <CardContent className="p-4">
              <p className="text-white/80 text-sm">กำไร/ขาดทุนสุทธิ</p>
              <p className="text-2xl font-bold">
                {summary.total_profit >= 0 ? '+' : ''}{(summary.total_profit || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-amber-500 text-white border-0">
            <CardContent className="p-4">
              <p className="text-amber-100 text-sm">ส่วนแบ่งของคุณ ({summary.share_percent || 90}%)</p>
              <p className="text-2xl font-bold">{(summary.agent_total_share || 0).toLocaleString()}</p>
              <p className="text-amber-100 text-xs">ส่งเว็บกลาง: {(summary.master_total_share || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Details Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="size-5 text-amber-500" />
              รายละเอียดแยกตามหวย
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
            ) : details.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr className="text-left text-muted-foreground text-sm">
                      <th className="p-3">วันที่</th>
                      <th className="p-3">หวย</th>
                      <th className="p-3 text-right">รายการ</th>
                      <th className="p-3 text-right">ยอดขาย</th>
                      <th className="p-3 text-right">จ่ายรางวัล</th>
                      <th className="p-3 text-right">กำไร/ขาดทุน</th>
                      <th className="p-3 text-right">ส่วนของคุณ</th>
                      <th className="p-3 text-right">ส่งเว็บกลาง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {details.map((item: any, index: number) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-muted-foreground" />
                            {new Date(item.date).toLocaleDateString('th-TH')}
                          </div>
                        </td>
                        <td className="p-3 font-medium text-amber-600">{item.lottery_name}</td>
                        <td className="p-3 text-right">{item.total_bets}</td>
                        <td className="p-3 text-right">{item.total_amount.toLocaleString()}</td>
                        <td className="p-3 text-right text-red-500">-{item.total_payout.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <span className={item.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {item.profit >= 0 ? '+' : ''}{item.profit.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3 text-right font-medium text-green-600">
                          {item.agent_share.toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-orange-500">
                          {item.master_share.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
