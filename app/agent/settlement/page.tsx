'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Ticket,
  Calculator,
  ArrowUpRight,
  Send,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentSettlementPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const today = new Date().toISOString().split('T')[0];

  // ดึงข้อมูลยอดส่ง
  const { data: settlementData, mutate } = useSWR(
    `/api/agent/settlement?period=daily`,
    fetcher,
    { refreshInterval: 60000 }
  );

  const summary = settlementData?.summary || {};
  const history = settlementData?.history || [];

  const menuItems = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', href: '/agent/dashboard' },
    { icon: Ticket, label: 'รายการโพย', href: '/agent/entries' },
    { icon: Calculator, label: 'กำไร/ขาดทุน', href: '/agent/profit' },
    { icon: ArrowUpRight, label: 'ส่งยอด', href: '/agent/settlement', active: true },
    { icon: Users, label: 'พนักงาน', href: '/agent/staff' },
    { icon: Settings, label: 'ตั้งค่า', href: '/agent/settings' },
  ];

  const handleSettlement = async () => {
    toast({
      title: 'ส่งยอดสำเร็จ',
      description: 'ยอดถูกส่งไปยังเว็บกลางแล้ว',
    });
    mutate();
  };

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-amber-600">ส่งยอด</h2>
            <p className="text-muted-foreground">ส่งยอดเงินให้เว็บกลาง</p>
          </div>
        </div>

        {/* Current Settlement */}
        <Card className="mb-6 border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="size-5 text-amber-500" />
              ยอดที่ต้องส่งวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">ยอดขายรวม</p>
                <p className="text-2xl font-bold">{(summary.total_sales || 0).toLocaleString()} บ.</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600">ส่วนของคุณ (90%)</p>
                <p className="text-2xl font-bold text-green-600">+{(summary.agent_share || 0).toLocaleString()} บ.</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-orange-600">ต้องส่งเว็บกลาง (10%)</p>
                <p className="text-2xl font-bold text-orange-600">{(summary.platform_share || 0).toLocaleString()} บ.</p>
              </div>
            </div>

            <Button 
              onClick={handleSettlement}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2"
              disabled={!summary.platform_share}
            >
              <Send className="size-4" />
              ส่งยอด {(summary.platform_share || 0).toLocaleString()} บาท
            </Button>
          </CardContent>
        </Card>

        {/* Settlement History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5 text-amber-500" />
              ประวัติการส่งยอด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Send className="size-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีประวัติการส่งยอด</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{new Date(item.date).toLocaleDateString('th-TH')}</p>
                      <p className="text-sm text-muted-foreground">{item.lottery_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{item.amount.toLocaleString()} บ.</p>
                      <Badge className={item.status === 'completed' ? 'bg-green-500/20 text-green-600' : 'bg-yellow-500/20 text-yellow-600'}>
                        {item.status === 'completed' ? (
                          <><CheckCircle className="size-3 mr-1" />ส่งแล้ว</>
                        ) : (
                          <><Clock className="size-3 mr-1" />รอดำเนินการ</>
                        )}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
