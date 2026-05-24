'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Download, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function MonthlyReportPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const { data: profitData } = useSWR(`/api/profit-loss?period=this_month`, fetcher);
  
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const summary = {
    totalBets: profitData?.summary?.totalBets || 0,
    totalPayout: profitData?.summary?.totalPayout || 0,
    profit: profitData?.summary?.profit || 0,
    entryCount: profitData?.summary?.entryCount || 0,
  };

  const months = [
    { value: '2026-05', label: 'พฤษภาคม 2569' },
    { value: '2026-04', label: 'เมษายน 2569' },
    { value: '2026-03', label: 'มีนาคม 2569' },
    { value: '2026-02', label: 'กุมภาพันธ์ 2569' },
    { value: '2026-01', label: 'มกราคม 2569' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-2">
            <CalendarDays className="size-6" />
            รายงานประจำเดือน
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            สรุปยอดขาย กำไร-ขาดทุน รายเดือน
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px] bg-[#1E293B] border-[#334155] text-white">
              <SelectValue placeholder="เลือกเดือน" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-[#D4AF37] text-[#D4AF37]">
            <Download className="size-4 mr-2" />
            ดาวน์โหลด
          </Button>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดแทงรวม</p>
                <p className="text-2xl font-bold text-blue-400">{formatMoney(summary.totalBets)}</p>
              </div>
              <DollarSign className="size-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดจ่ายรวม</p>
                <p className="text-2xl font-bold text-red-400">{formatMoney(summary.totalPayout)}</p>
              </div>
              <TrendingDown className="size-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">กำไรสุทธิ</p>
                <p className={`text-2xl font-bold ${summary.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {summary.profit >= 0 ? '+' : ''}{formatMoney(summary.profit)}
                </p>
              </div>
              <TrendingUp className="size-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">จำนวนโพย</p>
                <p className="text-2xl font-bold text-purple-400">{summary.entryCount}</p>
              </div>
              <BarChart3 className="size-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Chart Placeholder */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <CardTitle className="text-[#D4AF37]">กราฟยอดรายวัน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-[#64748B]">
            <BarChart3 className="size-16 opacity-30" />
            <span className="ml-4">กราฟจะแสดงเมื่อมีข้อมูลเพียงพอ</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
