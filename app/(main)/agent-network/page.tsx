'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Users,
  UserPlus,
  Settings,
  TrendingUp,
  Wallet,
  Share2,
  Network,
  ChevronRight,
  Loader2,
  Crown,
  Shield,
  Building2,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetcher } from '@/lib/fetcher';

interface Agent {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_unlimited_credit: boolean;
  credit_balance: number;
  parent_id: string | null;
  hierarchy_level: number;
  created_at: string;
  settings: {
    id: string;
    agent_share_percent: number;
    parent_share_percent: number;
    max_accept_limit: number | null;
    is_active: boolean;
  } | null;
  stats: {
    customerCount: number;
    entryCount: number;
    totalAmount: number;
    subAgentCount: number;
  };
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  agent: 'Agent',
  partner: 'Partner',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-500',
  admin: 'bg-blue-500',
  agent: 'bg-green-500',
  partner: 'bg-orange-500',
};

export default function AgentNetworkPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [sharePercent, setSharePercent] = useState(100);
  const [maxLimit, setMaxLimit] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Add Agent Form State
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentDisplayName, setNewAgentDisplayName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('agent');
  const [newAgentParentId, setNewAgentParentId] = useState<string>('');
  const [newAgentSharePercent, setNewAgentSharePercent] = useState(70);
  const [addingAgent, setAddingAgent] = useState(false);
  
  const { data: agents = [], mutate, isLoading } = useSWR<Agent[]>(
    '/api/agent-network',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  // Group agents by hierarchy
  const agentsByLevel = agents.reduce((acc, agent) => {
    const level = agent.hierarchy_level || 0;
    if (!acc[level]) acc[level] = [];
    acc[level].push(agent);
    return acc;
  }, {} as Record<number, Agent[]>);
  
  // Calculate totals
  const totals = {
    agents: agents.length,
    customers: agents.reduce((sum, a) => sum + a.stats.customerCount, 0),
    entries: agents.reduce((sum, a) => sum + a.stats.entryCount, 0),
    totalAmount: agents.reduce((sum, a) => sum + a.stats.totalAmount, 0),
  };
  
  const handleOpenSettings = (agent: Agent) => {
    setSelectedAgent(agent);
    setSharePercent(agent.settings?.agent_share_percent || 100);
    setMaxLimit(agent.settings?.max_accept_limit?.toString() || '');
    setIsActive(agent.settings?.is_active !== false);
    setShowSettings(true);
  };
  
  const handleSaveSettings = async () => {
    if (!selectedAgent) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/agent-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedAgent.id,
          agent_share_percent: sharePercent,
          parent_share_percent: 100 - sharePercent,
          max_accept_limit: maxLimit ? parseFloat(maxLimit) : null,
          is_active: isActive,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast.success('บันทึกการตั้งค่าเรียบร้อย');
      mutate();
      setShowSettings(false);
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };
  
  const getParentName = (parentId: string | null) => {
    if (!parentId) return '-';
    const parent = agents.find(a => a.id === parentId);
    return parent?.display_name || parent?.username || '-';
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="size-6 text-primary" />
            สายงานเอเย่นต์
          </h1>
          <p className="text-muted-foreground mt-1">จัดการสายงานและส่วนแบ่งเปอร์เซ็นต์</p>
        </div>
        <Button onClick={() => setShowAddAgent(true)}>
          <UserPlus className="size-4 mr-2" />
          เพิ่มเอเย่นต์
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-transparent border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">จำนวนเอเย่นต์</p>
                <p className="text-3xl font-bold text-blue-600">{totals.agents}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Users className="size-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/20 via-green-500/10 to-transparent border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ลูกค้าทั้งหมด</p>
                <p className="text-3xl font-bold text-green-600">{totals.customers}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/20">
                <Building2 className="size-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">โพยทั้งหมด</p>
                <p className="text-3xl font-bold text-purple-600">{totals.entries.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/20">
                <TrendingUp className="size-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดรวม</p>
                <p className="text-3xl font-bold text-amber-600">{totals.totalAmount.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/20">
                <Wallet className="size-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">ตาราง</TabsTrigger>
          <TabsTrigger value="hierarchy">โครงสร้างสายงาน</TabsTrigger>
        </TabsList>
        
        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>รายชื่อเอเย่นต์ทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>ต้นสาย</TableHead>
                    <TableHead className="text-center">ส่วนแบ่ง</TableHead>
                    <TableHead className="text-right">ลูกค้า</TableHead>
                    <TableHead className="text-right">โพย</TableHead>
                    <TableHead className="text-right">ยอดรวม</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`size-8 rounded-full flex items-center justify-center ${ROLE_COLORS[agent.role] || 'bg-gray-500'}`}>
                            {agent.role === 'super_admin' ? (
                              <Crown className="size-4 text-white" />
                            ) : (
                              <Shield className="size-4 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{agent.display_name || agent.username}</p>
                            <p className="text-xs text-muted-foreground">@{agent.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_COLORS[agent.role]?.replace('bg-', 'border-') + ' text-foreground'}>
                          {ROLE_LABELS[agent.role] || agent.role}
                        </Badge>
                      </TableCell>
                      <TableCell>{getParentName(agent.parent_id)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-green-600 font-medium">{agent.settings?.agent_share_percent || 100}%</span>
                          {agent.settings?.parent_share_percent ? (
                            <>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-orange-600 font-medium">{agent.settings.parent_share_percent}%</span>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{agent.stats.customerCount}</TableCell>
                      <TableCell className="text-right">{agent.stats.entryCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">{agent.stats.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        {agent.settings?.is_active !== false ? (
                          <Badge className="bg-green-500">เปิดใช้งาน</Badge>
                        ) : (
                          <Badge variant="secondary">ปิดใช้งาน</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenSettings(agent)}
                        >
                          <Settings className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {agents.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="size-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีเอเย่นต์ในระบบ</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="hierarchy">
          <Card>
            <CardHeader>
              <CardTitle>โครงสร้างสายงาน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(agentsByLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, levelAgents]) => (
                  <div key={level}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      ระดับ {level} ({levelAgents.length} คน)
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {levelAgents.map((agent) => (
                        <div
                          key={agent.id}
                          className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleOpenSettings(agent)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`size-10 rounded-full flex items-center justify-center ${ROLE_COLORS[agent.role] || 'bg-gray-500'}`}>
                                {agent.role === 'super_admin' ? (
                                  <Crown className="size-5 text-white" />
                                ) : (
                                  <Shield className="size-5 text-white" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{agent.display_name || agent.username}</p>
                                <p className="text-xs text-muted-foreground">{ROLE_LABELS[agent.role]}</p>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </div>
                          
                          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                            <div className="p-2 rounded bg-muted/50">
                              <p className="font-medium">{agent.stats.customerCount}</p>
                              <p className="text-xs text-muted-foreground">ลูกค้า</p>
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <p className="font-medium">{agent.stats.subAgentCount}</p>
                              <p className="text-xs text-muted-foreground">ลูกข่าย</p>
                            </div>
                            <div className="p-2 rounded bg-muted/50">
                              <p className="font-medium text-green-600">{agent.settings?.agent_share_percent || 100}%</p>
                              <p className="text-xs text-muted-foreground">ส่วนแบ่ง</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              ตั้งค่าเอเย่นต์
            </DialogTitle>
          </DialogHeader>
          
          {selectedAgent && (
            <div className="space-y-6">
              {/* Agent Info */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className={`size-12 rounded-full flex items-center justify-center ${ROLE_COLORS[selectedAgent.role] || 'bg-gray-500'}`}>
                  {selectedAgent.role === 'super_admin' ? (
                    <Crown className="size-6 text-white" />
                  ) : (
                    <Shield className="size-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-lg">{selectedAgent.display_name || selectedAgent.username}</p>
                  <p className="text-sm text-muted-foreground">{ROLE_LABELS[selectedAgent.role]}</p>
                </div>
              </div>
              
              {/* Share Percentage */}
              <div className="space-y-4">
                <Label>ส่วนแบ่งเปอร์เซ็นต์</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Slider
                      value={[sharePercent]}
                      onValueChange={([val]) => setSharePercent(val)}
                      max={100}
                      min={0}
                      step={5}
                    />
                  </div>
                  <div className="w-20 text-center">
                    <span className="text-2xl font-bold text-green-600">{sharePercent}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="size-4 text-green-500" />
                    <span>รับเอง: <strong className="text-green-600">{sharePercent}%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="size-4 text-orange-500" />
                    <span>ส่งต้นสาย: <strong className="text-orange-600">{100 - sharePercent}%</strong></span>
                  </div>
                </div>
              </div>
              
              {/* Max Limit */}
              <div className="space-y-2">
                <Label>วงเงินรับสูงสุด (ต่อโพย)</Label>
                <Input
                  type="number"
                  placeholder="ไม่จำกัด"
                  value={maxLimit}
                  onChange={(e) => setMaxLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">เว้นว่างหากไม่ต้องการจำกัด</p>
              </div>
              
              {/* Active Status */}
              <div className="flex items-center justify-between">
                <Label>สถานะการใช้งาน</Label>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Agent Dialog */}
      <Dialog open={showAddAgent} onOpenChange={setShowAddAgent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มเอเย่นต์ใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ชื่อผู้ใช้ (Username) *</Label>
              <Input
                placeholder="เช่น agent001"
                value={newAgentUsername}
                onChange={(e) => setNewAgentUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>รหัสผ่าน *</Label>
              <Input
                type="password"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                value={newAgentPassword}
                onChange={(e) => setNewAgentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ชื่อที่แสดง</Label>
              <Input
                placeholder="เช่น เอเย่นต์สมชาย"
                value={newAgentDisplayName}
                onChange={(e) => setNewAgentDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>เบอร์โทรศัพท์</Label>
              <Input
                placeholder="0812345678"
                value={newAgentPhone}
                onChange={(e) => setNewAgentPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ระดับ</Label>
              <Select value={newAgentRole} onValueChange={setNewAgentRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent (เอเย่นต์)</SelectItem>
                  <SelectItem value="partner">Partner (หุ้นส่วน)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>สายงาน (ต้นสาย)</Label>
              <Select value={newAgentParentId} onValueChange={setNewAgentParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกต้นสาย (ไม่บังคับ)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่มีต้นสาย (สายตรง)</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.display_name || agent.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ส่วนแบ่ง: {newAgentSharePercent}%</Label>
              <Slider
                value={[newAgentSharePercent]}
                onValueChange={([v]) => setNewAgentSharePercent(v)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                เอเย่นต์ได้ {newAgentSharePercent}% | ต้นสายได้ {100 - newAgentSharePercent}%
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAgent(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={async () => {
                if (!newAgentUsername || !newAgentPassword) {
                  toast.error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
                  return;
                }
                if (newAgentPassword.length < 6) {
                  toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
                  return;
                }
                
                setAddingAgent(true);
                try {
                  const res = await fetch('/api/agent-network/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      username: newAgentUsername,
                      password: newAgentPassword,
                      display_name: newAgentDisplayName || newAgentUsername,
                      phone: newAgentPhone,
                      role: newAgentRole,
                      parent_id: newAgentParentId === 'none' ? null : newAgentParentId || null,
                      share_percent: newAgentSharePercent,
                    }),
                  });
                  
                  const result = await res.json();
                  if (!res.ok) throw new Error(result.error || 'เกิดข้อผิดพลาด');
                  
                  toast.success('เพิ่มเอเย่นต์สำเร็จ');
                  mutate();
                  setShowAddAgent(false);
                  // Reset form
                  setNewAgentUsername('');
                  setNewAgentPassword('');
                  setNewAgentDisplayName('');
                  setNewAgentPhone('');
                  setNewAgentRole('agent');
                  setNewAgentParentId('');
                  setNewAgentSharePercent(70);
                } catch (err: any) {
                  toast.error(err.message || 'ไม่สามารถเพิ่มเอเย่นต์ได้');
                } finally {
                  setAddingAgent(false);
                }
              }}
              disabled={addingAgent}
            >
              {addingAgent ? <Loader2 className="size-4 mr-2 animate-spin" /> : <UserPlus className="size-4 mr-2" />}
              เพิ่มเอเย่นต์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
