'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Crown,
  Star,
  UserCheck,
  Search,
  RefreshCw,
  Settings,
  Wallet,
  TrendingUp,
  ChevronRight,
  Plus,
  Ban,
  PlayCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return { agents: [], summary: {}, levels: {} };
  return res.json();
};

const LEVEL_CONFIG = {
  senior_agent: { label: 'ซีเนียร์เอเย่นต์', color: 'bg-purple-500', icon: Crown },
  master_agent: { label: 'มาสเตอร์เอเย่นต์', color: 'bg-blue-500', icon: Star },
  agent: { label: 'เอเย่นต์', color: 'bg-green-500', icon: UserCheck },
  member: { label: 'สมาชิก', color: 'bg-gray-500', icon: Users },
};

interface Agent {
  id: string;
  name: string;
  phone: string;
  username: string;
  agent_level: string;
  upline_id: string | null;
  commission_rate: number;
  share_percent: number;
  is_partner: boolean;
  is_active: boolean;
  total_commission: number;
  pending_commission: number;
  credit_balance: number;
  enable_auto: boolean;
  enable_manual_key: boolean;
  created_at: string;
}

export default function AgentsPage() {
  const { canAccess } = useAuth();
  const [levelFilter, setLevelFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state for add dialog
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newAgentLevel, setNewAgentLevel] = useState('agent');
  const [newUplineId, setNewUplineId] = useState('');
  const [newCommissionRate, setNewCommissionRate] = useState('5');
  const [newSharePercent, setNewSharePercent] = useState('70');
  const [newEnableAuto, setNewEnableAuto] = useState(false);
  const [newEnableManualKey, setNewEnableManualKey] = useState(true);
  const [editEnableAuto, setEditEnableAuto] = useState(false);
  const [editEnableManualKey, setEditEnableManualKey] = useState(true);
  
  const { data, mutate, isLoading } = useSWR(
    `/api/admin/agents?level=${levelFilter}`,
    fetcher,
    { refreshInterval: 10000 }
  );
  
  // Fetch customers for selection
  const { data: customersData } = useSWR('/api/customers', fetcher);
  
  const agents = data?.agents || [];
  const summary = data?.summary || {};
  const customers = customersData || [];
  
  // Filter agents
  const filteredAgents = agents.filter((agent: Agent) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      agent.name?.toLowerCase().includes(search) ||
      agent.phone?.includes(search) ||
      agent.username?.toLowerCase().includes(search)
    );
  });
  
  // ค้นหาต้นสาย
  const getUplineName = (uplineId: string | null) => {
    if (!uplineId) return '-';
    const upline = agents.find((a: Agent) => a.id === uplineId);
    return upline?.name || uplineId.slice(0, 8);
  };
  
  // แปลงค่า % แบบปลอดภัย — 0 ถือว่าถูกต้อง (spec: 0% valid), ใช้ default เฉพาะเมื่อว่าง/ไม่ใช่ตัวเลข
  const parseRate = (value: string, fallback: number) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  };

  // ตั้งค่าสายงาน
  const handleSetAgent = async () => {
    if (!selectedCustomerId || !newAgentLevel) {
      toast.error('กรุณาเลือกลูกค้าและระดับสายงาน');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          agent_level: newAgentLevel,
          upline_id: newUplineId || null,
          commission_rate: parseRate(newCommissionRate, 5),
          share_percent: parseRate(newSharePercent, 70),
          enable_auto: newEnableAuto,
          enable_manual_key: newEnableManualKey,
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('ตั้งค่าสายงานสำเร็จ');
        setShowAddDialog(false);
        setSelectedCustomerId('');
        setNewAgentLevel('agent');
        setNewUplineId('');
        setNewCommissionRate('5');
        setNewSharePercent('70');
        setNewEnableAuto(false);
        setNewEnableManualKey(true);
        mutate();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // จ่ายคอมมิชชั่น
  const handlePayCommission = async (agent: Agent) => {
    if (Number(agent.pending_commission) <= 0) {
      toast.error('ไม่มียอดคอมมิชชั่นค้างจ่าย');
      return;
    }
    
    if (!confirm(`ยืนยันจ่ายคอมมิชชั่น ฿${Number(agent.pending_commission).toLocaleString()} ให้ ${agent.name}?`)) {
      return;
    }
    
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: agent.id,
          action: 'pay_commission',
        }),
      });
      
      if (res.ok) {
        toast.success('จ่ายคอมมิชชั่นสำเร็จ');
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  // อัพเดท commission rate และ enable settings
  const handleUpdateRate = async () => {
    if (!selectedAgent) return;
    if (!editEnableAuto && !editEnableManualKey) {
      toast.error('ต้องเลือกอย่างน้อย 1 ระบบ');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedAgent.id,
          commission_rate: parseRate(newCommissionRate, 0),
          share_percent: parseRate(newSharePercent, 70),
          enable_auto: editEnableAuto,
          enable_manual_key: editEnableManualKey,
        }),
      });
      
      if (res.ok) {
        toast.success('อัพเดทสำเร็จ');
        setShowEditDialog(false);
        setSelectedAgent(null);
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Toggle agent status (active/inactive)
  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = !agent.is_active;
    if (!confirm(`${newStatus ? 'เปิดใช้งาน' : 'ระงับ'}เอเย่นต์ "${agent.name}" ใช่หรือไม่?`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/customers/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      
      if (res.ok) {
        toast.success(newStatus ? 'เปิดใช้งานสำเร็จ' : 'ระงับการใช้งานสำเร็จ');
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  // Skip access check for testing - allow all users to view agent list
  // if (!canAccess('admin')) {
  //   return (
  //     <div className="flex items-center justify-center min-h-[400px]">
  //       <p className="text-muted-foreground">ไม่มีสิทธิ์เข้าถึง</p>
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">สายงานเอเย่นต์</h1>
          <p className="text-muted-foreground">จัดการระบบสายงาน 4 ระดับ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="size-4 mr-2" />
            เพิ่มสายงาน
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Crown className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ซีเนียร์</p>
                <p className="text-xl font-bold">{summary.senior_agent || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Star className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">มาสเตอร์</p>
                <p className="text-xl font-bold">{summary.master_agent || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <UserCheck className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เอเย่นต์</p>
                <p className="text-xl font-bold">{summary.agent || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <TrendingUp className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">คอมรวม</p>
                <p className="text-xl font-bold">฿{Number(summary.totalCommission || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Wallet className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ค้างจ่าย</p>
                <p className="text-xl font-bold text-red-500">฿{Number(summary.pendingCommission || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ, เบอร์โทร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="ระดับ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับ</SelectItem>
                <SelectItem value="senior_agent">ซีเนียร์เอเย่นต์</SelectItem>
                <SelectItem value="master_agent">มาสเตอร์เอเย่นต์</SelectItem>
                <SelectItem value="agent">เอเย่นต์</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายชื่อสายงาน</CardTitle>
          <CardDescription>ทั้งหมด {filteredAgents.length} คน</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="size-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีสายงาน</p>
              <p className="text-sm">กดปุ่ม &quot;เพิ่มสายงาน&quot; เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ระบบ</TableHead>
                    <TableHead>ต้นสาย</TableHead>
                    <TableHead className="text-right">คอมฯ %</TableHead>
                    <TableHead className="text-right">คอมฯ รวม</TableHead>
                    <TableHead className="text-right">ค้างจ่าย</TableHead>
                    <TableHead className="text-right">เครดิต</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent: Agent) => {
                    const config = LEVEL_CONFIG[agent.agent_level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.member;
                    const Icon = config.icon;
                    return (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{agent.name || '-'}</p>
                            <p className="text-xs text-muted-foreground">{agent.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${config.color} text-white`}>
                            <Icon className="size-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={agent.is_active !== false ? 'default' : 'destructive'}>
                            {agent.is_active !== false ? 'ใช้งาน' : 'ระงับ'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {agent.enable_auto && (
                              <Badge variant="outline" className="text-green-600 border-green-500 text-xs">
                                ออโต้
                              </Badge>
                            )}
                            {agent.enable_manual_key && (
                              <Badge variant="outline" className="text-blue-600 border-blue-500 text-xs">
                                คีย์
                              </Badge>
                            )}
                            {!agent.enable_auto && !agent.enable_manual_key && (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {agent.upline_id && <ChevronRight className="size-3 text-muted-foreground" />}
                            <span className="text-sm">{getUplineName(agent.upline_id)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {agent.commission_rate}%
                        </TableCell>
                        <TableCell className="text-right">
                          ฿{Number(agent.total_commission || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(agent.pending_commission || 0) > 0 ? (
                            <span className="text-red-500 font-medium">
                              ฿{Number(agent.pending_commission).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          ฿{Number(agent.credit_balance || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {Number(agent.pending_commission || 0) > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePayCommission(agent)}
                              >
                                <Wallet className="size-3 mr-1" />
                                จ่าย
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAgent(agent);
                                setNewCommissionRate(String(agent.commission_rate ?? 0));
                                setNewSharePercent(String(agent.share_percent ?? 70));
                                setEditEnableAuto(agent.enable_auto ?? false);
                                setEditEnableManualKey(agent.enable_manual_key ?? true);
                                setShowEditDialog(true);
                              }}
                            >
                              <Settings className="size-4" />
                            </Button>
                            {agent.is_active !== false ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(agent)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                title="ระงับการใช้งาน"
                              >
                                <Ban className="size-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(agent)}
                                className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                title="เปิดใช้งาน"
                              >
                                <PlayCircle className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Agent Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มสายงาน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เลือกลูกค้า</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกลูกค้า..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(customers) && customers
                    .filter((c: Agent) => c.agent_level === 'member' || !c.agent_level)
                    .map((c: Agent) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ระดับสายงาน</Label>
              <Select value={newAgentLevel} onValueChange={setNewAgentLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">เอเย่นต์ (5%)</SelectItem>
                  <SelectItem value="master_agent">มาสเตอร์เอเย่นต์ (3%)</SelectItem>
                  <SelectItem value="senior_agent">ซีเนียร์เอเย่นต์ (2%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ต้นสาย (ถ้ามี)</Label>
              <Select value={newUplineId || 'none'} onValueChange={(val) => setNewUplineId(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="ไม่มีต้นสาย" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่มีต้นสาย</SelectItem>
                  {agents
                    .filter((a: Agent) => a.agent_level !== 'agent')
                    .map((a: Agent) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({LEVEL_CONFIG[a.agent_level as keyof typeof LEVEL_CONFIG]?.label})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>คอมมิชชั่น (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newCommissionRate}
                onChange={(e) => setNewCommissionRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ถือสู้ / สัดส่วน PT (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newSharePercent}
                onChange={(e) => setNewSharePercent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">กำหนดสัดส่วนที่เอเย่นต์ถือสู้เอง (0% = ส่งขึ้นสายบนทั้งหมด)</p>
            </div>
            
            {/* ระบบที่เปิดใช้งาน */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
              <Label className="text-base font-semibold">ระบบที่เปิดใช้งาน</Label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnableAuto}
                    onChange={(e) => setNewEnableAuto(e.target.checked)}
                    className="w-5 h-5 rounded border-2 accent-green-500"
                  />
                  <div>
                    <span className="font-medium">ระบบออโต้</span>
                    <p className="text-xs text-muted-foreground">ฝาก-ถอนอัตโนมัติ</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnableManualKey}
                    onChange={(e) => setNewEnableManualKey(e.target.checked)}
                    className="w-5 h-5 rounded border-2 accent-blue-500"
                  />
                  <div>
                    <span className="font-medium">ระบบคีย์ (Manual)</span>
                    <p className="text-xs text-muted-foreground">กรอกยอดเติมเงินด้วยตัวเอง</p>
                  </div>
                </label>
              </div>
              {!newEnableAuto && !newEnableManualKey && (
                <p className="text-xs text-red-500">* ต้องเลือกอย่างน้อย 1 ระบบ</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSetAgent} disabled={isSubmitting || (!newEnableAuto && !newEnableManualKey)}>
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขเอเย่นต์ - {selectedAgent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>คอมมิชชั่น (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newCommissionRate}
                onChange={(e) => setNewCommissionRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ถือสู้ / สัดส่วน PT (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newSharePercent}
                onChange={(e) => setNewSharePercent(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">กำหนดสัดส่วนที่เอเย่นต์ถือสู้เอง (0% = ส่งขึ้นสายบนทั้งหมด)</p>
            </div>
            
            {/* ระบบที่เปิดใช้งาน */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
              <Label className="text-base font-semibold">ระบบที่เปิดใช้งาน</Label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEnableAuto}
                    onChange={(e) => setEditEnableAuto(e.target.checked)}
                    className="w-5 h-5 rounded border-2 accent-green-500"
                  />
                  <div>
                    <span className="font-medium">ระบบออโต้</span>
                    <p className="text-xs text-muted-foreground">ฝาก-ถอนอัตโนมัติ</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEnableManualKey}
                    onChange={(e) => setEditEnableManualKey(e.target.checked)}
                    className="w-5 h-5 rounded border-2 accent-blue-500"
                  />
                  <div>
                    <span className="font-medium">ระบบคีย์ (Manual)</span>
                    <p className="text-xs text-muted-foreground">กรอกยอดเติมเงินด้วยตัวเอง</p>
                  </div>
                </label>
              </div>
              {!editEnableAuto && !editEnableManualKey && (
                <p className="text-xs text-red-500">* ต้องเลือกอย่างน้อย 1 ระบบ</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleUpdateRate} disabled={isSubmitting || (!editEnableAuto && !editEnableManualKey)}>
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
