'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  FileText,
  Settings,
  LogOut,
  Ticket,
  Calculator,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Mock agent ID - ในระบบจริงจะมาจาก session/auth
const MOCK_AGENT_ID = '7cf23d72-858d-4395-9b94-67e7a7ca821f';

export default function AgentDashboard() {
  const today = new Date().toISOString().split('T')[0];
  
  // ดึงข้อมูล entries ของเอเย่น
  const { data: entriesData } = useSWR(
    `/api/agent/entries?agent_id=${MOCK_AGENT_ID}&date=${today}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // ดึงข้อมูลกำไร
  const { data: profitData } = useSWR(
    `/api/agent/profit?agent_id=${MOCK_AGENT_ID}&start_date=${today}&end_date=${today}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  // ดึงข้อมูลยอดส่ง
  const { data: settlementData } = useSWR(
    `/api/agent/settlement?agent_id=${MOCK_AGENT_ID}&period=daily`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const stats = entriesData?.stats || {};
  const summary = profitData?.summary || {};
  const settlement = settlementData?.summary || {};
  const agent = settlementData?.agent || {};

  const menuItems = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', href: '/dashboard', active: true },
    { icon: Ticket, label: 'รายการโพย', href: '/entries' },
    { icon: Calculator, label: 'กำไร/ขาดทุน', href: '/profit' },
    { icon: ArrowUpRight, label: 'ส่งยอด', href: '/settlement' },
    { icon: Users, label: 'พนักงาน', href: '/staff' },
    { icon: Settings, label: 'ตั้งค่า', href: '/settings' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0D1321] border-r border-white/10 p-4 flex flex-col">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-amber-400">ร้านหวย</h1>
          <p className="text-sm text-white/60">{agent.name || 'เอเย่น'}</p>
          <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
            กำไร {agent.share_percent || 90}%
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

        <Button variant="ghost" className="mt-auto text-white/60 hover:text-white justify-start gap-3">
          <LogOut className="size-5" />
          ออกจากระบบ
        </Button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-[#f8f5f0]">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-amber-600">แดชบอร์ด</h2>
          <p className="text-muted-foreground">ภาพรวมร้านหวยวันนี้</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">ยอดขายวันนี้</p>
                  <p className="text-2xl font-bold">{(stats.totalAmount || 0).toLocaleString()}</p>
                  <p className="text-amber-100 text-xs">{stats.total || 0} รายการ</p>
                </div>
                <DollarSign className="size-10 text-amber-200/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0D1321] text-white border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">กำไร/ขาดทุน</p>
                  <p className={`text-2xl font-bold ${summary.total_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {summary.total_profit >= 0 ? '+' : ''}{(summary.total_profit || 0).toLocaleString()}
                  </p>
                  <p className="text-white/40 text-xs">ส่วนแบ่งคุณ: {(summary.agent_total_share || 0).toLocaleString()}</p>
                </div>
                {summary.total_profit >= 0 ? (
                  <TrendingUp className="size-10 text-green-400/50" />
                ) : (
                  <TrendingDown className="size-10 text-red-400/50" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0D1321] text-white border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">ต้องส่งเว็บกลาง</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {(settlement.master_share || 0).toLocaleString()}
                  </p>
                  <p className="text-white/40 text-xs">{agent.master_share_percent || 10}% ของกำไร</p>
                </div>
                <ArrowUpRight className="size-10 text-orange-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0D1321] text-white border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">สถานะโพย</p>
                  <div className="flex gap-2 mt-1">
                    <Badge className="bg-yellow-500/20 text-yellow-400">
                      <Clock className="size-3 mr-1" />
                      {stats.pending || 0}
                    </Badge>
                    <Badge className="bg-green-500/20 text-green-400">
                      <CheckCircle className="size-3 mr-1" />
                      {stats.won || 0}
                    </Badge>
                    <Badge className="bg-red-500/20 text-red-400">
                      <XCircle className="size-3 mr-1" />
                      {stats.lost || 0}
                    </Badge>
                  </div>
                </div>
                <FileText className="size-10 text-white/20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ทางลัด</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Link href="/manual-key">
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                  <Ticket className="size-4 mr-2" />
                  คีย์หวย
                </Button>
              </Link>
              <Link href="/entries">
                <Button variant="outline" className="w-full">
                  <FileText className="size-4 mr-2" />
                  ดูรายการ
                </Button>
              </Link>
              <Link href="/profit">
                <Button variant="outline" className="w-full">
                  <Calculator className="size-4 mr-2" />
                  สรุปกำไร
                </Button>
              </Link>
              <Link href="/settlement">
                <Button variant="outline" className="w-full">
                  <ArrowUpRight className="size-4 mr-2" />
                  ส่งยอด
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">สรุปส่วนแบ่ง</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">ยอดขายรวม</span>
                  <span className="font-bold">{(summary.total_amount || 0).toLocaleString()} บ.</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">จ่ายรางวัล</span>
                  <span className="font-bold text-red-500">-{(summary.total_payout || 0).toLocaleString()} บ.</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">กำไรสุทธิ</span>
                  <span className={`font-bold ${summary.total_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {(summary.total_profit || 0).toLocaleString()} บ.
                  </span>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span>ส่วนของคุณ ({agent.share_percent || 90}%)</span>
                    <span className="font-bold text-green-500">{(summary.agent_total_share || 0).toLocaleString()} บ.</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span>ส่งเว็บกลาง ({agent.master_share_percent || 10}%)</span>
                    <span className="font-bold text-orange-500">{(summary.master_total_share || 0).toLocaleString()} บ.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
