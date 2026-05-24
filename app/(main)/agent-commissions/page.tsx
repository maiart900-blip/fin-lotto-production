'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Users, Calculator, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentCommissionsPage() {
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [payingAgent, setPayingAgent] = useState<string | null>(null);
  
  const { data: agents, mutate } = useSWR('/api/admin/agents', fetcher);
  const agentList = agents?.agents || [];

  // คำนวณสรุป
  const totalPending = agentList.reduce((sum: number, a: any) => sum + Number(a.pending_commission || 0), 0);
  const totalPaid = agentList.reduce((sum: number, a: any) => sum + Number(a.total_commission || 0), 0);
  const filteredAgents = selectedAgent === 'all' 
    ? agentList 
    : agentList.filter((a: any) => a.id === selectedAgent);

  const handlePayCommission = async (agentId: string) => {
    setPayingAgent(agentId);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: agentId,
          action: 'pay_commission',
        }),
      });
      
      if (res.ok) {
        toast.success('จ่ายคอมมิชชั่นสำเร็จ');
        mutate();
      } else {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setPayingAgent(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">คอมมิชชั่น</h1>
          <p className="text-muted-foreground">จัดการคอมมิชชั่นของเอเย่น/พาร์ทเนอร์</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">รอจ่าย</CardTitle>
            <DollarSign className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalPending.toLocaleString()} ฿</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">จ่ายแล้วทั้งหมด</CardTitle>
            <CreditCard className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString()} ฿</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">เอเย่นทั้งหมด</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentList.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">อัตราเฉลี่ย</CardTitle>
            <Calculator className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agentList.length > 0 
                ? (agentList.reduce((sum: number, a: any) => sum + Number(a.commission_rate || 0), 0) / agentList.length).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="เลือกเอเย่น" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            {agentList.map((agent: any) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name} ({agent.agent_level})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Commissions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">เอเย่น</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">ระดับ</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">อัตรา %</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">รอจ่าย</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">จ่ายแล้ว</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      ไม่พบข้อมูลเอเย่น
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent: any) => (
                    <tr key={agent.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-muted-foreground">{agent.phone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={
                          agent.agent_level === 'senior_agent' ? 'default' :
                          agent.agent_level === 'master_agent' ? 'secondary' : 'outline'
                        }>
                          {agent.agent_level === 'senior_agent' ? 'Senior' :
                           agent.agent_level === 'master_agent' ? 'Master' : 'Agent'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {Number(agent.commission_rate || 0)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-amber-600">
                          {Number(agent.pending_commission || 0).toLocaleString()} ฿
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-green-600">
                          {Number(agent.total_commission || 0).toLocaleString()} ฿
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Number(agent.pending_commission || 0) <= 0 || payingAgent === agent.id}
                          onClick={() => handlePayCommission(agent.id)}
                        >
                          {payingAgent === agent.id ? 'กำลังจ่าย...' : 'จ่ายคอมฯ'}
                        </Button>
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
