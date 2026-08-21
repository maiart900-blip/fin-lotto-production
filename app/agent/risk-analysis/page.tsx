'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  AlertTriangle,
  TrendingUp,
  Shield,
  RefreshCw,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());
const MOCK_AGENT_ID = '7cf23d72-858d-4395-9b94-67e7a7ca821f';

export default function AgentRiskAnalysisPage() {
  const [lotteryId, setLotteryId] = useState<string>('');
  const today = new Date().toISOString().split('T')[0];

  // ดึงรายชื่อหวย
  const { data: lotteries } = useSWR('/api/lotteries', fetcher);

  // ดึงข้อมูลวิเคราะห์ความเสี่ยง
  const { data: riskData, isLoading, mutate } = useSWR(
    lotteryId ? `/api/agent/risk-analysis?agent_id=${MOCK_AGENT_ID}&lottery_id=${lotteryId}&date=${today}` : null,
    fetcher
  );

  const riskAnalysis = riskData?.risk_analysis || [];
  const totalAmount = riskData?.total_amount || 0;
  const totalEntries = riskData?.total_entries || 0;

  const highRiskCount = riskAnalysis.filter((r: any) => r.risk_level === 'high').length;
  const mediumRiskCount = riskAnalysis.filter((r: any) => r.risk_level === 'medium').length;
  const lowRiskCount = riskAnalysis.filter((r: any) => r.risk_level === 'low').length;

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">สูง</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">กลาง</Badge>;
      case 'low':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">ต่ำ</Badge>;
      default:
        return <Badge>{level}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5f0] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-amber-600">วิเคราะห์ความเสี่ยง</h1>
            <p className="text-muted-foreground">ดูความเสี่ยงของเลขที่แทงวันนี้</p>
          </div>
          <Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>

        {/* Lottery Selector */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">เลือกหวย:</label>
              <Select value={lotteryId} onValueChange={setLotteryId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="เลือกหวยที่ต้องการวิเคราะห์" />
                </SelectTrigger>
                <SelectContent>
                  {lotteries?.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!lotteryId ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              กรุณาเลือกหวยที่ต้องการวิเคราะห์
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              กำลังโหลด...
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-[#0D1321] text-white border-amber-500/30">
                <CardContent className="p-4">
                  <p className="text-white/60 text-sm">ยอดแทงรวม</p>
                  <p className="text-2xl font-bold">{totalAmount.toLocaleString()} บ.</p>
                  <p className="text-white/40 text-xs">{totalEntries} รายการ</p>
                </CardContent>
              </Card>

              <Card className="bg-red-500/10 border-red-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-600 text-sm">เสี่ยงสูง</p>
                      <p className="text-2xl font-bold text-red-600">{highRiskCount}</p>
                    </div>
                    <AlertTriangle className="size-8 text-red-500/50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-yellow-500/10 border-yellow-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-600 text-sm">เสี่ยงกลาง</p>
                      <p className="text-2xl font-bold text-yellow-600">{mediumRiskCount}</p>
                    </div>
                    <TrendingUp className="size-8 text-yellow-500/50" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm">เสี่ยงต่ำ</p>
                      <p className="text-2xl font-bold text-green-600">{lowRiskCount}</p>
                    </div>
                    <Shield className="size-8 text-green-500/50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk Analysis Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="size-5 text-amber-500" />
                  รายละเอียดความเสี่ยงแต่ละเลข
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riskAnalysis.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr className="text-left text-muted-foreground text-sm">
                          <th className="p-3">เลข</th>
                          <th className="p-3 text-right">ยอดแทง</th>
                          <th className="p-3 text-right">Potential Payout</th>
                          <th className="p-3 text-right">กำไร/ขาดทุน</th>
                          <th className="p-3 text-right">Risk Score</th>
                          <th className="p-3 text-center">ระดับ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {riskAnalysis.map((item: any) => (
                          <tr key={item.number} className="hover:bg-muted/50">
                            <td className="p-3">
                              <span className="font-mono text-lg font-bold text-amber-600">{item.number}</span>
                            </td>
                            <td className="p-3 text-right">{item.total_amount.toLocaleString()}</td>
                            <td className="p-3 text-right text-red-500">
                              {item.potential_payout.toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              <span className={item.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {item.profit_loss >= 0 ? '+' : ''}{item.profit_loss.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-3 text-right">{item.risk_score.toFixed(1)}%</td>
                            <td className="p-3 text-center">{getRiskBadge(item.risk_level)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
