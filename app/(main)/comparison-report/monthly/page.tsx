'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PieChart, ArrowLeft, RefreshCw, Calendar, TrendingUp, TrendingDown, Users, DollarSign, Download } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ComparisonReportMonthlyPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, mutate, isLoading } = useSWR(`/api/reports/comparison/monthly?month=${month}`, fetcher);
  
  const stats = data?.stats || {
    auto: { bets: 0, payouts: 0, profit: 0, customers: 0 },
    manual: { bets: 0, payouts: 0, profit: 0, customers: 0 }
  };

  const total = {
    bets: stats.auto.bets + stats.manual.bets,
    payouts: stats.auto.payouts + stats.manual.payouts,
    profit: stats.auto.profit + stats.manual.profit,
    customers: stats.auto.customers + stats.manual.customers
  };

  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const [year, monthNum] = month.split('-');
  const displayMonth = `${monthNames[parseInt(monthNum) - 1]} ${year}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/comparison-report"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><PieChart className="size-6 text-[#D4AF37]" />รายงานเปรียบเทียบรายเดือน</h1>
            <p className="text-slate-400 mt-1">เปรียบเทียบยอดระหว่างออโต้และคีย์หวย</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white" />
          <Button variant="outline" size="sm"><Download className="size-4 mr-2" />Export</Button>
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}><RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />รีเฟรช</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">ยอดแทงรวม</p><p className="text-2xl font-bold text-blue-400">{total.bets.toLocaleString()}</p></div>
              <DollarSign className="size-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">ยอดจ่ายรวม</p><p className="text-2xl font-bold text-red-400">{total.payouts.toLocaleString()}</p></div>
              <TrendingDown className="size-8 text-red-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">กำไรรวม</p><p className={`text-2xl font-bold ${total.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{total.profit >= 0 ? '+' : ''}{total.profit.toLocaleString()}</p></div>
              <TrendingUp className="size-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">ลูกค้าทั้งหมด</p><p className="text-2xl font-bold text-purple-400">{total.customers}</p></div>
              <Users className="size-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Table */}
      <Card className="bg-black/40 border-[#D4AF37]/20">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><Calendar className="size-5 text-[#D4AF37]" />เปรียบเทียบ เดือน {displayMonth}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">ระบบ</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">ยอดแทง</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">ยอดจ่าย</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">กำไร/ขาดทุน</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">ลูกค้า</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">สัดส่วน</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-4 px-4"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="font-medium text-white">ออโต้</span></div></td>
                  <td className="py-4 px-4 text-right text-white">{stats.auto.bets.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right text-red-400">{stats.auto.payouts.toLocaleString()}</td>
                  <td className={`py-4 px-4 text-right font-bold ${stats.auto.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.auto.profit >= 0 ? '+' : ''}{stats.auto.profit.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right text-white">{stats.auto.customers}</td>
                  <td className="py-4 px-4 text-right text-blue-400">{total.bets > 0 ? ((stats.auto.bets / total.bets) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-4 px-4"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span className="font-medium text-white">คีย์หวย</span></div></td>
                  <td className="py-4 px-4 text-right text-white">{stats.manual.bets.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right text-red-400">{stats.manual.payouts.toLocaleString()}</td>
                  <td className={`py-4 px-4 text-right font-bold ${stats.manual.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.manual.profit >= 0 ? '+' : ''}{stats.manual.profit.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right text-white">{stats.manual.customers}</td>
                  <td className="py-4 px-4 text-right text-amber-400">{total.bets > 0 ? ((stats.manual.bets / total.bets) * 100).toFixed(1) : 0}%</td>
                </tr>
                <tr className="bg-slate-800/50 font-bold">
                  <td className="py-4 px-4 text-[#D4AF37]">รวม</td>
                  <td className="py-4 px-4 text-right text-white">{total.bets.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right text-red-400">{total.payouts.toLocaleString()}</td>
                  <td className={`py-4 px-4 text-right ${total.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{total.profit >= 0 ? '+' : ''}{total.profit.toLocaleString()}</td>
                  <td className="py-4 px-4 text-right text-white">{total.customers}</td>
                  <td className="py-4 px-4 text-right text-white">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
