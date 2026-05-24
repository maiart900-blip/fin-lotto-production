'use client';

import { useState } from 'react';
import { 
  CreditCard, 
  Plus, 
  Minus, 
  Lock, 
  Unlock,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  History,
  RefreshCw,
  Crown,
  Building2,
  User,
  ChevronDown,
  Check
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AgentCredit {
  id: string;
  username: string;
  name: string;
  level: 'master' | 'agent' | 'sub-agent';
  parentName: string | null;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  isLocked: boolean;
  lockReason?: string;
  lastTransaction?: {
    type: 'add' | 'deduct';
    amount: number;
    date: string;
    by: string;
  };
}

const mockAgents: AgentCredit[] = [
  {
    id: 'M001',
    username: 'master_a',
    name: 'มาสเตอร์ A',
    level: 'master',
    parentName: null,
    creditLimit: 1000000,
    creditUsed: 750000,
    creditAvailable: 250000,
    isLocked: false,
    lastTransaction: { type: 'add', amount: 200000, date: '2024-01-15 14:30', by: 'Admin' },
  },
  {
    id: 'A001',
    username: 'agent_1',
    name: 'เอเย่นต์ 1',
    level: 'agent',
    parentName: 'มาสเตอร์ A',
    creditLimit: 300000,
    creditUsed: 220000,
    creditAvailable: 80000,
    isLocked: false,
    lastTransaction: { type: 'add', amount: 50000, date: '2024-01-15 10:00', by: 'มาสเตอร์ A' },
  },
  {
    id: 'S001',
    username: 'sub_agent_1',
    name: 'ซับเอเย่นต์ 1-1',
    level: 'sub-agent',
    parentName: 'เอเย่นต์ 1',
    creditLimit: 50000,
    creditUsed: 48000,
    creditAvailable: 2000,
    isLocked: true,
    lockReason: 'เครดิตใกล้หมด (96%)',
    lastTransaction: { type: 'deduct', amount: 10000, date: '2024-01-14 18:00', by: 'เอเย่นต์ 1' },
  },
  {
    id: 'S002',
    username: 'sub_agent_2',
    name: 'ซับเอเย่นต์ 1-2',
    level: 'sub-agent',
    parentName: 'เอเย่นต์ 1',
    creditLimit: 80000,
    creditUsed: 45000,
    creditAvailable: 35000,
    isLocked: false,
  },
  {
    id: 'A002',
    username: 'agent_2',
    name: 'เอเย่นต์ 2',
    level: 'agent',
    parentName: 'มาสเตอร์ A',
    creditLimit: 200000,
    creditUsed: 180000,
    creditAvailable: 20000,
    isLocked: false,
  },
  {
    id: 'M002',
    username: 'master_b',
    name: 'มาสเตอร์ B',
    level: 'master',
    parentName: null,
    creditLimit: 500000,
    creditUsed: 320000,
    creditAvailable: 180000,
    isLocked: false,
  },
];

interface CreditTransaction {
  id: string;
  agentName: string;
  type: 'add' | 'deduct' | 'lock' | 'unlock';
  amount?: number;
  balanceBefore: number;
  balanceAfter: number;
  by: string;
  note?: string;
  date: string;
}

const mockTransactions: CreditTransaction[] = [
  { id: 'T001', agentName: 'มาสเตอร์ A', type: 'add', amount: 200000, balanceBefore: 800000, balanceAfter: 1000000, by: 'Admin', note: 'เติมเครดิตประจำสัปดาห์', date: '2024-01-15 14:30' },
  { id: 'T002', agentName: 'เอเย่นต์ 1', type: 'add', amount: 50000, balanceBefore: 250000, balanceAfter: 300000, by: 'มาสเตอร์ A', date: '2024-01-15 10:00' },
  { id: 'T003', agentName: 'ซับเอเย่นต์ 1-1', type: 'lock', balanceBefore: 50000, balanceAfter: 50000, by: 'ระบบอัตโนมัติ', note: 'เครดิตใช้เกิน 90%', date: '2024-01-15 08:00' },
  { id: 'T004', agentName: 'ซับเอเย่นต์ 1-1', type: 'deduct', amount: 10000, balanceBefore: 60000, balanceAfter: 50000, by: 'เอเย่นต์ 1', note: 'หักยอดค้างชำระ', date: '2024-01-14 18:00' },
  { id: 'T005', agentName: 'เอเย่นต์ 2', type: 'add', amount: 100000, balanceBefore: 100000, balanceAfter: 200000, by: 'มาสเตอร์ A', date: '2024-01-14 12:00' },
];

export default function CreditAllocationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<AgentCredit | null>(null);
  const [creditAction, setCreditAction] = useState<'add' | 'deduct' | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');

  const filteredAgents = mockAgents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || agent.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const getLevelConfig = (level: string) => {
    switch (level) {
      case 'master':
        return { icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40', label: 'Master' };
      case 'agent':
        return { icon: Building2, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/40', label: 'Agent' };
      default:
        return { icon: User, color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/40', label: 'Sub-Agent' };
    }
  };

  const handleCreditAction = () => {
    if (!selectedAgent || !creditAction || !creditAmount) return;
    
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) return;

    console.log(`${creditAction} ${amount} to ${selectedAgent.username}`);
    
    // Reset and close
    setCreditAction(null);
    setCreditAmount('');
    setCreditNote('');
    setSelectedAgent(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
        >
          จัดการวงเงินเครดิต
        </h1>
        <p className="text-slate-400 mt-2">เติม/ตัดวงเงิน และล็อค/ปลดล็อคเครดิตเอเย่นต์</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { label: 'โครงสร้างสายงาน', href: '/manual-downline' },
          { label: 'จัดการเครดิต', href: '/manual-downline/credit', active: true },
          { label: 'ตั้งค่า PT/คอม', href: '/manual-downline/commission' },
          { label: 'รายชื่อลูกค้า', href: '/manual-downline/members' },
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

      {/* Auto-Lock Warning */}
      <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-start gap-3">
        <AlertTriangle className="size-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-orange-400">ระบบ Credit Lock อัตโนมัติ</h3>
          <p className="text-sm text-slate-400 mt-1">
            เมื่อเอเย่นต์ใช้เครดิตเกิน 90% ของวงเงิน ระบบจะล็อคอัตโนมัติทันที 
            ต้องเติมเครดิตหรือปลดล็อคด้วยตนเองจึงจะคีย์ได้ต่อ
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาเอเย่นต์..."
            className="pl-10 bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
          />
        </div>
        
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-40 bg-black/40 border-amber-500/30 text-white">
            <SelectValue placeholder="ทุกระดับ" />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
            <SelectItem value="all">ทุกระดับ</SelectItem>
            <SelectItem value="master">Master</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="sub-agent">Sub-Agent</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20">
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Agent List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredAgents.map((agent) => {
            const levelConfig = getLevelConfig(agent.level);
            const LevelIcon = levelConfig.icon;
            const creditPercent = (agent.creditUsed / agent.creditLimit) * 100;
            const isNearLimit = creditPercent >= 90;

            return (
              <div 
                key={agent.id}
                className={cn(
                  "p-4 rounded-xl backdrop-blur-sm border transition-all duration-300",
                  "bg-black/40 hover:bg-black/50",
                  agent.isLocked 
                    ? "border-red-500/40" 
                    : isNearLimit 
                    ? "border-orange-500/40" 
                    : "border-amber-500/20 hover:border-amber-500/40"
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Level Icon */}
                  <div className={cn(
                    "size-12 rounded-full flex items-center justify-center border",
                    levelConfig.bg,
                    levelConfig.border
                  )}>
                    <LevelIcon className={cn("size-6", levelConfig.color)} />
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{agent.name}</span>
                      <Badge className={cn("text-[10px]", levelConfig.bg, levelConfig.color, levelConfig.border)}>
                        {levelConfig.label}
                      </Badge>
                      {agent.isLocked && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px]">
                          <Lock className="size-3 mr-1" />
                          LOCKED
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      @{agent.username}
                      {agent.parentName && <span className="ml-2">ภายใต้: {agent.parentName}</span>}
                    </div>
                    {agent.lockReason && (
                      <div className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        {agent.lockReason}
                      </div>
                    )}
                  </div>

                  {/* Credit Info */}
                  <div className="w-48">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">วงเงิน</span>
                      <span className={cn(
                        "font-mono font-bold",
                        isNearLimit ? "text-red-400" : "text-amber-400"
                      )}>
                        {creditPercent.toFixed(0)}% ใช้ไป
                      </span>
                    </div>
                    <div className="h-2 bg-black/60 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          isNearLimit 
                            ? "bg-gradient-to-r from-red-500 to-red-600" 
                            : "bg-gradient-to-r from-amber-500 to-amber-600"
                        )}
                        style={{ width: `${Math.min(creditPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1 font-mono">
                      <span className="text-emerald-400">เหลือ: {agent.creditAvailable.toLocaleString()}</span>
                      <span className="text-slate-500">/ {agent.creditLimit.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedAgent(agent);
                        setCreditAction('add');
                      }}
                      className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40"
                    >
                      <Plus className="size-4 mr-1" />
                      เติม
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedAgent(agent);
                        setCreditAction('deduct');
                      }}
                      className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40"
                    >
                      <Minus className="size-4 mr-1" />
                      ตัด
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => console.log('Toggle lock:', agent.id)}
                      className={cn(
                        "border",
                        agent.isLocked 
                          ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20" 
                          : "border-orange-500/40 text-orange-400 hover:bg-orange-500/20"
                      )}
                    >
                      {agent.isLocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                    </Button>
                  </div>
                </div>

                {/* Last Transaction */}
                {agent.lastTransaction && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                    <span>รายการล่าสุด:</span>
                    <span className="flex items-center gap-2">
                      {agent.lastTransaction.type === 'add' ? (
                        <ArrowUpRight className="size-3 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="size-3 text-red-400" />
                      )}
                      <span className={agent.lastTransaction.type === 'add' ? 'text-emerald-400' : 'text-red-400'}>
                        {agent.lastTransaction.type === 'add' ? '+' : '-'}{agent.lastTransaction.amount?.toLocaleString()}
                      </span>
                      <span>โดย {agent.lastTransaction.by}</span>
                      <span>{agent.lastTransaction.date}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 p-4 rounded-xl bg-black/40 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-4">
              <History className="size-5 text-amber-400" />
              <h3 className="font-bold text-white">ประวัติล่าสุด</h3>
            </div>
            
            <div className="space-y-3">
              {mockTransactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="p-3 rounded-lg bg-black/40 border border-white/5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white text-sm">{tx.agentName}</span>
                    {tx.type === 'add' && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                        +{tx.amount?.toLocaleString()}
                      </Badge>
                    )}
                    {tx.type === 'deduct' && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px]">
                        -{tx.amount?.toLocaleString()}
                      </Badge>
                    )}
                    {tx.type === 'lock' && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/40 text-[10px]">
                        <Lock className="size-3 mr-1" />
                        LOCKED
                      </Badge>
                    )}
                    {tx.type === 'unlock' && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                        <Unlock className="size-3 mr-1" />
                        UNLOCKED
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span>โดย {tx.by}</span>
                    <span>{tx.date}</span>
                  </div>
                  {tx.note && (
                    <div className="text-[10px] text-slate-400 mt-1 italic">"{tx.note}"</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Credit Action Dialog */}
      <Dialog open={creditAction !== null} onOpenChange={() => { setCreditAction(null); setSelectedAgent(null); }}>
        <DialogContent className="bg-[#0a0f1a] border-amber-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {creditAction === 'add' ? (
                <>
                  <Plus className="size-5 text-emerald-400" />
                  <span>เติมเครดิต</span>
                </>
              ) : (
                <>
                  <Minus className="size-5 text-red-400" />
                  <span>ตัดเครดิต</span>
                </>
              )}
              {selectedAgent && <span className="text-amber-400">- {selectedAgent.name}</span>}
            </DialogTitle>
          </DialogHeader>

          {selectedAgent && (
            <div className="space-y-4 py-4">
              {/* Current Credit */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">วงเงินปัจจุบัน</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {selectedAgent.creditLimit.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">คงเหลือ</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {selectedAgent.creditAvailable.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">จำนวนเงิน</label>
                <Input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="0"
                  className="bg-black/40 border-amber-500/30 text-white text-lg font-mono text-center"
                />
              </div>

              {/* Quick Amounts */}
              <div className="flex flex-wrap gap-2">
                {[10000, 50000, 100000, 200000, 500000].map((amount) => (
                  <Button
                    key={amount}
                    size="sm"
                    variant="outline"
                    onClick={() => setCreditAmount(amount.toString())}
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                  >
                    {(amount / 1000).toFixed(0)}K
                  </Button>
                ))}
              </div>

              {/* Note */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">หมายเหตุ (ไม่บังคับ)</label>
                <Input
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="เช่น เติมเครดิตประจำสัปดาห์"
                  className="bg-black/40 border-amber-500/30 text-white placeholder:text-slate-500"
                />
              </div>

              {/* Preview */}
              {creditAmount && (
                <div className={cn(
                  "p-3 rounded-lg border",
                  creditAction === 'add' ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
                )}>
                  <div className="text-sm">
                    <span className="text-slate-400">วงเงินใหม่จะเป็น: </span>
                    <span className={cn(
                      "font-mono font-bold",
                      creditAction === 'add' ? "text-emerald-400" : "text-red-400"
                    )}>
                      {creditAction === 'add' 
                        ? (selectedAgent.creditLimit + parseFloat(creditAmount || '0')).toLocaleString()
                        : (selectedAgent.creditLimit - parseFloat(creditAmount || '0')).toLocaleString()
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCreditAction(null); setSelectedAgent(null); }}
              className="border-slate-500/30 text-slate-400"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleCreditAction}
              disabled={!creditAmount || parseFloat(creditAmount) <= 0}
              className={cn(
                "font-bold",
                creditAction === 'add'
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                  : "bg-gradient-to-r from-red-500 to-red-600 text-white"
              )}
            >
              <Check className="size-4 mr-2" />
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
