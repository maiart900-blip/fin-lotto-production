'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, Users, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentTransferPage() {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [fromAgent, setFromAgent] = useState('');
  const [toAgent, setToAgent] = useState('');
  const [transferring, setTransferring] = useState(false);
  
  const { data: agents } = useSWR('/api/admin/agents', fetcher);
  const { data: customers } = useSWR('/api/customers', fetcher);
  
  const agentList = agents?.agents || [];
  const customerList = customers?.customers || [];

  const handleTransfer = async () => {
    if (!selectedCustomer || !toAgent) {
      toast.error('กรุณาเลือกข้อมูลให้ครบ');
      return;
    }

    setTransferring(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer,
          upline_id: toAgent,
          agent_level: 'member',
        }),
      });

      if (res.ok) {
        toast.success('โยกย้ายลูกค้าสำเร็จ');
        setSelectedCustomer('');
        setToAgent('');
      } else {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">โยกย้ายลูกค้า</h1>
          <p className="text-muted-foreground">โยกย้ายลูกค้าระหว่างเอเย่น/พาร์ทเนอร์</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="size-5" />
            โยกย้ายลูกค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">เลือกลูกค้า</label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกลูกค้า" />
                </SelectTrigger>
                <SelectContent>
                  {customerList.map((customer: any) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name || customer.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">จากเอเย่น (ปัจจุบัน)</label>
              <Select value={fromAgent} onValueChange={setFromAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="เอเย่นปัจจุบัน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่มี</SelectItem>
                  {agentList.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">ไปเอเย่น (ใหม่)</label>
              <Select value={toAgent} onValueChange={setToAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเอเย่นใหม่" />
                </SelectTrigger>
                <SelectContent>
                  {agentList.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleTransfer} disabled={transferring || !selectedCustomer || !toAgent}>
            {transferring ? 'กำลังโยกย้าย...' : 'ยืนยันการโยกย้าย'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Transfers */}
      <Card>
        <CardHeader>
          <CardTitle>ประวัติการโยกย้ายล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            ไม่มีประวัติการโยกย้าย
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
