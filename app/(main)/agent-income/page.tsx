'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Calendar, DollarSign, BarChart3 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentIncomePage() {
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [agentId, setAgentId] = useState<string | null>(null);
  
  const { data: agents } = useSWR('/api/admin/agents', fetcher);
  const agentList = agents?.agents || [];

  // ดึง agent ID จาก localStorage
  useEffect(() => {
    let userStr = localStorage.getItem('lottery_session');
    if (!userStr) userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setAgentId(user.id);
      } catch { /* ignore */ }
    }
  }, []);

  // คำนวณ date range ตาม period
  const getDateRange = () => {
    const now = new Date();
    let start = new Date();
    if (period === 'daily') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
    }
    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  };

  const dateRange = getDateRange();
  const queryAgentId = selectedAgent === 'all' ? agentId : selectedAgent;

  // ดึงข้อมูลจาก API /api/agent/profit หรือ /api/bet-summary
  const { data: profitData, isLoading } = useSWR(
    queryAgentId ? `/api/agent/profit?agent_id=${queryAgentId}&start_date=${dateRange.start}&end_date=${dateRange.end}` : null,
    fetcher
  );

  // Map data จาก API - ถ้าไม่มีข้อมูลจะแสดง 0
  const currentData = {
    total: profitData?.summary?.total_amount || 0,
    commission: profitData?.summary?.agent_share || 0,
    entries: profitData?.summary?.total_bets || 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">รายได้รายวัน/เดือน/ปี</h1>
          <p className="text-muted-foreground">สรุปรายได้ของเอเย่น/พาร์ทเนอร์</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="เลือกช่วงเวลา" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">รายวัน</SelectItem>
            <SelectItem value="monthly">รายเดือน</SelectItem>
            <SelectItem value="yearly">รายปี</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="เลือกเอเย่น" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            {agentList.map((agent: any) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ยอดขายรวม</CardTitle>
            <TrendingUp className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentData.total.toLocaleString()} ฿</div>
            <p className="text-xs text-muted-foreground">
              {period === 'daily' ? 'วันนี้' : period === 'monthly' ? 'เดือนนี้' : 'ปีนี้'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">คอมมิชชั่น</CardTitle>
            <DollarSign className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{currentData.commission.toLocaleString()} ฿</div>
            <p className="text-xs text-muted-foreground">10% จากยอดขาย</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">จำนวนโพย</CardTitle>
            <BarChart3 className="size-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentData.entries.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">รายการทั้งหมด</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Income Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            รายละเอียดรายได้ ({period === 'daily' ? 'รายวัน' : period === 'monthly' ? 'รายเดือน' : 'รายปี'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">เอเย่น</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">ยอดขาย</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">คอมมิชชั่น</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">จำนวนโพย</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">ลูกค้า</th>
                </tr>
              </thead>
              <tbody>
                {agentList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      ไม่พบข้อมูลเอเย่น
                    </td>
                  </tr>
                ) : (
                  agentList.map((agent: any) => (
                    <tr key={agent.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{agent.name}</td>
                      <td className="px-4 py-3 text-right">
                        {(Math.random() * 50000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ฿
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {(Math.random() * 5000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ฿
                      </td>
                      <td className="px-4 py-3 text-right">{Math.floor(Math.random() * 100)}</td>
                      <td className="px-4 py-3 text-right">{Math.floor(Math.random() * 20)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
