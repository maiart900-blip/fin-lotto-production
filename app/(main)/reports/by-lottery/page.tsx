'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, Download, TrendingUp, TrendingDown } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ByLotteryReportPage() {
  const { data: profitData } = useSWR('/api/profit-loss?period=today', fetcher);
  const { data: lotteries } = useSWR('/api/lotteries', fetcher);
  
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  // Group entries by lottery
  const entriesByLottery = (profitData?.entries || []).reduce((acc: any, entry: any) => {
    const lotteryId = entry.lottery_id;
    if (!acc[lotteryId]) {
      acc[lotteryId] = {
        lottery: entry.lottery,
        entries: [],
        totalBets: 0,
        totalPayout: 0,
      };
    }
    acc[lotteryId].entries.push(entry);
    acc[lotteryId].totalBets += entry.amount;
    if (entry.status === 'won') {
      acc[lotteryId].totalPayout += entry.payout || 0;
    }
    return acc;
  }, {});

  const lotteryStats = Object.values(entriesByLottery) as any[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-2">
            <Ticket className="size-6" />
            รายงานแยกตามหวย
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            สรุปยอด กำไร-ขาดทุน แยกตามประเภทหวย
          </p>
        </div>
        <Button variant="outline" className="border-[#D4AF37] text-[#D4AF37]">
          <Download className="size-4 mr-2" />
          ดาวน์โหลด
        </Button>
      </div>

      {/* Lottery Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lotteryStats.length > 0 ? (
          lotteryStats.map((stat: any, index: number) => {
            const profit = stat.totalBets - stat.totalPayout;
            const isProfit = profit >= 0;
            return (
              <Card key={index} className="bg-[#1E293B] border-[#334155] hover:border-[#D4AF37]/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg flex items-center justify-between">
                    {stat.lottery?.name || 'ไม่ระบุ'}
                    <Badge className={isProfit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                      {isProfit ? <TrendingUp className="size-3 mr-1" /> : <TrendingDown className="size-3 mr-1" />}
                      {isProfit ? 'กำไร' : 'ขาดทุน'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94A3B8]">ยอดแทง</span>
                      <span className="text-white">{formatMoney(stat.totalBets)} บาท</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94A3B8]">ยอดจ่าย</span>
                      <span className="text-red-400">{formatMoney(stat.totalPayout)} บาท</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-[#334155] pt-2">
                      <span className="text-[#94A3B8]">กำไร/ขาดทุน</span>
                      <span className={isProfit ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {isProfit ? '+' : ''}{formatMoney(profit)} บาท
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94A3B8]">จำนวนรายการ</span>
                      <span className="text-white">{stat.entries.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="col-span-full bg-[#1E293B] border-[#334155]">
            <CardContent className="py-12 text-center text-[#64748B]">
              <Ticket className="size-12 mx-auto mb-4 opacity-30" />
              <p>ยังไม่มีข้อมูลรายงาน</p>
              <p className="text-sm">ข้อมูลจะแสดงเมื่อมีการแทงหวย</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* All Lotteries Overview */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <CardTitle className="text-[#D4AF37]">ภาพรวมหวยทั้งหมด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155]">
                  <th className="text-left py-3 px-4 text-[#94A3B8]">หวย</th>
                  <th className="text-center py-3 px-4 text-[#94A3B8]">สถานะ</th>
                  <th className="text-right py-3 px-4 text-[#94A3B8]">ยอดแทงวันนี้</th>
                  <th className="text-right py-3 px-4 text-[#94A3B8]">กำไร/ขาดทุน</th>
                </tr>
              </thead>
              <tbody>
                {(lotteries || []).slice(0, 10).map((lottery: any) => {
                  const stat = entriesByLottery[lottery.id];
                  const totalBets = stat?.totalBets || 0;
                  const profit = totalBets - (stat?.totalPayout || 0);
                  return (
                    <tr key={lottery.id} className="border-b border-[#334155]/50 hover:bg-[#334155]/30">
                      <td className="py-3 px-4 text-white">{lottery.name}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={lottery.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                          {lottery.is_active ? 'เปิด' : 'ปิด'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-white">{formatMoney(totalBets)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {profit >= 0 ? '+' : ''}{formatMoney(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
