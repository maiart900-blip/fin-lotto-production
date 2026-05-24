'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, DollarSign, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentBettingStatsPage() {
  const [selectedAgent, setSelectedAgent] = useState('all');
  
  // ดึงข้อมูลเอเย่นต์จาก customers table
  const { data: agentsData, isLoading: agentsLoading } = useSWR('/api/customers?role=agent', fetcher);
  const agentList = agentsData?.customers || [];

  // ดึงสถิติการแทงจริงจาก entries table
  const statsUrl = selectedAgent === 'all' 
    ? '/api/entries/stats' 
    : `/api/entries/stats?agent_id=${selectedAgent}`;
  const { data: statsData, isLoading: statsLoading, mutate } = useSWR(statsUrl, fetcher);

  const stats = {
    totalBets: statsData?.total_entries || 0,
    totalAmount: statsData?.total_amount || 0,
    winRate: statsData?.win_rate || 0,
    avgBet: statsData?.avg_amount || 0,
    totalPayout: statsData?.total_payout || 0,
  };

  const agentStats = statsData?.by_agent || [];
  const isLoading = agentsLoading || statsLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">สถิติการแทงสายงาน</h1>
          <p className="text-muted-foreground">วิเคราะห์สถิติการแทงของลูกค้าในสายงาน (ข้อมูลจริง)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="เลือกเอเย่น" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            {agentList.map((agent: any) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.display_name || agent.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">จำนวนโพย</CardTitle>
            <FileText className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalBets.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ยอดแทงรวม</CardTitle>
            <DollarSign className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalAmount.toLocaleString()} ฿</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">อัตราถูกรางวัล</CardTitle>
            <TrendingUp className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ยอดเฉลี่ย/โพย</CardTitle>
            <BarChart3 className="size-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{Math.round(stats.avgBet).toLocaleString()} ฿</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            สถิติแยกตามเอเย่น
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">เอเย่น</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">จำนวนโพย</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">ยอดแทง</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">ถูกรางวัล</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">จ่ายรางวัล</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <Loader2 className="size-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : agentStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      ยังไม่มีข้อมูลการแทง
                    </td>
                  </tr>
                ) : (
                  agentStats.map((agent: any) => (
                    <tr key={agent.agent_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{agent.agent_name || 'ไม่ระบุ'}</td>
                      <td className="px-4 py-3 text-right">{(agent.total_entries || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{(agent.total_amount || 0).toLocaleString()} ฿</td>
                      <td className="px-4 py-3 text-right text-green-600">{(agent.win_count || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-red-600">{(agent.total_payout || 0).toLocaleString()} ฿</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
