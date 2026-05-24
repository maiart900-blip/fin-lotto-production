'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, DollarSign, CheckCircle, Clock } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentWithdrawHistoryPage() {
  const [selectedAgent, setSelectedAgent] = useState('all');
  
  const { data: agents } = useSWR('/api/admin/agents', fetcher);
  const { data: commissions } = useSWR('/api/commissions?type=payout', fetcher);
  
  const agentList = agents?.agents || [];
  const commissionList = commissions?.transactions || [];

  // Filter
  const filteredList = selectedAgent === 'all' 
    ? commissionList 
    : commissionList.filter((c: any) => c.user_id === selectedAgent);

  // Summary
  const totalPaid = filteredList.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ประวัติถอนคอมมิชชั่น</h1>
          <p className="text-muted-foreground">ประวัติการจ่ายคอมมิชชั่นให้เอเย่น/พาร์ทเนอร์</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">จ่ายไปแล้วทั้งหมด</CardTitle>
            <DollarSign className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString()} ฿</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">จำนวนรายการ</CardTitle>
            <Receipt className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredList.length}</div>
          </CardContent>
        </Card>
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
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            รายการถอนคอมมิชชั่น
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">วันที่</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">เอเย่น</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">จำนวน</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">สถานะ</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      ไม่มีประวัติการถอนคอมมิชชั่น
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm">
                        {new Date(item.created_at).toLocaleDateString('th-TH')}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {agentList.find((a: any) => a.id === item.user_id)?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {Number(item.amount || 0).toLocaleString()} ฿
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="default">
                          <CheckCircle className="mr-1 size-3" />
                          จ่ายแล้ว
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {item.note || '-'}
                      </td>
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
