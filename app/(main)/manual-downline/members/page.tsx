'use client';

import { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter,
  Edit,
  Trash2,
  Phone,
  CreditCard,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Check,
  X,
  AlertTriangle,
  Crown,
  Building2,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ManualMember {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  totalBets: number;
  totalWinLoss: number;
  outstanding: number;
  lastBetDate?: string;
  status: 'active' | 'inactive' | 'blocked';
  note?: string;
}

const mockMembers: ManualMember[] = [
  {
    id: 'MEM001',
    name: 'สมชาย ใจดี',
    nickname: 'ชาย',
    phone: '081-234-5678',
    agentId: 'A001',
    agentName: 'เอเย่นต์ 1',
    createdAt: '2024-01-10',
    totalBets: 125000,
    totalWinLoss: 15000,
    outstanding: 8500,
    lastBetDate: '2024-01-15',
    status: 'active',
  },
  {
    id: 'MEM002',
    name: 'สมหญิง รักดี',
    nickname: 'หญิง',
    phone: '089-876-5432',
    agentId: 'A001',
    agentName: 'เอเย่นต์ 1',
    createdAt: '2024-01-08',
    totalBets: 85000,
    totalWinLoss: -12000,
    outstanding: 12000,
    lastBetDate: '2024-01-14',
    status: 'active',
    note: 'ลูกค้า VIP',
  },
  {
    id: 'MEM003',
    name: 'ประยุทธ์ แทงหนัก',
    nickname: 'ยุทธ',
    agentId: 'S001',
    agentName: 'ซับเอเย่นต์ 1-1',
    createdAt: '2024-01-05',
    totalBets: 250000,
    totalWinLoss: -45000,
    outstanding: 45000,
    lastBetDate: '2024-01-15',
    status: 'active',
    note: 'ค้างชำระหลายงวด',
  },
  {
    id: 'MEM004',
    name: 'วิชัย มั่งมี',
    agentId: 'A002',
    agentName: 'เอเย่นต์ 2',
    createdAt: '2024-01-12',
    totalBets: 35000,
    totalWinLoss: 8000,
    outstanding: 0,
    lastBetDate: '2024-01-13',
    status: 'active',
  },
  {
    id: 'MEM005',
    name: 'สุดา รวยทรัพย์',
    nickname: 'ดา',
    phone: '062-111-2222',
    agentId: 'S002',
    agentName: 'ซับเอเย่นต์ 1-2',
    createdAt: '2024-01-01',
    totalBets: 180000,
    totalWinLoss: 25000,
    outstanding: 5000,
    lastBetDate: '2024-01-15',
    status: 'active',
  },
  {
    id: 'MEM006',
    name: 'อนันต์ หายไป',
    agentId: 'A001',
    agentName: 'เอเย่นต์ 1',
    createdAt: '2023-12-15',
    totalBets: 15000,
    totalWinLoss: -15000,
    outstanding: 15000,
    lastBetDate: '2023-12-20',
    status: 'blocked',
    note: 'หนีหนี้',
  },
];

const mockAgents = [
  { id: 'all', name: 'ทุกเอเย่นต์' },
  { id: 'A001', name: 'เอเย่นต์ 1' },
  { id: 'A002', name: 'เอเย่นต์ 2' },
  { id: 'S001', name: 'ซับเอเย่นต์ 1-1' },
  { id: 'S002', name: 'ซับเอเย่นต์ 1-2' },
];

export default function ManualMembersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<ManualMember | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    phone: '',
    agentId: '',
    note: '',
  });

  const filteredMembers = mockMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.phone?.includes(searchQuery);
    const matchesAgent = agentFilter === 'all' || member.agentId === agentFilter;
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    return matchesSearch && matchesAgent && matchesStatus;
  });

  // Stats
  const stats = {
    totalMembers: mockMembers.length,
    activeMembers: mockMembers.filter(m => m.status === 'active').length,
    totalOutstanding: mockMembers.reduce((sum, m) => sum + m.outstanding, 0),
    totalWinLoss: mockMembers.reduce((sum, m) => sum + m.totalWinLoss, 0),
  };

  const handleAddMember = () => {
    console.log('Adding member:', formData);
    setShowAddDialog(false);
    setFormData({ name: '', nickname: '', phone: '', agentId: '', note: '' });
  };

  const handleEditMember = () => {
    console.log('Editing member:', editingMember, formData);
    setEditingMember(null);
    setFormData({ name: '', nickname: '', phone: '', agentId: '', note: '' });
  };

  const openEditDialog = (member: ManualMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      nickname: member.nickname || '',
      phone: member.phone || '',
      agentId: member.agentId,
      note: member.note || '',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
        >
          รายชื่อลูกค้า (Manual Entry)
        </h1>
        <p className="text-slate-400 mt-2">จัดการรายชื่อคนแทงที่เอเย่นต์คีย์ให้เอง</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { label: 'โครงสร้างสายงาน', href: '/manual-downline' },
          { label: 'จัดการเครดิต', href: '/manual-downline/credit' },
          { label: 'ตั้งค่า PT/คอม', href: '/manual-downline/commission' },
          { label: 'รายชื่อลูกค้า', href: '/manual-downline/members', active: true },
          { label: 'รายงานแพ้ชนะ', href: '/manual-downline/report' },
        ].map((tab) => (
          <Link key={tab.href} href={tab.href}>
            <Button
              variant={tab.active ? 'default' : 'outline'}
              className={cn(
                "whitespace-nowrap",
                tab.active 
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold" 
                  : "border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
              )}
            >
              {tab.label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
          <div className="text-xs text-slate-400 mb-1">ลูกค้าทั้งหมด</div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalMembers}</div>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
          <div className="text-xs text-slate-400 mb-1">ลูกค้าใช้งาน</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{stats.activeMembers}</div>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
          <div className="text-xs text-slate-400 mb-1">ยอดค้างรวม</div>
          <div className="text-2xl font-bold text-orange-400 font-mono">{stats.totalOutstanding.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
          <div className="text-xs text-slate-400 mb-1">กำไร/ขาดทุนรวม</div>
          <div className={cn(
            "text-2xl font-bold font-mono",
            stats.totalWinLoss >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {stats.totalWinLoss >= 0 ? '+' : ''}{stats.totalWinLoss.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ, ชื่อเล่น, เบอร์โทร..."
            className="pl-10 bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
          />
        </div>
        
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-44 bg-black/40 border-amber-500/30 text-white">
            <SelectValue placeholder="เลือกเอเย่นต์" />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
            {mockAgents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-black/40 border-amber-500/30 text-white">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="active">ใช้งาน</SelectItem>
            <SelectItem value="inactive">ไม่ใช้งาน</SelectItem>
            <SelectItem value="blocked">บล็อค</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          onClick={() => setShowAddDialog(true)}
          className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold hover:from-amber-400 hover:to-amber-500"
        >
          <UserPlus className="size-4 mr-2" />
          เพิ่มลูกค้า
        </Button>
      </div>

      {/* Members Table */}
      <div className="rounded-xl overflow-hidden border border-amber-500/20">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-black/60 text-sm font-bold text-slate-400 border-b border-amber-500/20">
          <div className="col-span-3">ชื่อลูกค้า</div>
          <div className="col-span-2">เอเย่นต์</div>
          <div className="col-span-2 text-right">ยอดแทงรวม</div>
          <div className="col-span-2 text-right">กำไร/ขาดทุน</div>
          <div className="col-span-2 text-right">ยอดค้าง</div>
          <div className="col-span-1 text-center">จัดการ</div>
        </div>

        {/* Table Body */}
        {filteredMembers.map((member) => (
          <div 
            key={member.id}
            className={cn(
              "grid grid-cols-12 gap-4 p-4 items-center bg-black/40 hover:bg-black/50 transition-colors border-b border-white/5 last:border-b-0",
              member.status === 'blocked' && "opacity-60"
            )}
          >
            {/* Member Info */}
            <div className="col-span-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "size-10 rounded-full flex items-center justify-center text-lg font-bold",
                  member.status === 'blocked' 
                    ? "bg-red-500/20 text-red-400 border border-red-500/40"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                )}>
                  {member.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{member.name}</span>
                    {member.nickname && (
                      <span className="text-xs text-slate-500">({member.nickname})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {member.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" />
                        {member.phone}
                      </span>
                    )}
                  </div>
                  {member.note && (
                    <div className="text-xs text-amber-400 mt-0.5 italic">"{member.note}"</div>
                  )}
                </div>
              </div>
              {member.status === 'blocked' && (
                <Badge className="mt-2 bg-red-500/20 text-red-400 border-red-500/40 text-[10px]">
                  <AlertTriangle className="size-3 mr-1" />
                  BLOCKED
                </Badge>
              )}
            </div>

            {/* Agent */}
            <div className="col-span-2">
              <div className="text-sm text-white">{member.agentName}</div>
              <div className="text-xs text-slate-500">เพิ่มเมื่อ {member.createdAt}</div>
            </div>

            {/* Total Bets */}
            <div className="col-span-2 text-right">
              <div className="text-lg font-bold text-white font-mono">
                {member.totalBets.toLocaleString()}
              </div>
              {member.lastBetDate && (
                <div className="text-xs text-slate-500">แทงล่าสุด: {member.lastBetDate}</div>
              )}
            </div>

            {/* Win/Loss */}
            <div className="col-span-2 text-right">
              <div className={cn(
                "text-lg font-bold font-mono flex items-center justify-end gap-1",
                member.totalWinLoss >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {member.totalWinLoss >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                {member.totalWinLoss >= 0 ? '+' : ''}{member.totalWinLoss.toLocaleString()}
              </div>
            </div>

            {/* Outstanding */}
            <div className="col-span-2 text-right">
              <div className={cn(
                "text-lg font-bold font-mono",
                member.outstanding > 0 ? "text-orange-400" : "text-emerald-400"
              )}>
                {member.outstanding.toLocaleString()}
              </div>
              {member.outstanding > 0 && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/40 text-[10px]">
                  ค้างชำระ
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="col-span-1 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="size-8 text-slate-400 hover:text-white hover:bg-amber-500/20"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="bg-[#0a0f1a] border-amber-500/30"
                >
                  <DropdownMenuItem 
                    onClick={() => openEditDialog(member)}
                    className="text-amber-400 focus:bg-amber-500/20 focus:text-amber-300"
                  >
                    <Edit className="size-4 mr-2" />
                    แก้ไขข้อมูล
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-slate-300 focus:bg-amber-500/20 focus:text-white">
                    <CreditCard className="size-4 mr-2" />
                    ดูประวัติแทง
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-400 focus:bg-red-500/20 focus:text-red-300">
                    <Trash2 className="size-4 mr-2" />
                    ลบลูกค้า
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        {filteredMembers.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <Users className="size-12 mx-auto mb-4 opacity-50" />
            <p>ไม่พบลูกค้าที่ค้นหา</p>
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#0a0f1a] border-amber-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-amber-400" />
              เพิ่มลูกค้าใหม่
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">ชื่อ-นามสกุล *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ชื่อจริง นามสกุล"
                className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">ชื่อเล่น</label>
                <Input
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  placeholder="ชื่อเล่น"
                  className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">เบอร์โทร</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08x-xxx-xxxx"
                  className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">สังกัดเอเย่นต์ *</label>
              <Select value={formData.agentId} onValueChange={(val) => setFormData({ ...formData, agentId: val })}>
                <SelectTrigger className="bg-black/40 border-amber-500/30 text-white">
                  <SelectValue placeholder="เลือกเอเย่นต์" />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
                  {mockAgents.filter(a => a.id !== 'all').map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">หมายเหตุ</label>
              <Input
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="เช่น ลูกค้า VIP, ติดต่อทาง Line"
                className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="border-slate-500/30 text-slate-400"
            >
              <X className="size-4 mr-2" />
              ยกเลิก
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={!formData.name || !formData.agentId}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
            >
              <Check className="size-4 mr-2" />
              เพิ่มลูกค้า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editingMember !== null} onOpenChange={() => setEditingMember(null)}>
        <DialogContent className="bg-[#0a0f1a] border-amber-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-5 text-amber-400" />
              แก้ไขข้อมูลลูกค้า
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">ชื่อ-นามสกุล *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ชื่อจริง นามสกุล"
                className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">ชื่อเล่น</label>
                <Input
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  placeholder="ชื่อเล่น"
                  className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">เบอร์โทร</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08x-xxx-xxxx"
                  className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">หมายเหตุ</label>
              <Input
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="เช่น ลูกค้า VIP, ติดต่อทาง Line"
                className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingMember(null)}
              className="border-slate-500/30 text-slate-400"
            >
              <X className="size-4 mr-2" />
              ยกเลิก
            </Button>
            <Button
              onClick={handleEditMember}
              disabled={!formData.name}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
            >
              <Check className="size-4 mr-2" />
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
