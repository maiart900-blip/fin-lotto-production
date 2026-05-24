'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, ArrowLeft, RefreshCw, TrendingUp, Users, MousePointer, Target, Download } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ManualKeyMarketingReportPage() {
  const { data, mutate, isLoading } = useSWR('/api/marketing/report?type=manual', fetcher);
  const stats = data?.stats || { totalClicks: 0, totalRegistrations: 0, conversionRate: 0, topSource: '-' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manual-key-marketing"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><BarChart3 className="size-6 text-[#D4AF37]" />รายงานการตลาดคีย์หวย</h1>
            <p className="text-slate-400 mt-1">สถิติและผลลัพธ์การตลาด</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="size-4 mr-2" />Export</Button>
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}><RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />รีเฟรช</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">คลิกทั้งหมด</p><p className="text-2xl font-bold text-blue-400">{stats.totalClicks.toLocaleString()}</p></div>
              <MousePointer className="size-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">ลงทะเบียน</p><p className="text-2xl font-bold text-green-400">{stats.totalRegistrations}</p></div>
              <Users className="size-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">Conversion Rate</p><p className="text-2xl font-bold text-[#D4AF37]">{stats.conversionRate}%</p></div>
              <TrendingUp className="size-8 text-[#D4AF37]/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">Top Source</p><p className="text-2xl font-bold text-purple-400">{stats.topSource}</p></div>
              <Target className="size-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-black/40 border-[#D4AF37]/20">
          <CardHeader><CardTitle className="text-white">คลิกรายวัน</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-slate-500">
              <div className="text-center"><BarChart3 className="size-12 mx-auto mb-4 opacity-50" /><p>กราฟแสดงคลิกรายวัน</p><p className="text-sm">ข้อมูลจะแสดงเมื่อมีการคลิก</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-black/40 border-[#D4AF37]/20">
          <CardHeader><CardTitle className="text-white">Source Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-slate-500">
              <div className="text-center"><Target className="size-12 mx-auto mb-4 opacity-50" /><p>กราฟแสดงประสิทธิภาพ Source</p><p className="text-sm">ข้อมูลจะแสดงเมื่อมีการลงทะเบียน</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
