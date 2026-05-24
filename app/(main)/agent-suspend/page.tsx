'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserX, UserCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentSuspendPage() {
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const { data: agents, mutate } = useSWR('/api/admin/agents', fetcher);
  const agentList = agents?.agents || [];

  const handleToggleSuspend = async (agentId: string, currentStatus: string) => {
    setProcessingId(agentId);
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const res = await fetch(`/api/customers/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(newStatus === 'suspended' ? 'ระงับเอเย่นสำเร็จ' : 'เปิดใช้งานเอเย่นสำเร็จ');
        mutate();
      } else {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setProcessingId(null);
    }
  };

  const activeAgents = agentList.filter((a: any) => a.status !== 'suspended');
  const suspendedAgents = agentList.filter((a: any) => a.status === 'suspended');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ระงับเอเย่น</h1>
          <p className="text-muted-foreground">จัดการการระงับ/เปิดใช้งานเอเย่น</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">เอเย่นปกติ</CardTitle>
            <UserCheck className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeAgents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ถูกระงับ</CardTitle>
            <UserX className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{suspendedAgents.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5" />
            รายชื่อเอเย่น
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">เอเย่น</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">ระดับ</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">สถานะ</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {agentList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      ไม่พบข้อมูลเอเย่น
                    </td>
                  </tr>
                ) : (
                  agentList.map((agent: any) => (
                    <tr key={agent.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-muted-foreground">{agent.phone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline">{agent.agent_level}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={agent.status === 'suspended' ? 'destructive' : 'default'}>
                          {agent.status === 'suspended' ? 'ถูกระงับ' : 'ปกติ'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant={agent.status === 'suspended' ? 'default' : 'destructive'}
                          disabled={processingId === agent.id}
                          onClick={() => handleToggleSuspend(agent.id, agent.status)}
                        >
                          {processingId === agent.id 
                            ? 'กำลังดำเนินการ...' 
                            : agent.status === 'suspended' 
                              ? 'เปิดใช้งาน' 
                              : 'ระงับ'}
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
