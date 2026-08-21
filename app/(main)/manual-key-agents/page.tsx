'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, Search, Edit, Key, Users, DollarSign, 
  TrendingUp, MoreHorizontal, RefreshCw, Loader2, UserX, UsersRound, ShieldCheck, ShieldOff 
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ManualKeyAgent {
  id: string;
  username: string;
  display_name: string;
  phone?: string;
  status: 'active' | 'suspended' | 'inactive';
  commission_percent: number;
  credit_limit: number;
  credit_balance: number;
  share_percent: number;
  parent_agent_id?: string;
parent_user_id?: string;
downline_count: number;
total_sales: number;
two_factor_enabled?: boolean;
  member_count: number;
  created_at: string;
}

export default function ManualKeyAgentsPage() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<ManualKeyAgent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    password: '',
    phone: '',
    commission_percent: 5,
    credit_limit: 10000,
    share_percent: 0,
    parent_agent_id: '',
  });

  const { data, mutate } = useSWR<{ agents: ManualKeyAgent[], stats: any }>(
    `/api/manual-key-agents?search=${search}&status=${statusFilter}`,
    fetcher
  );

  const agents = data?.agents || [];
  const stats = data?.stats || { total: 0, active: 0, suspended: 0, totalSales: 0, totalCommission: 0 };

  const handleAdd = async () => {
    if (!formData.username || !formData.display_name || !formData.password) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/manual-key-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, action: 'create' }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('เพิ่มเอเย่นสำเร็จ');
        setIsAddOpen(false);
        setFormData({ username: '', display_name: '', password: '', phone: '', commission_percent: 5, credit_limit: 10000, share_percent: 0, parent_agent_id: '' });
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
    setIsLoading(false);
  };

  const handleEdit = async () => {
    if (!selectedAgent) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/manual-key-agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedAgent.id, ...formData, action: 'update' }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('แก้ไขเอเย่นสำเร็จ');
        setIsEditOpen(false);
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
    setIsLoading(false);
  };

  const handleSuspend = async (agent: ManualKeyAgent) => {
    if (!confirm(`ต้องการ${agent.status === 'suspended' ? 'เปิดใช้งาน' : 'ระงับ'}เอเย่น ${agent.display_name}?`)) return;
    
    try {
      const res = await fetch('/api/manual-key-agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agent.id, status: agent.status === 'suspended' ? 'active' : 'suspended', action: 'toggle_status' }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(agent.status === 'suspended' ? 'เปิดใช้งานเอเย่นแล้ว' : 'ระงับเอเย่นแล้ว');
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Toggle 2FA
  const handleToggle2FA = async (agent: ManualKeyAgent) => {
    const newStatus = !agent.two_factor_enabled;
    try {
      const res = await fetch('/api/manual-key-agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agent.id, two_factor_enabled: newStatus, action: 'toggle_2fa' }),
      });
      const result = await res.json();
      if (result.success) { 
        toast.success(newStatus ? 'เปิดใช้งาน 2FA แล้ว' : 'ปิดใช้งาน 2FA แล้ว'); 
        mutate(); 
      } else toast.error(result.error || 'เกิดข้อผิดพลาด');
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const handleResetPassword = async (agent: ManualKeyAgent) => {
    const newPassword = prompt('กรอกรหัสผ่านใหม่:');
    if (!newPassword) return;
    
    try {
      const res = await fetch('/api/manual-key-agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agent.id, password: newPassword, action: 'reset_password' }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('รีเซ็ตรหัสผ่านสำเร็จ');
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const openEdit = (agent: ManualKeyAgent) => {
    setSelectedAgent(agent);
    setFormData({
      username: agent.username,
      display_name: agent.display_name,
      password: '',
      phone: agent.phone || '',
      commission_percent: agent.commission_percent,
      credit_limit: agent.credit_limit,
      share_percent: agent.share_percent,
      parent_agent_id: agent.parent_user_id || '',
    });
    setIsEditOpen(true);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('th-TH').format(num);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent flex items-center gap-2">
            <UsersRound className="size-6" />
            เอเย่นคีย์หวย
          </h1>
          <p className="text-muted-foreground">จัดการเอเย่นในระบบคีย์หวย (Manual Key)</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="size-4 mr-2" />
              เพิ่มเอเย่น
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>เพิ่มเอเย่นคีย์หวย</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ชื่อผู้ใช้ *</Label>
                <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="username" />
              </div>
              <div className="space-y-2">
                <Label>ชื่อแสดง *</Label>
                <Input value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="ชื่อ-นามสกุล" />
              </div>
              <div className="space-y-2">
                <Label>รหัสผ่าน *</Label>
                <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="รหัสผ่าน" />
              </div>
              <div className="space-y-2">
                <Label>เบอร์โทร</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="0812345678" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>คอมมิชชั่น %</Label>
                  <Input type="number" value={formData.commission_percent} onChange={e => setFormData({...formData, commission_percent: Number(e.target.value)})} min={0} max={100} />
                </div>
                <div className="space-y-2">
                  <Label>หุ้นลม %</Label>
                  <Input type="number" value={formData.share_percent} onChange={e => setFormData({...formData, share_percent: Number(e.target.value)})} min={0} max={100} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>วงเงินเครดิต</Label>
                <Input type="number" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: Number(e.target.value)})} min={0} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleAdd} disabled={isLoading}>
                {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
                เพิ่มเอเย่น
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card/50 border-accent/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20"><Users className="size-5 text-accent" /></div>
              <div>
                <p className="text-xs text-muted-foreground">เอเย่นทั้งหมด</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20"><Users className="size-5 text-green-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">ใช้งานอยู่</p>
                <p className="text-xl font-bold text-green-500">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20"><UserX className="size-5 text-red-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">ถูกระงับ</p>
                <p className="text-xl font-bold text-red-500">{stats.suspended}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20"><TrendingUp className="size-5 text-blue-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">ยอดขายรวม</p>
                <p className="text-xl font-bold">{formatNumber(stats.totalSales)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20"><DollarSign className="size-5 text-purple-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">คอมมิชชั่นรวม</p>
                <p className="text-xl font-bold">{formatNumber(stats.totalCommission)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="ค้นหา username, ชื่อ, เบอร์โทร..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="สถานะ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="active">ใช้งานอยู่</SelectItem>
                <SelectItem value="suspended">ถูกระงับ</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => mutate()}><RefreshCw className="size-4 mr-2" />รีเฟรช</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เอเย่น</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead className="text-right">คอมมิชชั่น</TableHead>
                <TableHead className="text-right">หุ้นลม</TableHead>
                <TableHead className="text-right">วงเงิน</TableHead>
                <TableHead className="text-right">ยอดคงเหลือ</TableHead>
                <TableHead className="text-center">ลูกทีม</TableHead>
                <TableHead className="text-center">สมาชิก</TableHead>
                <TableHead className="text-right">ยอดขาย</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลเอเย่น</TableCell>
                </TableRow>
              ) : (
                agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{agent.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{agent.username}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={agent.status === 'active' ? 'default' : 'destructive'}>
                        {agent.status === 'active' ? 'ใช้งาน' : 'ระงับ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{agent.commission_percent}%</TableCell>
                    <TableCell className="text-right font-medium">{agent.share_percent}%</TableCell>
                    <TableCell className="text-right">{formatNumber(agent.credit_limit)}</TableCell>
                    <TableCell className="text-right font-medium text-accent">{formatNumber(agent.credit_balance)}</TableCell>
                    <TableCell className="text-center">{agent.downline_count}</TableCell>
                    <TableCell className="text-center">{agent.member_count}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(agent.total_sales)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(agent)}><Edit className="size-4 mr-2" />แก้ไข</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetPassword(agent)}><Key className="size-4 mr-2" />รีเซ็ตรหัสผ่าน</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle2FA(agent)}>
                            {agent.two_factor_enabled ? <><ShieldOff className="size-4 mr-2" />ปิด 2FA</> : <><ShieldCheck className="size-4 mr-2" />เปิด 2FA</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.location.href = `/manual-key-agents/network?agent=${agent.id}`}><Users className="size-4 mr-2" />ดูลูกทีม</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.location.href = `/manual-key-agents/commission?agent=${agent.id}`}><TrendingUp className="size-4 mr-2" />ดูรายได้</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSuspend(agent)} className={agent.status === 'suspended' ? 'text-green-600' : 'text-red-600'}>
                            <UserX className="size-4 mr-2" />{agent.status === 'suspended' ? 'เปิดใช้งาน' : 'ระงับ'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขเอเย่น: {selectedAgent?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อแสดง</Label>
              <Input value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>เบอร์โทร</Label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>คอมมิชชั่น %</Label>
                <Input type="number" value={formData.commission_percent} onChange={e => setFormData({...formData, commission_percent: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label>หุ้นลม %</Label>
                <Input type="number" value={formData.share_percent} onChange={e => setFormData({...formData, share_percent: Number(e.target.value)})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>วงเงินเครดิต</Label>
              <Input type="number" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: Number(e.target.value)})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleEdit} disabled={isLoading}>
              {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
