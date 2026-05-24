'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Ban, 
  Search,
  AlertTriangle,
  Info,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface BlockedNumber {
  id: string;
  lottery_id: string;
  number: string;
  entry_type: string;
  limit_amount: number | null;
  current_amount: number;
  is_blocked: boolean;
  lottery?: {
    id: string;
    name: string;
    date: string;
  };
}

interface Lottery {
  id: string;
  name: string;
  date: string;
  status: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
};

const entryTypes: Record<string, string> = {
  '3top': '3 ตัวบน',
  '3tod': '3 ตัวโต๊ด',
  '2top': '2 ตัวบน',
  '2bot': '2 ตัวล่าง',
  'run_top': 'วิ่งบน',
  'run_bot': 'วิ่งล่าง',
  '1top': 'วิ่งบน',
  '1bot': 'วิ่งล่าง',
};

export default function CustomerBlockedNumbersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLottery, setSelectedLottery] = useState('all');

  const { data: blockedNumbers = [], isLoading, error } = useSWR<BlockedNumber[]>(
    '/api/blocked-numbers',
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: lotteries = [] } = useSWR<Lottery[]>(
    '/api/lotteries?status=open',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Filter blocked numbers
  const filteredNumbers = blockedNumbers.filter(bn => {
    const matchSearch = !searchTerm || bn.number.includes(searchTerm);
    const matchLottery = selectedLottery === 'all' || bn.lottery_id === selectedLottery;
    return matchSearch && matchLottery;
  });

  // Group by lottery
  const groupedByLottery = filteredNumbers.reduce((acc, bn) => {
    const lotteryName = bn.lottery?.name || 'ไม่ระบุ';
    if (!acc[lotteryName]) {
      acc[lotteryName] = [];
    }
    acc[lotteryName].push(bn);
    return acc;
  }, {} as Record<string, BlockedNumber[]>);

  const blockedCount = blockedNumbers.filter(bn => bn.is_blocked).length;
  const limitedCount = blockedNumbers.filter(bn => bn.limit_amount && !bn.is_blocked).length;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Ban className="size-5 text-amber-400" />
            เลขอั้น / จำกัดยอด
          </h1>
          <p className="text-xs text-[#64748B] mt-1">ตรวจสอบเลขที่ถูกจำกัดการรับ</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Info className="size-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-amber-400 mb-1">เลขอั้นคืออะไร?</h2>
            <p className="text-sm text-[#94A3B8]">
              เลขอั้นคือเลขที่ถูกปิดรับชั่วคราว หรือจำกัดยอดรับเนื่องจากมีผู้เล่นแทงเยอะ 
              กรุณาตรวจสอบก่อนแทงเพื่อหลีกเลี่ยงความผิดพลาด
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 text-center">
            <Ban className="size-6 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-400">{blockedCount}</div>
            <div className="text-xs text-red-400/80">เลขอั้น (ปิดรับ)</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="size-6 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-400">{limitedCount}</div>
            <div className="text-xs text-amber-400/80">จำกัดยอด</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#64748B]" />
          <Input 
            placeholder="ค้นหาเลข..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0D1321] border-white/10 text-white placeholder:text-[#64748B]"
          />
        </div>
        <select
          value={selectedLottery}
          onChange={(e) => setSelectedLottery(e.target.value)}
          className="px-3 py-2 rounded-lg border border-white/10 bg-[#0D1321] text-white text-sm"
        >
          <option value="all">ทุกหวย</option>
          {lotteries.map((lot) => (
            <option key={lot.id} value={lot.id}>{lot.name}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-amber-400 mb-3" />
          <p className="text-sm text-[#64748B]">กำลังโหลดข้อมูล...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="size-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400">ไม่สามารถโหลดข้อมูลได้</p>
            <p className="text-xs text-[#64748B] mt-1">กรุณาลองใหม่อีกครั้ง</p>
          </CardContent>
        </Card>
      )}

      {/* Empty State - No blocked numbers */}
      {!isLoading && !error && filteredNumbers.length === 0 && (
        <Card className="bg-[#0D1321] border-amber-500/20">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="size-16 text-emerald-400/50 mx-auto mb-3" />
            <p className="text-white font-medium">ไม่มีเลขอั้นในขณะนี้</p>
            <p className="text-sm text-[#64748B] mt-1">ทุกเลขเปิดรับปกติ สามารถแทงได้ทุกเลข</p>
          </CardContent>
        </Card>
      )}

      {/* Blocked Numbers List */}
      {!isLoading && !error && Object.entries(groupedByLottery).map(([lotteryName, numbers]) => (
        <Card key={lotteryName} className="bg-[#0D1321] border-amber-500/10 overflow-hidden">
          <CardHeader className="py-3 px-4 bg-amber-500/5 border-b border-amber-500/10">
            <CardTitle className="text-sm font-medium text-amber-400">
              {lotteryName}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-white/5">
            {numbers.map((bn) => (
              <div key={bn.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-bold text-white">
                    {bn.number}
                  </span>
                  <Badge variant="outline" className="text-xs border-white/20 text-[#94A3B8]">
                    {entryTypes[bn.entry_type] || bn.entry_type}
                  </Badge>
                </div>
                <div className="text-right">
                  {bn.is_blocked ? (
                    <Badge className="bg-red-500 text-white">
                      <Ban className="size-3 mr-1" />
                      อั้น
                    </Badge>
                  ) : bn.limit_amount ? (
                    <div>
                      <Badge className="bg-amber-500 text-black font-semibold">จำกัดยอด</Badge>
                      <p className="text-xs text-[#64748B] mt-1">
                        {bn.current_amount?.toLocaleString() || 0}/{bn.limit_amount?.toLocaleString() || 0}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Note */}
      <p className="text-xs text-[#64748B] text-center px-4 pt-2">
        * รายการเลขอั้นอาจมีการเปลี่ยนแปลงตลอดเวลา กรุณาตรวจสอบก่อนแทงทุกครั้ง
      </p>
    </div>
  );
}
