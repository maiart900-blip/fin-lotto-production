'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History, Search, RefreshCw, ArrowLeft, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CreditLineHistoryPage() {
  const [search, setSearch] = useState('');
  const { data, mutate, isLoading } = useSWR('/api/credit-line/history', fetcher);
  const history = data?.history || [];
  
  const filteredHistory = history.filter((h: any) => 
    h.agent_username?.toLowerCase().includes(search.toLowerCase()) ||
    h.note?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/credit-line"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="size-6 text-[#D4AF37]" />
              ประวัติ Credit Line
            </h1>
            <p className="text-slate-400 mt-1">ดูประวัติการเปลี่ยนแปลงวงเงินทั้งหมด</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Calendar className="size-4 mr-2" />เลือกวันที่</Button>
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}><RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />รีเฟรช</Button>
        </div>
      </div>

      <Card className="bg-black/40 border-[#D4AF37]/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">รายการทั้งหมด</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-slate-800 border-slate-700" />
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <History className="size-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีประวัติการเปลี่ยนแปลง</p>
              <p className="text-sm mt-1">เมื่อมีการเพิ่ม/ลดวงเงิน จะแสดงที่นี่</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${item.amount > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      {item.amount > 0 ? <TrendingUp className="size-5 text-green-400" /> : <TrendingDown className="size-5 text-red-400" />}
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.agent_username}</p>
                      <p className="text-sm text-slate-400">{item.note || 'ปรับวงเงิน'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${item.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>{item.amount > 0 ? '+' : ''}{item.amount?.toLocaleString()}</p>
                    <p className="text-sm text-slate-400">{item.created_at}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
