'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Users, Search, Filter, UserPlus, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentMembersPage() {
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  
  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    phone: '',
    password: '',
    agent_id: '',
  });
  
  const { data: agents } = useSWR('/api/admin/agents', fetcher);
  const { data: customers, isLoading, mutate: mutateCustomers } = useSWR(
    `/api/customers?search=${search}&agent_id=${agentFilter === 'all' ? '' : agentFilter}`,
    fetcher
  );

  const agentList = agents?.agents || [];
  const customerList = customers?.customers || [];

  // Handle add member
  const handleAddMember = async () => {
    if (!newMember.name || !newMember.phone || !newMember.password) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMember.name,
          phone: newMember.phone,
          password: newMember.password,
          upline_agent_id: newMember.agent_id || null,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'ไม่สามารถเพิ่มสมาชิกได้');
      }
      
      toast.success('เพิ่มสมาชิกสำเร็จ');
      setShowAddDialog(false);
      setNewMember({ name: '', phone: '', password: '', agent_id: '' });
      mutateCustomers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // สรุปข้อมูล
  const totalMembers = customerList.length;
  const activeMembers = customerList.filter((c: any) => c.status === 'active').length;
  const totalBalance = customerList.reduce((sum: number, c: any) => sum + Number(c.credit_balance || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">สมาชิกใต้สาย</h1>
          <p className="text-muted-foreground">จัดการสมาชิกภายใต้เอเย่น/พาร์ทเนอร์</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 size-4" />
          เพิ่มสมาชิก
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">สมาชิกทั้งหมด</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Active: {activeMembers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ยอดเครดิตรวม</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBalance.toLocaleString()} ฿</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">เอเย่นทั้งหมด</CardTitle>
            <Filter className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentList.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาสมาชิก..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
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

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">สมาชิก</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">เอเย่น</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">เครดิต</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">สถานะ</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">วันที่สมัคร</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : customerList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      ไม่พบข้อมูลสมาชิก
                    </td>
                  </tr>
                ) : (
                  customerList.map((customer: any) => (
                    <tr key={customer.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{customer.name || '-'}</div>
                          <div className="text-sm text-muted-foreground">{customer.phone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {customer.upline?.name || 'ไม่มี'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {Number(customer.credit_balance || 0).toLocaleString()} ฿
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                          {customer.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(customer.created_at).toLocaleDateString('th-TH')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มสมาชิกใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ชื่อสมาชิก *</Label>
              <Input
                placeholder="กรอกชื่อสมาชิก"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>เบอร์โทร *</Label>
              <Input
                placeholder="0812345678"
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>รหัสผ่าน *</Label>
              <Input
                type="password"
                placeholder="กรอกรหัสผ่าน"
                value={newMember.password}
                onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>เอเย่นต้นสาย</Label>
              <Select 
                value={newMember.agent_id || 'none'} 
                onValueChange={(val) => setNewMember({ ...newMember, agent_id: val === 'none' ? '' : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเอเย่น (ถ้ามี)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่มีเอเย่นต้นสาย</SelectItem>
                  {agentList.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAddMember} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
