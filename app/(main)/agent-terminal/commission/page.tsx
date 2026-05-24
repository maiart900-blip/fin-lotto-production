'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Calculator, 
  Calendar, 
  Download,
  ChevronLeft,
  Clock,
  Wallet,
  PieChart,
  BarChart3,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CommissionEntry {
  id: string;
  date: string;
  lotteryName: string;
  totalBets: number;
  commissionRate: number;
  commissionAmount: number;
  netPayable: number;
  betCount: number;
  status: 'settled' | 'pending';
}

interface DailySummary {
  date: string;
  totalBets: number;
  totalCommission: number;
  netPayable: number;
  betCount: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CommissionSummaryPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [agentId, setAgentId] = useState<string | null>(null);

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
    if (selectedPeriod === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (selectedPeriod === 'week') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  };

  const dateRange = getDateRange();

  // ดึงข้อมูลจาก API
  const { data: profitData } = useSWR(
    agentId ? `/api/agent/profit?agent_id=${agentId}&start_date=${dateRange.start}&end_date=${dateRange.end}` : null,
    fetcher
  );

  const { data: entriesData } = useSWR(
    agentId ? `/api/agent/entries?agent_id=${agentId}` : null,
    fetcher
  );

  // Map entries data จาก API - ถ้าไม่มีข้อมูลจะแสดง empty array
  const entries: CommissionEntry[] = (entriesData?.entries || []).map((e: any) => ({
    id: e.id,
    date: e.created_at?.split('T')[0] || '',
    lotteryName: e.lottery_name || 'Unknown',
    totalBets: e.total_amount || 0,
    commissionRate: 20,
    commissionAmount: (e.total_amount || 0) * 0.2,
    netPayable: (e.total_amount || 0) * 0.8,
    betCount: 1,
    status: e.status === 'settled' ? 'settled' : 'pending' as const,
  }));

  // Filter entries by period
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter(e => e.date === today);
  const displayEntries = selectedPeriod === 'today' ? todayEntries : entries;

  // Calculate totals
  const totals = displayEntries.reduce((acc, entry) => ({
    totalBets: acc.totalBets + entry.totalBets,
    totalCommission: acc.totalCommission + entry.commissionAmount,
    totalNet: acc.totalNet + entry.netPayable,
    totalCount: acc.totalCount + entry.betCount,
  }), { totalBets: 0, totalCommission: 0, totalNet: 0, totalCount: 0 });

  // Weekly summary จาก profitData
  const weeklyData: DailySummary[] = (profitData?.daily || []).map((d: any) => ({
    date: d.date,
    totalBets: d.total_amount || 0,
    totalCommission: d.agent_share || 0,
    netPayable: (d.total_amount || 0) - (d.agent_share || 0),
    betCount: d.total_bets || 0,
  }));

  // Weekly totals
  const weeklyTotals = weeklyData.reduce((acc, day) => ({
    totalBets: acc.totalBets + day.totalBets,
    totalCommission: acc.totalCommission + day.totalCommission,
    totalNet: acc.totalNet + day.netPayable,
  }), { totalBets: 0, totalCommission: 0, totalNet: 0 });

  // Find max for chart scaling
  const maxBets = Math.max(...weeklyData.map(d => d.totalBets), 1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/agent-terminal">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <ChevronLeft className="size-4 mr-1" />
            กลับ
          </Button>
        </Link>
        <div className="flex-1">
          <h1 
            className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-300"
            style={{ textShadow: '0 0 20px rgba(16,185,129,0.3)' }}
          >
            สรุปคอมมิชชัน
          </h1>
          <p className="text-slate-500 text-xs">อัตราค่าคอม: {COMMISSION_RATE}% หักอัตโนมัติจากยอดแทง</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
        >
          <Download className="size-4 mr-2" />
          ดาวน์โหลด
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <BarChart3 className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">ยอดแทงรวม</p>
                <p className="text-lg font-bold text-white">{totals.totalBets.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="size-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">ค่าคอมที่ได้</p>
                <p 
                  className="text-lg font-bold text-emerald-400"
                  style={{ textShadow: '0 0 10px rgba(16,185,129,0.3)' }}
                >
                  +{totals.totalCommission.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Wallet className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">ยอดสุทธิที่จ่าย</p>
                <p className="text-lg font-bold text-amber-400">{totals.totalNet.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <PieChart className="size-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">จำนวนบิล</p>
                <p className="text-lg font-bold text-white">{totals.totalCount} บิล</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <Card className="lg:col-span-2 bg-black/40 backdrop-blur-xl border-slate-700/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Calendar className="size-5 text-emerald-400" />
                คอมมิชชัน 7 วันย้อนหลัง
              </CardTitle>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                รวม: {weeklyTotals.totalCommission.toLocaleString()} บาท
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Simple Bar Chart */}
            <div className="space-y-3">
              {weeklyData.length === 0 ? (
                <div className="text-center text-slate-500 py-8">ไม่มีข้อมูล</div>
              ) : weeklyData.map((day, index) => {
                const percentage = (day.totalBets / maxBets) * 100;
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-slate-500">
                      {new Date(day.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1">
                      <div className="h-8 bg-black/30 rounded-lg overflow-hidden relative">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-600/80 to-emerald-500/80 rounded-lg transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-sm font-medium text-white">
                            {day.totalBets.toLocaleString()} บาท
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <span className="text-sm font-bold text-emerald-400">
                        +{day.totalCommission.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Commission Calculator */}
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-amber-400 flex items-center gap-2">
              <Calculator className="size-5" />
              เครื่องคำนวณ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
              <p className="text-sm text-slate-400 mb-2">สูตรคำนวณ</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">ยอดแทง</span>
                  <span className="text-white font-mono">100 บาท</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>หักค่าคอม ({COMMISSION_RATE}%)</span>
                  <span className="font-mono">-20 บาท</span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex justify-between">
                  <span className="text-amber-400 font-medium">ยอดสุทธิ</span>
                  <span className="text-amber-400 font-bold font-mono">80 บาท</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">อัตราค่าคอม</span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {COMMISSION_RATE}%
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">หักอัตโนมัติ</span>
                <span className="text-white">ทุกรายการ</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">สรุปยอด</span>
                <span className="text-white">ทุกวันจันทร์</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      <Card className="mt-6 bg-black/40 backdrop-blur-xl border-slate-700/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Clock className="size-5 text-slate-400" />
              รายละเอียดคอมมิชชัน
            </CardTitle>
            <div className="flex gap-2">
              {(['today', 'week', 'month'] as const).map(period => (
                <Button
                  key={period}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className={cn(
                    "text-xs",
                    selectedPeriod === period 
                      ? "bg-emerald-500/20 text-emerald-400" 
                      : "text-slate-500"
                  )}
                >
                  {period === 'today' ? 'วันนี้' : period === 'week' ? 'สัปดาห์' : 'เดือน'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium">วันที่</th>
                  <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium">หวย</th>
                  <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium">ยอดแทง</th>
                  <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium">ค่าคอม</th>
                  <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium">ยอดสุทธิ</th>
                  <th className="text-center py-3 px-4 text-xs text-slate-500 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map(entry => (
                  <tr key={entry.id} className="border-b border-slate-800/50 hover:bg-white/5">
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {new Date(entry.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-sm text-white">{entry.lotteryName}</td>
                    <td className="py-3 px-4 text-sm text-right text-white font-mono">
                      {entry.totalBets.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-emerald-400 font-mono font-medium">
                      +{entry.commissionAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-amber-400 font-mono font-medium">
                      {entry.netPayable.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge 
                        className={cn(
                          "text-xs",
                          entry.status === 'settled'
                            ? "bg-slate-500/20 text-slate-400 border-slate-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        )}
                      >
                        {entry.status === 'settled' ? 'เคลียร์แล้ว' : 'รอสรุป'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-500/5">
                  <td colSpan={2} className="py-3 px-4 text-sm font-medium text-white">รวมทั้งหมด</td>
                  <td className="py-3 px-4 text-sm text-right text-white font-mono font-bold">
                    {totals.totalBets.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-emerald-400 font-mono font-bold">
                    +{totals.totalCommission.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-amber-400 font-mono font-bold">
                    {totals.totalNet.toLocaleString()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
