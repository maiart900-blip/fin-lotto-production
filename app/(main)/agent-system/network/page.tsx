'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, GitBranch, Users, ChevronRight, ChevronDown, User, ArrowRight, GripVertical, Loader2, RefreshCw, Zap, Plus, Keyboard, AlertTriangle, Home } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
});

interface AgentNode {
  id: string;
  code: string;
  name: string;
  display_name: string;
  phone: string;
  status: string;
  share_percent: number;
  system_type: string;
  level: number;
  children: AgentNode[];
}

function TreeNode({ node, onMove, onSelect, selectedId }: { node: AgentNode; onMove: (id: string) => void; onSelect: (node: AgentNode) => void; selectedId: string | null; }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-4">
      <div 
        className={`flex items-center gap-2 p-2 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors ${selectedId === node.id ? 'bg-accent/20 border border-accent/50' : ''}`} 
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="p-1 hover:bg-accent/20 rounded">
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (<div className="w-6" />)}
        <div className={`p-2 rounded-full ${node.status === 'active' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <User className={`size-4 ${node.status === 'active' ? 'text-green-500' : 'text-red-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{node.display_name || node.name}</span>
            <Badge variant="outline" className="text-xs shrink-0">Lv.{node.level || 1}</Badge>
            <Badge variant={node.system_type === 'auto' ? 'default' : 'secondary'} className="text-xs shrink-0">
              {node.system_type === 'auto' ? 'ออโต้' : 'คีย์'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{node.phone || node.code} | ส่วนแบ่ง: {node.share_percent || 0}%</div>
        </div>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onMove(node.id); }} className="shrink-0">
          <GripVertical className="size-4" />
        </Button>
      </div>
      {isExpanded && hasChildren && (
        <div className="border-l-2 border-accent/30 ml-3">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} onMove={onMove} onSelect={onSelect} selectedId={selectedId} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentNetworkPage() {
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [moveAgentId, setMoveAgentId] = useState<string | null>(null);
  const [targetAgentId, setTargetAgentId] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    phone: '',
    password: '',
    share_percent: 90,
    parent_id: '',
    system_type: 'manual_key' as 'manual_key' | 'auto'
  });

  const { data, error, isLoading, mutate } = useSWR<{ tree: AgentNode[], agents: any[], stats: any }>(
    `/api/agent-network/list?search=${search}`, 
    fetcher
  );
  
  const tree = data?.tree || [];
  const allAgents = data?.agents || [];
  const stats = data?.stats || { totalAgents: 0, autoOnly: 0, keyOnly: 0, both: 0, active: 0 };

  const handleMove = (agentId: string) => { 
    setMoveAgentId(agentId); 
    setIsMoveOpen(true); 
  };

  const confirmMove = async () => {
    if (!moveAgentId || !targetAgentId) { 
      toast.error('Please select target agent'); 
      return; 
    }
    setIsMoving(true);
    try {
      const res = await fetch('/api/agent-network/move', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ agentId: moveAgentId, targetAgentId }) 
      });
      const result = await res.json();
      if (result.success) { 
        toast.success('Agent moved successfully'); 
        setIsMoveOpen(false); 
        setMoveAgentId(null); 
        setTargetAgentId(''); 
        mutate(); 
      } else { 
        toast.error(result.error || 'Error occurred'); 
      }
    } catch { 
      toast.error('Error occurred'); 
    }
    setIsMoving(false);
  };

  const createAgent = async () => {
    if (!newAgent.name || !newAgent.phone || !newAgent.password) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch('/api/agent/downline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_id: newAgent.parent_id === 'none' || !newAgent.parent_id ? null : newAgent.parent_id,
          name: newAgent.name,
          phone: newAgent.phone,
          password: newAgent.password,
          share_percent: newAgent.share_percent,
          type: 'agent',
          system_type: newAgent.system_type
        })
      });
      const result = await res.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`สร้างเอเย่นต์ "${newAgent.name}" สำเร็จ`);
        setIsAddOpen(false);
        setNewAgent({ name: '', phone: '', password: '', share_percent: 90, parent_id: '', system_type: 'manual_key' });
        mutate();
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
    setIsCreating(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="p-4 rounded-full bg-red-500/20">
          <AlertTriangle className="size-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-red-500">Error Loading Data</h2>
        <p className="text-muted-foreground">Cannot load data. Please try again.</p>
        <div className="flex gap-2">
          <Button onClick={() => mutate()} className="bg-accent hover:bg-accent/90">
            <RefreshCw className="size-4 mr-2" />
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            <Home className="size-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent flex items-center gap-2">
            <GitBranch className="size-6" />
            สายงานเอเย่นต์
          </h1>
          <p className="text-muted-foreground">จัดการเอเย่นต์ทั้งระบบออโต้และคีย์หวย</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="bg-accent hover:bg-accent/90">
            <Plus className="size-4 mr-2" />
            เพิ่มเอเย่นต์
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-card/50 border-accent/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20">
                <Users className="size-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">เอเย่นต์ทั้งหมด</p>
                <p className="text-xl font-bold">{stats.totalAgents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-cyan-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Zap className="size-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">เฉพาะออโต้</p>
                <p className="text-xl font-bold text-cyan-500">{stats.autoOnly}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Keyboard className="size-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">เฉพาะคีย์</p>
                <p className="text-xl font-bold text-yellow-500">{stats.keyOnly}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <GitBranch className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ทั้งสองระบบ</p>
                <p className="text-xl font-bold text-purple-500">{stats.both}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <User className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ใช้งานอยู่</p>
                <p className="text-xl font-bold text-green-500">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="ค้นหาเอเย่นต์..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-10" 
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">โครงสร้างสายงาน</CardTitle>
          </CardHeader>
          <CardContent>
            {tree.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">ไม่พบเอเย่นต์</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {tree.map((node) => (
                  <TreeNode 
                    key={node.id} 
                    node={node} 
                    onMove={handleMove} 
                    onSelect={setSelectedNode} 
                    selectedId={selectedNode?.id || null} 
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">รายละเอียดเอเย่นต์</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${selectedNode.status === 'active' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <User className={`size-6 ${selectedNode.status === 'active' ? 'text-green-500' : 'text-red-500'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedNode.display_name || selectedNode.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedNode.phone || selectedNode.code}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-card border">
                    <p className="text-xs text-muted-foreground">ระดับ</p>
                    <p className="font-bold">{selectedNode.level || 1}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border">
                    <p className="text-xs text-muted-foreground">ส่วนแบ่ง %</p>
                    <p className="font-bold">{selectedNode.share_percent || 0}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border">
                    <p className="text-xs text-muted-foreground">ระบบ</p>
                    <p className="font-bold">{selectedNode.system_type === 'auto' ? 'ออโต้' : 'คีย์'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border">
                    <p className="text-xs text-muted-foreground">สถานะ</p>
                    <p className={`font-bold ${selectedNode.status === 'active' ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedNode.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleMove(selectedNode.id)}>
                  <ArrowRight className="size-4 mr-2" />
                  ย้ายเอเย่นต์
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                คลิกเลือกเอเย่นต์เพื่อดูรายละเอียด
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Move Agent Dialog */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ย้ายเอเย่นต์ไปยังต้นสายใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>เลือกเอเย่นต์เป้าหมาย</Label>
              <Select value={targetAgentId} onValueChange={setTargetAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเอเย่นต์..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">ระดับบนสุด (ไม่มีต้นสาย)</SelectItem>
                  {allAgents.filter(a => a.id !== moveAgentId).map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.display_name || agent.name} (Lv.{agent.level || 1})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveOpen(false)}>ยกเลิก</Button>
            <Button onClick={confirmMove} disabled={isMoving}>
              {isMoving && <Loader2 className="size-4 mr-2 animate-spin" />}
              ยืนยันการย้าย
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Agent Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-accent" />
              เพิ่มเอเย่นต์ใหม่
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ชื่อเอเย่นต์ <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="เช่น เอเย่นต์ A"
                  value={newAgent.name}
                  onChange={e => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>เบอร์โทร <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="0812345678"
                  value={newAgent.phone}
                  onChange={e => setNewAgent(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>รหัสผ่าน <span className="text-red-500">*</span></Label>
                <Input
                  type="password"
                  placeholder="รหัสผ่าน"
                  value={newAgent.password}
                  onChange={e => setNewAgent(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>ส่วนแบ่ง % <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={newAgent.share_percent}
                  onChange={e => setNewAgent(prev => ({ ...prev, share_percent: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">
                  เอเย่นต์ได้ {newAgent.share_percent}% / เว็บแม่ได้ {100 - newAgent.share_percent}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ต้นสาย</Label>
                <Select value={newAgent.parent_id} onValueChange={v => setNewAgent(prev => ({ ...prev, parent_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกต้นสาย (ไม่บังคับ)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่มี (Level 1 - ลูกตรงแม่)</SelectItem>
                    {allAgents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.display_name || agent.name} (Lv.{agent.level || 1})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ประเภทระบบ</Label>
                <Select 
                  value={newAgent.system_type} 
                  onValueChange={(v: 'manual_key' | 'auto') => setNewAgent(prev => ({ ...prev, system_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual_key">
                      <div className="flex items-center gap-2">
                        <Keyboard className="size-4" />
                        คีย์หวย
                      </div>
                    </SelectItem>
                    <SelectItem value="auto">
                      <div className="flex items-center gap-2">
                        <Zap className="size-4" />
                        ออโต้
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
              <p className="text-sm font-medium text-accent">โครงสร้างสายงาน</p>
              <p className="text-xs text-muted-foreground mt-1">
                {newAgent.parent_id && newAgent.parent_id !== 'none'
                  ? `เอเย่นต์นี้จะอยู่ภายใต้ "${allAgents.find(a => a.id === newAgent.parent_id)?.display_name || allAgents.find(a => a.id === newAgent.parent_id)?.name || 'ต้นสายที่เลือก'}"`
                  : 'เอเย่นต์นี้จะเป็นลูกตรงของเว็บแม่ (Level 1)'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>ยกเลิก</Button>
            <Button onClick={createAgent} disabled={isCreating} className="bg-accent hover:bg-accent/90">
              {isCreating && <Loader2 className="size-4 mr-2 animate-spin" />}
              สร้างเอเย่นต์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
