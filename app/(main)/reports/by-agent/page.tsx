'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Download, TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ByAgentReportPage() {
  const { data: agentsData } = useSWR('/api/agents', fetcher);
  
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const agents = agentsData?.agents || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-2">
            <Users className="size-6" />
            รายงานแยกตามเอเย่น
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            สรุปยอดขาย คอมมิชชั่น แยกตามเอเย่น
          </p>
        </div>
        <Button variant="outline" className="border-[#D4AF37] text-[#D4AF37]">
          <Download className="size-4 mr-2" />
          ดาวน์โหลด
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">เอเย่นทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-400">{agents.length}</p>
              </div>
              <Users className="size-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดขายรวม</p>
                <p className="text-2xl font-bold text-emerald-400">{formatMoney(agentsData?.summary?.totalBets || 0)}</p>
              </div>
              <DollarSign className="size-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">คอมมิชชั่นรวม</p>
                <p className="text-2xl font-bold text-amber-400">{formatMoney(agentsData?.summary?.totalCommission || 0)}</p>
              </div>
              <Percent className="size-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">เอเย่นใช้งาน</p>
                <p className="text-2xl font-bold text-purple-400">{agentsData?.summary?.active || 0}</p>
              </div>
              <TrendingUp className="size-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Table */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <CardTitle className="text-[#D4AF37]">รายชื่อเอเย่น</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-[#94A3B8]">ชื่อ</th>
                    <th className="text-left py-3 px-4 text-[#94A3B8]">เบอร์โทร</th>
                    <th className="text-center py-3 px-4 text-[#94A3B8]">สถานะ</th>
                    <th className="text-right py-3 px-4 text-[#94A3B8]">คอมมิชชั่น %</th>
                    <th className="text-right py-3 px-4 text-[#94A3B8]">ยอดขาย</th>
                    <th className="text-right py-3 px-4 text-[#94A3B8]">คอมมิชชั่น</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent: any) => (
                    <tr key={agent.id} className="border-b border-[#334155]/50 hover:bg-[#334155]/30">
                      <td className="py-3 px-4 text-white font-medium">{agent.name}</td>
                      <td className="py-3 px-4 text-[#94A3B8]">{agent.phone}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={agent.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                          {agent.is_active ? 'ใช้งาน' : 'ระงับ'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400">{agent.commission_rate || 0}%</td>
                      <td className="py-3 px-4 text-right text-white">{formatMoney(agent.total_bets || 0)}</td>
                      <td className="py-3 px-4 text-right text-emerald-400">{formatMoney(agent.total_commission || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-[#64748B]">
              <Users className="size-12 mx-auto mb-4 opacity-30" />
              <p>ยังไม่มีเอเย่นในระบบ</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
