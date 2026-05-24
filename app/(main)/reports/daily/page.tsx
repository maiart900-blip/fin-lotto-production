'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DailyReportPage() {
  const { data: profitData } = useSWR('/api/profit-loss?period=today', fetcher);
  
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const summary = profitData || { entries: [], summary: { totalBets: 0, totalPayout: 0, profit: 0, entryCount: 0 } };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-2">
            <Calendar className="size-6" />
            รายงานประจำวัน
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            สรุปยอดขาย กำไร-ขาดทุน ประจำวัน
          </p>
        </div>
        <Button variant="outline" className="border-[#D4AF37] text-[#D4AF37]">
          <Download className="size-4 mr-2" />
          ดาวน์โหลด CSV
        </Button>
      </div>

      {/* Today Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดแทงวันนี้</p>
                <p className="text-2xl font-bold text-blue-400">{formatMoney(summary.summary?.totalBets || 0)}</p>
              </div>
              <DollarSign className="size-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดจ่ายวันนี้</p>
                <p className="text-2xl font-bold text-red-400">{formatMoney(summary.summary?.totalPayout || 0)}</p>
              </div>
              <TrendingDown className="size-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">กำไรสุทธิวันนี้</p>
                <p className="text-2xl font-bold text-emerald-400">+{formatMoney(summary.summary?.profit || 0)}</p>
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
                <p className="text-2xl font-bold text-purple-400">{summary.summary?.entryCount || 0}</p>
              </div>
              <FileText className="size-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Entries Table */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <CardTitle className="text-[#D4AF37] flex items-center gap-2">
            <FileText className="size-5" />
            รายการวันนี้
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.entries && summary.entries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-[#94A3B8]">เลข</th>
                    <th className="text-left py-3 px-4 text-[#94A3B8]">ประเภท</th>
                    <th className="text-right py-3 px-4 text-[#94A3B8]">ยอดแทง</th>
                    <th className="text-left py-3 px-4 text-[#94A3B8]">หวย</th>
                    <th className="text-left py-3 px-4 text-[#94A3B8]">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.entries.slice(0, 20).map((entry: any) => (
                    <tr key={entry.id} className="border-b border-[#334155]/50 hover:bg-[#334155]/30">
                      <td className="py-3 px-4 font-mono text-white">{entry.number}</td>
                      <td className="py-3 px-4 text-[#94A3B8]">{entry.bet_type}</td>
                      <td className="py-3 px-4 text-right text-white">{formatMoney(entry.amount)}</td>
                      <td className="py-3 px-4 text-[#94A3B8]">{entry.lottery?.name || '-'}</td>
                      <td className="py-3 px-4">
                        <Badge className={entry.status === 'won' ? 'bg-emerald-500/20 text-emerald-400' : entry.status === 'lost' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}>
                          {entry.status === 'won' ? 'ถูกรางวัล' : entry.status === 'lost' ? 'ไม่ถูก' : 'รอผล'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-[#64748B]">
              ยังไม่มีรายการวันนี้
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
