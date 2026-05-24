'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Search, GitBranch, Users, ChevronRight, ChevronDown, 
  User, ArrowRight, GripVertical, Loader2, RefreshCw 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AgentNode {
  id: string;
  username: string;
  display_name: string;
  status: 'active' | 'suspended';
  commission_percent: number;
  member_count: number;
  total_sales: number;
  children: AgentNode[];
  level: number;
}

function TreeNode({ node, onMove, onSelect, selectedId }: { 
  node: AgentNode; 
  onMove: (id: string) => void;
  onSelect: (node: AgentNode) => void;
  selectedId: string | null;
}) {
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
        ) : (
          <div className="w-6" />
        )}
        
        <div className={`p-2 rounded-full ${node.status === 'active' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <User className={`size-4 ${node.status === 'active' ? 'text-green-500' : 'text-red-500'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{node.display_name}</span>
            <Badge variant="outline" className="text-xs shrink-0">Lv.{node.level}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            @{node.username} | สมาชิก: {node.member_count} | ยอด: {new Intl.NumberFormat('th-TH').format(node.total_sales)}
          </div>
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

export default function ManualKeyNetworkPage() {
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveAgentId, setMoveAgentId] = useState<string | null>(null);
  const [targetAgentId, setTargetAgentId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  const { data, mutate } = useSWR<{ tree: AgentNode[], agents: any[], stats: any }>(
    `/api/manual-key-agents/network?search=${search}`,
    fetcher
  );

  const tree = data?.tree || [];
  const allAgents = data?.agents || [];
  const stats = data?.stats || { totalAgents: 0, totalMembers: 0, totalLevels: 0 };

  const handleMove = (agentId: string) => {
    setMoveAgentId(agentId);
    setIsMoveOpen(true);
  };

  const confirmMove = async () => {
    if (!moveAgentId || !targetAgentId) {
      toast.error('กรุณาเลือกเอเย่นปลายทาง');
      return;
    }

    setIsMoving(true);
    try {
      const res = await fetch('/api/manual-key-agents/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', agentId: moveAgentId, targetAgentId }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('ย้ายเอเย่นสำเร็จ');
        setIsMoveOpen(false);
        setMoveAgentId(null);
        setTargetAgentId('');
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
    setIsMoving(false);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('th-TH').format(num);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent flex items-center gap-2">
            <GitBranch className="size-6" />
            โครงสร้างสายงาน (คีย์หวย)
          </h1>
          <p className="text-muted-foreground">แสดงโครงสร้างสายงานเอเย่นแบบ Tree</p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card/50 border-accent/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/20"><Users className="size-5 text-accent" /></div>
              <div>
                <p className="text-xs text-muted-foreground">เอเย่นทั้งหมด</p>
                <p className="text-xl font-bold">{stats.totalAgents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20"><User className="size-5 text-green-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">สมาชิกทั้งหมด</p>
                <p className="text-xl font-bold">{stats.totalMembers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20"><GitBranch className="size-5 text-purple-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">จำนวนชั้น</p>
                <p className="text-xl font-bold">{stats.totalLevels}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาเอเย่น..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      {/* Tree View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">โครงสร้างสายงาน</CardTitle>
          </CardHeader>
          <CardContent>
            {tree.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ไม่พบข้อมูลสายงาน
              </div>
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

        {/* Selected Agent Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">รายละเอียดเอเย่น</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${selectedNode.status === 'active' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <User className={`size-6 ${selectedNode.status === 'active' ? 'text-green-500' : 'text-red-500'}`} />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{selectedNode.display_name}</p>
                    <p className="text-sm text-muted-foreground">@{selectedNode.username}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-card border">
                    <p className="text-xs text-muted-foreground">ระดับ</p>
                    <p className="font-bold">{selectedNode.level}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border">
                    <p className="text-xs text-muted-foreground">คอมมิชชั่น</p>
                    <p className="font-bold">{selectedNode.commission_percent}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border">
                    <p className="text-xs text-muted-foreground">สมาชิก</p>
                    <p className="font-bold">{selectedNode.member_count}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-card border">
                    <p className="text-xs text-muted-foreground">ยอดขาย</p>
                    <p className="font-bold">{formatNumber(selectedNode.total_sales)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleMove(selectedNode.id)}>
                    <ArrowRight className="size-4 mr-2" />
                    ย้ายเอเย่น
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => window.location.href = `/manual-key-agents?agent=${selectedNode.id}`}>
                    <User className="size-4 mr-2" />
                    ดูรายละเอียด
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                คลิกเลือกเอเย่นจากโครงสร้างสายงาน
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Move Dialog */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ย้ายเอเย่นไปยังสายงานใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>เลือกเอเย่นปลายทาง</Label>
              <Select value={targetAgentId} onValueChange={setTargetAgentId}>
                <SelectTrigger><SelectValue placeholder="เลือกเอเย่น..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">ระดับบนสุด (ไม่มีต้นสาย)</SelectItem>
                  {allAgents.filter(a => a.id !== moveAgentId).map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.display_name} (@{agent.username})</SelectItem>
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
    </div>
  );
}
