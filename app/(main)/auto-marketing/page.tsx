'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Users, Link2, Megaphone, BarChart3, TrendingUp, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AutoMarketingPage() {
  const { data, mutate, isLoading } = useSWR('/api/marketing/stats?type=auto', fetcher);
  const stats = data?.stats || { campaigns: 0, links: 0, clicks: 0, registrations: 0 };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="size-6 text-[#D4AF37]" />
            การตลาดออโต้
          </h1>
          <p className="text-slate-400 mt-1">จัดการการตลาดและแคมเปญสำหรับระบบออโต้</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">แคมเปญ</p><p className="text-2xl font-bold text-purple-400">{stats.campaigns}</p></div>
              <Megaphone className="size-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">ลิงก์สมัคร</p><p className="text-2xl font-bold text-blue-400">{stats.links}</p></div>
              <Link2 className="size-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">คลิกทั้งหมด</p><p className="text-2xl font-bold text-[#D4AF37]">{stats.clicks.toLocaleString()}</p></div>
              <TrendingUp className="size-8 text-[#D4AF37]/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-slate-400">ลงทะเบียน</p><p className="text-2xl font-bold text-green-400">{stats.registrations}</p></div>
              <Users className="size-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/auto-marketing/campaigns">
          <Card className="bg-black/40 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-all cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/20"><Megaphone className="size-6 text-purple-400" /></div>
                <div><h3 className="font-semibold text-white">แคมเปญ</h3><p className="text-sm text-slate-400">สร้างและจัดการแคมเปญ</p></div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/auto-marketing/links">
          <Card className="bg-black/40 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-all cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/20"><Link2 className="size-6 text-blue-400" /></div>
                <div><h3 className="font-semibold text-white">ลิงก์สมัคร</h3><p className="text-sm text-slate-400">สร้างลิงก์ติดตาม source</p></div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/auto-marketing/report">
          <Card className="bg-black/40 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-all cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/20"><BarChart3 className="size-6 text-green-400" /></div>
                <div><h3 className="font-semibold text-white">รายงาน</h3><p className="text-sm text-slate-400">ดูสถิติและผลลัพธ์</p></div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
