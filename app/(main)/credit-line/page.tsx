'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Scale, Users, TrendingUp, AlertCircle, Search, RefreshCw, Settings, History, CreditCard } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CreditLinePage() {
  const [search, setSearch] = useState('');
  const { data, mutate, isLoading } = useSWR('/api/credit-line', fetcher);
  
  const stats = data?.stats || {
    totalCreditLine: 0,
    totalUsed: 0,
    totalAvailable: 0,
    agentsWithCredit: 0
  };

  const agents = data?.agents || [];
  
  const filteredAgents = agents.filter((a: any) => 
    a.username?.toLowerCase().includes(search.toLowerCase()) ||
    a.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scale className="size-6 text-[#D4AF37]" />
            หุ้นลม / Credit Line
          </h1>
          <p className="text-slate-400 mt-1">จัดการระบบหุ้นลมและ Credit Line ให้เอเย่น</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">วงเงินรวม</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{stats.totalCreditLine.toLocaleString()}</p>
              </div>
              <Scale className="size-8 text-[#D4AF37]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">ใช้ไปแล้ว</p>
                <p className="text-2xl font-bold text-red-400">{stats.totalUsed.toLocaleString()}</p>
              </div>
              <CreditCard className="size-8 text-red-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">คงเหลือ</p>
                <p className="text-2xl font-bold text-green-400">{stats.totalAvailable.toLocaleString()}</p>
              </div>
              <TrendingUp className="size-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">เอเย่นที่มี Credit</p>
                <p className="text-2xl font-bold text-blue-400">{stats.agentsWithCredit}</p>
              </div>
              <Users className="size-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/credit-line/manage">
          <Card className="bg-black/40 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-[#D4AF37]/20">
                  <Scale className="size-6 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">จัดการ Credit Line</h3>
                  <p className="text-sm text-slate-400">เพิ่ม/ลดวงเงินให้เอเย่น</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/credit-line/history">
          <Card className="bg-black/40 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/20">
                  <History className="size-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">ประวัติ Credit Line</h3>
                  <p className="text-sm text-slate-400">ดูประวัติการเปลี่ยนแปลง</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/credit-line/settings">
          <Card className="bg-black/40 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <Settings className="size-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">ตั้งค่า Credit Line</h3>
                  <p className="text-sm text-slate-400">กำหนดเงื่อนไขและวงเงิน</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Agents with Credit Line */}
      <Card className="bg-black/40 border-[#D4AF37]/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">เอเย่นที่มี Credit Line</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="ค้นหาเอเย่น..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="size-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีเอเย่นที่มี Credit Line</p>
              <p className="text-sm mt-1">ไปที่ "จัดการ Credit Line" เพื่อเพิ่มวงเงินให้เอเย่น</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">เอเย่น</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">วงเงิน</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">ใช้ไป</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">คงเหลือ</th>
                    <th className="text-center py-3 px-4 text-slate-400 font-medium">สถานะ</th>
                    <th className="text-center py-3 px-4 text-slate-400 font-medium">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map((agent: any) => (
                    <tr key={agent.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-white">{agent.username}</p>
                          <p className="text-sm text-slate-400">{agent.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-[#D4AF37]">
                        {agent.credit_line?.toLocaleString() || 0}
                      </td>
                      <td className="py-3 px-4 text-right text-red-400">
                        {agent.credit_used?.toLocaleString() || 0}
                      </td>
                      <td className="py-3 px-4 text-right text-green-400">
                        {((agent.credit_line || 0) - (agent.credit_used || 0)).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={agent.is_active ? "default" : "secondary"}>
                          {agent.is_active ? 'ใช้งาน' : 'ระงับ'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="ghost" size="sm">
                          <Settings className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
