'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Plus, Search, Settings, Users, DollarSign, TrendingUp, 
  RefreshCw, Loader2, Zap, Keyboard, GitBranch, Filter, 
  CheckCircle, XCircle, MoreHorizontal, UserX, Key,
  ChevronRight, ChevronDown, Eye, Network, Crown, Building2,
  ShieldCheck, Copy, QrCode, CreditCard, AlertTriangle
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useThreeStageConfirm } from '@/components/ui/premium-confirm-modal';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  
  // Log for debugging
  console.log('[v0] Agent fetch response:', { 
    status: res.status, 
    agentsCount: data?.agents?.length,
    error: data?.error,
    _debug: data?._debug
  });
  
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to fetch agents');
  }
  
  return data;
};

interface Agent {
  id: string;
  name: string;
  phone: string;
  username: string;
  agent_level: string;
  upline_id: string | null;
  commission_rate: number;
  is_partner: boolean;
  is_active: boolean;
  total_commission: number;
  pending_commission: number;
  credit_balance: number;
  enable_auto: boolean;
  enable_manual_key: boolean;
  created_at: string;
}

// 4-TIER AGENT HIERARCHY (Mother Web -> Master -> Agent -> Sub-Agent)
// ห้ามใช้ v1, v2 - ต้องใช้ชื่อเต็มเท่านั้น
const AGENT_LEVELS: Record<string, { label: string; color: string; tier: number }> = {
  mother_web: { label: 'Mother Web', color: 'bg-red-600', tier: 0 },
  master: { label: 'Master', color: 'bg-purple-500', tier: 1 },
  agent: { label: 'Agent', color: 'bg-blue-500', tier: 2 },
  sub_agent: { label: 'Sub-Agent', color: 'bg-green-500', tier: 3 },
  // Legacy mappings
  senior_agent: { label: 'Master', color: 'bg-purple-500', tier: 1 },
};

export default function AgentSystemPage() {
  const [search, setSearch] = useState('');
  const [systemFilter, setSystemFilter] = useState<string>('all'); // all, auto, manual_key, both
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentLevel, setNewAgentLevel] = useState('agent');
  const [newEnableAuto, setNewEnableAuto] = useState(false);
  const [newEnableManualKey, setNewEnableManualKey] = useState(true);
  const [newCommissionRate, setNewCommissionRate] = useState('5');
  const [editEnableAuto, setEditEnableAuto] = useState(false);
  const [editEnableManualKey, setEditEnableManualKey] = useState(true);
  
  // Password change states
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // 2FA states
  const [newRequire2FA, setNewRequire2FA] = useState(true); // Default: บังคับ 2FA
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [created2FAData, setCreated2FAData] = useState<{
    agentName: string;
    username: string;
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  
  // 3-Stage Confirmation Hook
  const { openConfirm, ConfirmModal } = useThreeStageConfirm();
  
  // Credit Adjustment Modal States
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAction, setCreditAction] = useState<'add' | 'deduct'>('add');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');

  const { data: agentsResponse, mutate, isLoading, error } = useSWR<{ agents: Agent[], summary: Record<string, number> }>(
    '/api/admin/agents',
    fetcher
  );
  
  const agents = agentsResponse?.agents || [];

  // Filter agents by system type and search
  const filteredAgents = agents.filter(agent => {
    // Search filter
    const matchesSearch = !search || 
      agent.name?.toLowerCase().includes(search.toLowerCase()) ||
      agent.phone?.includes(search) ||
      agent.username?.toLowerCase().includes(search.toLowerCase());
    
    // System filter
    let matchesSystem = true;
    if (systemFilter === 'auto') {
      matchesSystem = agent.enable_auto === true && agent.enable_manual_key !== true;
    } else if (systemFilter === 'manual_key') {
      matchesSystem = agent.enable_manual_key === true && agent.enable_auto !== true;
    } else if (systemFilter === 'both') {
      matchesSystem = agent.enable_auto === true && agent.enable_manual_key === true;
    }
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && agent.is_active !== false) ||
      (statusFilter === 'inactive' && agent.is_active === false);
    
    return matchesSearch && matchesSystem && matchesStatus;
  });

  // Stats
  const stats = {
    total: agents.length,
    autoOnly: agents.filter(a => a.enable_auto && !a.enable_manual_key).length,
    keyOnly: agents.filter(a => a.enable_manual_key && !a.enable_auto).length,
    both: agents.filter(a => a.enable_auto && a.enable_manual_key).length,
    active: agents.filter(a => a.is_active !== false).length,
  };

  // Build tree from flat agents list
  const buildTree = (agents: Agent[]): Agent[] => {
    const map = new Map<string, Agent & { children: Agent[] }>();
    const roots: (Agent & { children: Agent[] })[] = [];
    
    // Create map with children array
    agents.forEach(agent => {
      map.set(agent.id, { ...agent, children: [] });
    });
    
    // Build tree structure
    agents.forEach(agent => {
      const node = map.get(agent.id)!;
      if (agent.upline_id && map.has(agent.upline_id)) {
        map.get(agent.upline_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    
    return roots;
  };

  const agentTree = buildTree(filteredAgents);

  // Toggle tree node expansion
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Get system badges for agent
  const getSystemBadges = (agent: Agent) => (
    <div className="flex gap-1">
      {agent.enable_auto && (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
          <Zap className="size-3 mr-1" /> ออโต้
        </Badge>
      )}
      {agent.enable_manual_key && (
        <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs">
          <Keyboard className="size-3 mr-1" /> คีย์
        </Badge>
      )}
    </div>
  );

  // Render tree node
  const renderTreeNode = (node: Agent & { children?: Agent[] }, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const levelConfig = AGENT_LEVELS[node.agent_level] || AGENT_LEVELS.agent;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all border
            ${selectedAgent?.id === node.id 
              ? 'bg-primary/10 border-primary/30' 
              : 'hover:bg-muted/50 border-transparent'
            }`}
          style={{ marginLeft: `${depth * 24}px` }}
          onClick={() => setSelectedAgent(node)}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? <ChevronDown className="size-4 text-primary" /> : <ChevronRight className="size-4 text-primary" />}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {/* Icon */}
          <Building2 className="size-4 text-primary" />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{node.name || node.phone}</span>
              <Badge className={`${levelConfig.color} text-white text-xs`}>
                {levelConfig.label}
              </Badge>
              {getSystemBadges(node)}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{node.phone}</span>
              <span>|</span>
              <span>ส่วนแบ่ง: {node.commission_rate}%</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {hasChildren && (
              <Badge variant="secondary" className="text-xs">
                {node.children?.length} ใต้สาย
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setSelectedAgent(node); setShowEditDialog(true); }}>
                  <Settings className="size-4 mr-2" /> แก้ไข
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedAgent(node)}>
                  <Eye className="size-4 mr-2" /> ดูรายละเอียด
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-primary/20 ml-4">
            {node.children?.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Create new agent
  const handleCreateAgent = async () => {
    // Phone is required only for Auto system, optional for Key system
    if (newEnableAuto && !newAgentPhone) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์สำหรับระบบออโต้');
      return;
    }
    if (!newAgentUsername) {
      toast.error('กรุณากรอก username');
      return;
    }
    if (!newEnableAuto && !newEnableManualKey) {
      toast.error('ต้องเลือกอย่างน้อย 1 ระบบ');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName || newAgentUsername,
          phone: newAgentPhone || null, // Optional for Agent Key
          username: newAgentUsername,
          password: newAgentPassword || '123456',
          agent_level: newAgentLevel,
          commission_rate: parseFloat(newCommissionRate) || 5,
          enable_auto: newEnableAuto,
          enable_manual_key: newEnableManualKey,
          system_type: newEnableAuto && newEnableManualKey ? 'hybrid' : newEnableAuto ? 'auto' : 'manual_key',
          require_2fa: newRequire2FA, // ส่ง 2FA requirement
        }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success('สร้างเอเย่��ต์ใหม่สำเร็จ');
        setShowAddDialog(false);
        
        // ถ้ามี 2FA data ให้แสดง QR Modal
        if (data.twoFactor && data.twoFactor.secret) {
          setCreated2FAData({
            agentName: data.agent.name,
            username: data.agent.username,
            secret: data.twoFactor.secret,
            otpauthUrl: data.twoFactor.otpauthUrl,
          });
          
          // Generate QR Code
          setIsGeneratingQR(true);
          try {
            const QRCode = (await import('qrcode')).default;
            const qrUrl = await QRCode.toDataURL(data.twoFactor.otpauthUrl);
            setQrCodeDataUrl(qrUrl);
          } catch {
            console.error('[v0] Failed to generate QR code');
          }
          setIsGeneratingQR(false);
          setShow2FAModal(true);
        }
        
        // Reset form
        setNewAgentName('');
        setNewAgentPhone('');
        setNewAgentUsername('');
        setNewAgentPassword('');
        setNewAgentLevel('agent');
        setNewEnableAuto(false);
        setNewEnableManualKey(true);
        setNewCommissionRate('5');
        setNewRequire2FA(true);
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

  // Update agent settings
  const handleUpdateAgent = async () => {
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
          commission_rate: parseFloat(newCommissionRate) || 0,
          enable_auto: editEnableAuto,
          enable_manual_key: editEnableManualKey,
        }),
      });
      
      if (res.ok) {
        toast.success('อัปเดตเอเย่นต์สำเร็จ');
        setShowEditDialog(false);
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

  // Toggle active status with 3-stage confirmation
  const handleToggleStatus = async (agent: Agent) => {
    const isActivating = agent.is_active === false;
    
    openConfirm({
      title: isActivating ? 'เปิดใช้งานเอเย่นต์' : 'ระงับเอเย่นต์',
      description: `ต้องการ${isActivating ? 'เปิดใช้งาน' : 'ระงับ'}เอเย่นต์นี้หรือไม่?`,
      items: [
        { label: 'ชื่อเอเย่นต์', value: agent.name || agent.username },
        { label: 'ระดับ', value: AGENT_LEVELS[agent.agent_level]?.label || agent.agent_level },
        { label: 'เครดิตคงเหลือ', value: `฿${(agent.credit_balance || 0).toLocaleString()}` },
        { label: 'การดำเนินการ', value: isActivating ? 'เปิดใช้งาน' : 'ระงับ', highlight: true, type: isActivating ? 'add' : 'deduct' },
      ],
      warningMessage: !isActivating ? 'เอเย่นต์ที่ถูกระงับจะไม่สามารถรับยอดใหม่ได้' : undefined,
      confirmText: isActivating ? 'ยืนยันเปิดใช้งาน' : 'ยืนยันระงับ',
      successMessage: isActivating ? 'เปิดใช้งานเอเย่นต์สำเร็จ' : 'ระงับเอเย่นต์สำเร็จ',
      onConfirm: async () => {
        const res = await fetch('/api/admin/agents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: agent.id,
            action: isActivating ? 'activate' : 'suspend',
          }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'เกิดข้อผิดพลาด');
        }
        
        mutate();
      },
    });
  };
  
  // Credit adjustment with 3-stage confirmation
  const handleCreditAdjustment = (agent: Agent, action: 'add' | 'deduct') => {
    setSelectedAgent(agent);
    setCreditAction(action);
    setCreditAmount('');
    setCreditNote('');
    setShowCreditModal(true);
  };
  
  const confirmCreditAdjustment = () => {
    if (!selectedAgent || !creditAmount) return;
    
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }
    
    setShowCreditModal(false);
    
    openConfirm({
      title: creditAction === 'add' ? 'เติมเครดิต' : 'ตัดเครดิต',
      description: 'กรุณาตรวจสอบข้อมูลก่อนยืนยัน',
      items: [
        { label: 'เอเย่นต์', value: selectedAgent.name || selectedAgent.username },
        { label: 'เครดิตปัจจุบัน', value: `฿${(selectedAgent.credit_balance || 0).toLocaleString()}` },
        { label: creditAction === 'add' ? 'เติมเครดิต' : 'ตัดเครดิต', value: `฿${amount.toLocaleString()}`, highlight: true, type: creditAction },
        { label: 'เครดิตหลังทำรายการ', value: `฿${((selectedAgent.credit_balance || 0) + (creditAction === 'add' ? amount : -amount)).toLocaleString()}`, highlight: true },
        ...(creditNote ? [{ label: 'หมายเหตุ', value: creditNote }] : []),
      ],
      warningMessage: creditAction === 'deduct' ? 'การตัดเครดิตไม่สามารถย้อนกลับได้ กรุณาตรวจสอบให้แน่ใจ' : undefined,
      confirmText: creditAction === 'add' ? 'ยืนยันเติมเครดิต' : 'ยืนยันตัดเครดิต',
      successMessage: creditAction === 'add' ? 'เติมเครดิตสำเร็จ' : 'ตัดเครดิตสำเร็จ',
      onConfirm: async () => {
        const res = await fetch('/api/admin/agents/credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: selectedAgent.id,
            action: creditAction,
            amount: amount,
            note: creditNote,
          }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'เกิดข้อผิดพลาด');
        }
        
        mutate();
      },
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="size-6 text-[#D4AF37]" />
            สายงาน��อเย่นต์
          </h1>
          <p className="text-muted-foreground">จัดการเอเย่นต์ทั้งระบบออโต้และคีย์หวย</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddDialog(true)} className="bg-[#D4AF37] hover:bg-[#B8960C] text-black">
            <Plus className="size-4 mr-2" />
            เพิ่มเอเย่นต์ใหม่
          </Button>
          <Button onClick={() => mutate()} variant="outline" size="sm">
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card-gold">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">เอเย่นต์ทั้งหมด</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="size-8 text-[#D4AF37] opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card-gold cursor-pointer hover:border-green-500/50" onClick={() => setSystemFilter('auto')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">เฉพาะออโต้</p>
                <p className="text-2xl font-bold text-green-500">{stats.autoOnly}</p>
              </div>
              <Zap className="size-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card-gold cursor-pointer hover:border-blue-500/50" onClick={() => setSystemFilter('manual_key')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">เฉพาะคีย์</p>
                <p className="text-2xl font-bold text-blue-500">{stats.keyOnly}</p>
              </div>
              <Keyboard className="size-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card-gold cursor-pointer hover:border-purple-500/50" onClick={() => setSystemFilter('both')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ทั้งสองระบบ</p>
                <p className="text-2xl font-bold text-purple-500">{stats.both}</p>
              </div>
              <div className="flex -space-x-2">
                <Zap className="size-6 text-green-500" />
                <Keyboard className="size-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card-gold">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ใช้งานอยู่</p>
                <p className="text-2xl font-bold text-emerald-500">{stats.active}</p>
              </div>
              <CheckCircle className="size-8 text-emerald-500 opacity-50" />
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
              <Input
                placeholder="ค้นหาชื่อ, เบอร์โทร, username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={systemFilter} onValueChange={setSystemFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="ระบบ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระบบ</SelectItem>
                <SelectItem value="auto">
                  <span className="flex items-center gap-2">
                    <Zap className="size-4 text-green-500" /> เฉพาะออโต้
                  </span>
                </SelectItem>
                <SelectItem value="manual_key">
                  <span className="flex items-center gap-2">
                    <Keyboard className="size-4 text-blue-500" /> เฉพาะคีย์
                  </span>
                </SelectItem>
                <SelectItem value="both">
                  <span className="flex items-center gap-2">
                    <GitBranch className="size-4 text-purple-500" /> ทั้งสองระบบ
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="active">ใช้งาน</SelectItem>
                <SelectItem value="inactive">ระงับ</SelectItem>
              </SelectContent>
            </Select>
            
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={`rounded-none ${viewMode === 'table' ? 'bg-[#D4AF37] text-black' : ''}`}
              >
                <Users className="size-4 mr-1" /> ตาราง
              </Button>
              <Button
                variant={viewMode === 'tree' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('tree')}
                className={`rounded-none ${viewMode === 'tree' ? 'bg-[#D4AF37] text-black' : ''}`}
              >
                <Network className="size-4 mr-1" /> สายงาน
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agents View - Table or Tree */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {viewMode === 'tree' ? (
                  <>
                    <Network className="size-5 text-[#D4AF37]" />
                    โครงสร้างสายงาน
                  </>
                ) : (
                  <>
                    <Users className="size-5 text-[#D4AF37]" />
                    รายชื่อเอเย่นต์ ({filteredAgents.length})
                  </>
                )}
              </CardTitle>
              {systemFilter !== 'all' && (
                <CardDescription>
                  กำลังแสดง: {systemFilter === 'auto' ? 'เฉพาะออโต้' : systemFilter === 'manual_key' ? 'เฉพาะคีย์' : 'ทั้งสองระบบ'}
                  <Button variant="link" size="sm" onClick={() => setSystemFilter('all')} className="ml-2 h-auto p-0">
                    ล้างตัวกรอง
                  </Button>
                </CardDescription>
              )}
            </div>
            {viewMode === 'tree' && agentTree.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setExpandedNodes(new Set(filteredAgents.map(a => a.id)))}
              >
                ขยาย��ั้งหมด
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'tree' ? (
            /* Tree View */
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-8 animate-spin text-[#D4AF37]" />
                </div>
              ) : agentTree.length > 0 ? (
                agentTree.map(node => renderTreeNode(node))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Network className="size-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มีเอเย่นต์</p>
                </div>
              )}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>ระบบ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">ส่วนแบ่ง %</TableHead>
                    <TableHead className="text-right">เครดิต</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="size-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredAgents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        ไม่พบเอเย่นต์
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAgents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{agent.name || '-'}</p>
                            <p className="text-xs text-muted-foreground">{agent.phone || agent.username}</p>
                          </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={AGENT_LEVELS[agent.agent_level]?.color || 'bg-gray-500'}>
                          {AGENT_LEVELS[agent.agent_level]?.label || agent.agent_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getSystemBadges(agent)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={agent.is_active !== false ? 'default' : 'destructive'}>
                          {agent.is_active !== false ? 'ใช้งาน' : 'ระงับ'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {agent.commission_rate}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(agent.credit_balance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => {
                              setSelectedAgent(agent);
                              setNewCommissionRate(String(agent.commission_rate || 0));
                              setEditEnableAuto(agent.enable_auto ?? false);
                              setEditEnableManualKey(agent.enable_manual_key ?? true);
                              setShowEditDialog(true);
                            }}>
                              <Settings className="size-4 mr-2" />
                              ตั้งค่า
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {/* Credit Actions - Premium Gold Buttons */}
                            <DropdownMenuItem 
                              onClick={() => handleCreditAdjustment(agent, 'add')}
                              className="text-emerald-500 focus:text-emerald-500 focus:bg-emerald-500/10"
                            >
                              <Plus className="size-4 mr-2" />
                              เติมเครดิต
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleCreditAdjustment(agent, 'deduct')}
                              className="text-amber-500 focus:text-amber-500 focus:bg-amber-500/10"
                            >
                              <DollarSign className="size-4 mr-2" />
                              ตัดเครดิต
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleToggleStatus(agent)}
                              className={agent.is_active !== false ? 'text-red-600 focus:text-red-600 focus:bg-red-500/10' : 'text-green-600 focus:text-green-600 focus:bg-green-500/10'}
                            >
                              {agent.is_active !== false ? (
                                <>
                                  <UserX className="size-4 mr-2" />
                                  ระงับเอเย่นต์
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="size-4 mr-2" />
                                  เปิดใช้งาน
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ตั้งค่าเอเย่นต์ - {selectedAgent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ส่วนแบ่ง (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newCommissionRate}
                onChange={(e) => setNewCommissionRate(e.target.value)}
              />
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
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-green-500" />
                    <div>
                      <span className="font-medium">ระบบออโต้</span>
                      <p className="text-xs text-muted-foreground">ฝาก-ถอนอัตโนมัติ</p>
                    </div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEnableManualKey}
                    onChange={(e) => setEditEnableManualKey(e.target.checked)}
                    className="w-5 h-5 rounded border-2 accent-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <Keyboard className="size-4 text-blue-500" />
                    <div>
                      <span className="font-medium">ระบบคีย์ (Manual)</span>
                      <p className="text-xs text-muted-foreground">กรอกยอดเติมเงินด้วยตัวเอง</p>
                    </div>
                  </div>
                </label>
              </div>
              {!editEnableAuto && !editEnableManualKey && (
                <p className="text-xs text-red-500">* ต้องเลือกอย่างน้อย 1 ระบบ</p>
              )}
            </div>
            
            {/* เปลี่ยนรหัสผ่าน */}
            <div className="pt-4 border-t">
              {!showPasswordFields ? (
                <Button 
                  variant="outline" 
                  className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => {
                    setShowPasswordFields(true);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                  }}
                >
                  <Key className="size-4 mr-2" />
                  เปลี่ยนรหัสผ่าน
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>รหัสผ่านใหม่</Label>
                    <Input
                      type="password"
                      placeholder="พิมพ์รหัสผ่านใหม่..."
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordError('');
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ยืนยันรหัสผ่าน</Label>
                    <Input
                      type="password"
                      placeholder="พิมพ์รหัสผ่านอีกครั้ง..."
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError('');
                      }}
                    />
                  </div>
                  {passwordError && (
                    <p className="text-sm text-red-500">{passwordError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowPasswordFields(false);
                        setNewPassword('');
                        setConfirmPassword('');
                        setPasswordError('');
                      }}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                      disabled={isChangingPassword}
                      onClick={async () => {
                        // Validation
                        if (!newPassword) {
                          setPasswordError('กรุณากรอกรหัสผ่านใหม่');
                          return;
                        }
                        if (newPassword.length < 4) {
                          setPasswordError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
                          return;
                        }
                        if (newPassword !== confirmPassword) {
                          setPasswordError('รหัสผ่านไม่ตรงกัน');
                          return;
                        }
                        
                        if (!selectedAgent) return;
                        
                        setIsChangingPassword(true);
                        try {
                          const res = await fetch(`/api/agents/${selectedAgent.id}/reset-password`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newPassword }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
                            setShowPasswordFields(false);
                            setNewPassword('');
                            setConfirmPassword('');
                            setPasswordError('');
                          } else {
                            toast.error(data.error || 'เกิดข้อผิดพลาด');
                          }
                        } catch {
                          toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
                        } finally {
                          setIsChangingPassword(false);
                        }
                      }}
                    >
                      {isChangingPassword ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Key className="size-4 mr-2" />}
                      บันทึกรหัสผ่านใหม่
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleUpdateAgent} disabled={isSubmitting || (!editEnableAuto && !editEnableManualKey)}>
              {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Agent Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-[#D4AF37]" />
              เพิ่มเอเย่นต์ใหม่
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ชื่อเอเย่นต์</Label>
              <Input
                placeholder="ชื่อ-นามสกุล"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>เบอร์โทรศัพท์ <span className="text-red-500">*</span></Label>
              <Input
                placeholder="0812345678"
                value={newAgentPhone}
                onChange={(e) => setNewAgentPhone(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="username (ถ้าไม่ใส่จะใช้เบอร์โทร)"
                  value={newAgentUsername}
                  onChange={(e) => setNewAgentUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="รหัสผ่าน (default: 123456)"
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ระดับเอเย่นต์</Label>
                <Select value={newAgentLevel} onValueChange={setNewAgentLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="senior_agent">Senior Agent</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="sub_agent">Sub Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ส่วนแบ่ง (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newCommissionRate}
                  onChange={(e) => setNewCommissionRate(e.target.value)}
                />
              </div>
            </div>
            
            {/* ระบบที่เปิดใช้งาน */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
              <Label className="text-base font-semibold">ระบบที่เปิดใช้งาน <span className="text-red-500">*</span></Label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnableAuto}
                    onChange={(e) => setNewEnableAuto(e.target.checked)}
                    className="w-5 h-5 rounded border-2 accent-green-500"
                  />
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-green-500" />
                    <div>
                      <span className="font-medium">ระบบออโต้</span>
                      <p className="text-xs text-muted-foreground">ฝาก-ถอนอัตโนมัติ</p>
                    </div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEnableManualKey}
                    onChange={(e) => setNewEnableManualKey(e.target.checked)}
                    className="w-5 h-5 rounded border-2 accent-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <Keyboard className="size-4 text-blue-500" />
                    <div>
                      <span className="font-medium">ระบบคีย์ (Manual)</span>
                      <p className="text-xs text-muted-foreground">กรอกยอดเติมเงินด้วยตัวเอง</p>
                    </div>
                  </div>
                </label>
              </div>
              {!newEnableAuto && !newEnableManualKey && (
                <p className="text-xs text-red-500">* ต้องเลือกอย่างน้อย 1 ระบบ</p>
              )}
            </div>
            
            {/* บังคับ 2FA */}
            <div className="space-y-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRequire2FA}
                  onChange={(e) => setNewRequire2FA(e.target.checked)}
                  className="w-5 h-5 rounded border-2 accent-purple-500"
                />
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-purple-500" />
                  <div>
                    <span className="font-medium">บังคับเปิดใช้งาน 2FA</span>
                    <p className="text-xs text-muted-foreground">ผู้ใช้ต้องสแกน QR Code ก่อนใช้งานระบบ</p>
                  </div>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleCreateAgent} 
              disabled={isSubmitting || !newAgentPhone || (!newEnableAuto && !newEnableManualKey)}
              className="bg-[#D4AF37] hover:bg-[#B8960C] text-black"
            >
              {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Plus className="size-4 mr-2" />}
              สร้างเอเย่นต์
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 2FA QR Code Modal - แสดงหลังสร้าง agent สำเร็จ */}
      <Dialog open={show2FAModal} onOpenChange={setShow2FAModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-purple-500" />
              ตั้งค่า 2FA สำหรับบัญชีนี้
            </DialogTitle>
          </DialogHeader>
          
          {created2FAData && (
            <div className="space-y-4 py-4">
              {/* Info */}
              <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">ชื่อบัญชี:</span>
                  <span className="font-medium">{created2FAData.agentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Username:</span>
                  <span className="font-mono">{created2FAData.username}</span>
                </div>
              </div>
              
              {/* QR Code */}
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">สแกน QR Code ด้วย Google Authenticator หรือแอปยืนยันตัวตนอื่นๆ</p>
                <div className="flex justify-center">
                  {isGeneratingQR ? (
                    <div className="w-48 h-48 flex items-center justify-center border rounded-lg bg-white">
                      <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48 border rounded-lg" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center border rounded-lg bg-muted">
                      <QrCode className="size-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Secret Key */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Secret Key (ใช้กรอกด้วยตนเอง)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={created2FAData.secret} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(created2FAData.secret);
                      toast.success('คัดลอก Secret Key แล้ว');
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              
              {/* Warning */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-amber-600">
                  <strong>สำคัญ:</strong> ผู้ใช้บัญชีนี้ต้องสแกน QR Code และกรอกรหัส OTP ก่อนจึงจะใช้งานระบบได้
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={() => {
                setShow2FAModal(false);
                setCreated2FAData(null);
                setQrCodeDataUrl(null);
              }}
              className="w-full bg-[#D4AF37] hover:bg-[#B8960C] text-black"
            >
              <CheckCircle className="size-4 mr-2" />
              เสร็จสิ้น
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Credit Adjustment Modal - Stage 1 */}
      <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
        <DialogContent className="sm:max-w-md bg-gradient-to-b from-[#0a0a0a] to-[#141414] border-2 border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <CreditCard className="size-5" />
              {creditAction === 'add' ? 'เติมเครดิต' : 'ตัดเครดิต'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-black/40 border border-amber-500/20">
              <p className="text-sm text-neutral-400">เอเย่นต์</p>
              <p className="font-semibold text-white">{selectedAgent?.name || selectedAgent?.username}</p>
              <p className="text-xs text-amber-400 mt-1">
                เครดิตปัจจุบัน: ฿{(selectedAgent?.credit_balance || 0).toLocaleString()}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-amber-200">จำนวนเงิน (บาท)</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="0.00"
                className="text-xl font-bold bg-black/40 border-amber-500/30 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-amber-200">หมายเหตุ (ไม่บังคับ)</Label>
              <Input
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                placeholder="ระบุเหตุผล..."
                className="bg-black/40 border-amber-500/30 text-white"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreditModal(false)} className="border-neutral-700">
              ยกเลิก
            </Button>
            <Button 
              onClick={confirmCreditAdjustment}
              disabled={!creditAmount || parseFloat(creditAmount) <= 0}
              className={`${
                creditAction === 'add' 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
                  : 'bg-gradient-to-r from-red-500 to-red-600'
              } text-white font-bold`}
            >
              {creditAction === 'add' ? 'เติมเครดิต' : 'ตัดเครดิต'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 3-Stage Confirmation Modal */}
      <ConfirmModal />
    </div>
  );
}
