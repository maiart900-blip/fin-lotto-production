'use client';

import { useState } from 'react';
import { 
  Percent, 
  Settings, 
  Save,
  AlertTriangle,
  ChevronRight,
  Crown,
  Building2,
  User,
  Calculator,
  Info,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AgentCommission {
  id: string;
  username: string;
  name: string;
  level: 'master' | 'agent' | 'sub-agent';
  parentName: string | null;
  parentCommission?: number;
  commission: number; // Commission they give to downline
  myCommission: number; // Commission they keep
  pt: number; // Position Taking %
  maxPT: number;
  isEditing?: boolean;
}

const mockAgents: AgentCommission[] = [
  {
    id: 'M001',
    username: 'master_a',
    name: 'มาสเตอร์ A',
    level: 'master',
    parentName: null,
    parentCommission: 30, // From admin
    commission: 25, // Gives to agents
    myCommission: 5, // Keeps 5%
    pt: 20,
    maxPT: 30,
  },
  {
    id: 'A001',
    username: 'agent_1',
    name: 'เอเย่นต์ 1',
    level: 'agent',
    parentName: 'มาสเตอร์ A',
    parentCommission: 25,
    commission: 20,
    myCommission: 5,
    pt: 15,
    maxPT: 20,
  },
  {
    id: 'S001',
    username: 'sub_agent_1',
    name: 'ซับเอเย่นต์ 1-1',
    level: 'sub-agent',
    parentName: 'เอเย่นต์ 1',
    parentCommission: 20,
    commission: 0, // No downline
    myCommission: 20,
    pt: 10,
    maxPT: 15,
  },
  {
    id: 'S002',
    username: 'sub_agent_2',
    name: 'ซับเอเย่นต์ 1-2',
    level: 'sub-agent',
    parentName: 'เอเย่นต์ 1',
    parentCommission: 20,
    commission: 0,
    myCommission: 20,
    pt: 10,
    maxPT: 15,
  },
  {
    id: 'A002',
    username: 'agent_2',
    name: 'เอเย่นต์ 2',
    level: 'agent',
    parentName: 'มาสเตอร์ A',
    parentCommission: 25,
    commission: 18,
    myCommission: 7,
    pt: 12,
    maxPT: 20,
  },
];

export default function CommissionSettingsPage() {
  const [agents, setAgents] = useState(mockAgents);
  const [editingAgent, setEditingAgent] = useState<AgentCommission | null>(null);
  const [tempCommission, setTempCommission] = useState(0);
  const [tempPT, setTempPT] = useState(0);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcBetAmount, setCalcBetAmount] = useState('10000');

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

  const handleEdit = (agent: AgentCommission) => {
    setEditingAgent(agent);
    setTempCommission(agent.commission);
    setTempPT(agent.pt);
  };

  const handleSave = () => {
    if (!editingAgent) return;
    
    setAgents(agents.map(a => 
      a.id === editingAgent.id 
        ? { 
            ...a, 
            commission: tempCommission, 
            myCommission: (a.parentCommission || 0) - tempCommission,
            pt: tempPT 
          }
        : a
    ));
    setEditingAgent(null);
  };

  // Calculate commission spread example
  const calculateExample = (betAmount: number) => {
    const adminRate = 30; // Admin gives 30%
    const masterRate = 25; // Master gives 25%
    const agentRate = 20; // Agent gives 20%

    return {
      betAmount,
      adminToMaster: betAmount * (adminRate / 100),
      masterKeeps: betAmount * ((adminRate - masterRate) / 100),
      masterToAgent: betAmount * (masterRate / 100),
      agentKeeps: betAmount * ((masterRate - agentRate) / 100),
      agentToSub: betAmount * (agentRate / 100),
    };
  };

  const example = calculateExample(parseFloat(calcBetAmount) || 10000);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            ตั้งค่า PT / ค่าคอมมิชชัน
          </h1>
          <p className="text-slate-400 mt-2">กำหนดอัตราการถือสู้ (PT) และส่วนแบ่งค่าคอมมิชชันระหว่างชั้น</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { label: 'โครงสร้างสายงาน', href: '/manual-downline' },
            { label: 'จัดการเครดิต', href: '/manual-downline/credit' },
            { label: 'ตั้งค่า PT/คอม', href: '/manual-downline/commission', active: true },
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

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* PT Explanation */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Percent className="size-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-blue-400 mb-1">Position Taking (PT)</h3>
                <p className="text-sm text-slate-400">
                  อัตราการถือสู้ของเอเย่นต์ เช่น PT 20% หมายถึง เอเย่นต์รับผิดชอบ 20% ของยอดแทง 
                  หากลูกค้าถูกรางวัล เอเย่นต์ต้องจ่าย 20% ของเงินรางวัล แต่ถ้���ลูกค้าแพ้ เอเย่นต์ได้กำไร 20% ของยอดแทง
                </p>
              </div>
            </div>
          </div>

          {/* Commission Explanation */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Settings className="size-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-amber-400 mb-1">Commission Spread</h3>
                <p className="text-sm text-slate-400">
                  ส่วนต่างค่าคอมมิชชันที่เอเย่นต์เก็บไว้เอง เช่น แม่ให้มา 30% แต่ให้ลูกทีม 25% 
                  เอเย่นต์กินส่วนต่าง 5% จากทุกยอดแทงของสายงาน
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Calculator Button */}
        <div className="mb-6">
          <Button
            onClick={() => setShowCalculator(true)}
            variant="outline"
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          >
            <Calculator className="size-4 mr-2" />
            เครื่องคำนวณคอมมิชชัน
          </Button>
        </div>

        {/* Agent Commission Table */}
        <div className="rounded-xl overflow-hidden border border-amber-500/20">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-black/60 text-sm font-bold text-slate-400 border-b border-amber-500/20">
            <div className="col-span-3">เอเย่นต์</div>
            <div className="col-span-2 text-center">รับจากแม่</div>
            <div className="col-span-2 text-center">ให้ลูกทีม</div>
            <div className="col-span-2 text-center">กินส่วนต่าง</div>
            <div className="col-span-2 text-center">PT %</div>
            <div className="col-span-1 text-center">จัดการ</div>
          </div>

          {/* Table Body */}
          {agents.map((agent) => {
            const levelConfig = getLevelConfig(agent.level);
            const LevelIcon = levelConfig.icon;

            return (
              <div 
                key={agent.id}
                className="grid grid-cols-12 gap-4 p-4 items-center bg-black/40 hover:bg-black/50 transition-colors border-b border-white/5 last:border-b-0"
              >
                {/* Agent Info */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className={cn(
                    "size-10 rounded-full flex items-center justify-center border",
                    levelConfig.bg,
                    levelConfig.border
                  )}>
                    <LevelIcon className={cn("size-5", levelConfig.color)} />
                  </div>
                  <div>
                    <div className="font-bold text-white">{agent.name}</div>
                    <div className="text-xs text-slate-500">
                      {agent.parentName ? `ภายใต้: ${agent.parentName}` : 'ระดับสูงสุด'}
                    </div>
                  </div>
                </div>

                {/* Parent Commission */}
                <div className="col-span-2 text-center">
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {agent.parentCommission || '-'}%
                  </span>
                </div>

                {/* Give to Downline */}
                <div className="col-span-2 text-center">
                  <span className="text-lg font-bold text-blue-400 font-mono">
                    {agent.commission}%
                  </span>
                </div>

                {/* Keep (Spread) */}
                <div className="col-span-2 text-center">
                  <span className="text-lg font-bold text-amber-400 font-mono">
                    {agent.myCommission}%
                  </span>
                </div>

                {/* PT */}
                <div className="col-span-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg font-bold text-purple-400 font-mono">
                      {agent.pt}%
                    </span>
                    <span className="text-xs text-slate-500">
                      (max: {agent.maxPT}%)
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-center">
                  <Button
                    size="sm"
                    onClick={() => handleEdit(agent)}
                    className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/40"
                  >
                    <Settings className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Commission Flow Diagram */}
        <div className="mt-8 p-6 rounded-xl bg-black/40 border border-amber-500/20">
          <h3 className="font-bold text-amber-400 mb-4 flex items-center gap-2">
            <ChevronRight className="size-5" />
            ตัวอย่างการไหลของค่าคอมมิชชัน
          </h3>
          
          <div className="flex flex-wrap items-center justify-center gap-4 py-4">
            {/* Admin */}
            <div className="text-center">
              <div className="size-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-2">
                <Crown className="size-8 text-red-400" />
              </div>
              <div className="text-sm font-bold text-white">เว็บแม่</div>
              <div className="text-xs text-slate-400">ให้ 30%</div>
            </div>

            <ChevronRight className="size-6 text-amber-400" />

            {/* Master */}
            <div className="text-center">
              <div className="size-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-2">
                <Crown className="size-8 text-amber-400" />
              </div>
              <div className="text-sm font-bold text-white">Master</div>
              <div className="text-xs text-slate-400">รับ 30% | ให้ 25%</div>
              <Badge className="mt-1 bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]">
                เก็บ 5%
              </Badge>
            </div>

            <ChevronRight className="size-6 text-amber-400" />

            {/* Agent */}
            <div className="text-center">
              <div className="size-16 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mx-auto mb-2">
                <Building2 className="size-8 text-blue-400" />
              </div>
              <div className="text-sm font-bold text-white">Agent</div>
              <div className="text-xs text-slate-400">รับ 25% | ให้ 20%</div>
              <Badge className="mt-1 bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px]">
                เก็บ 5%
              </Badge>
            </div>

            <ChevronRight className="size-6 text-amber-400" />

            {/* Sub-Agent */}
            <div className="text-center">
              <div className="size-16 rounded-full bg-slate-500/20 border border-slate-500/40 flex items-center justify-center mx-auto mb-2">
                <User className="size-8 text-slate-400" />
              </div>
              <div className="text-sm font-bold text-white">Sub-Agent</div>
              <div className="text-xs text-slate-400">รับ 20%</div>
              <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                สุทธิ 20%
              </Badge>
            </div>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editingAgent !== null} onOpenChange={() => setEditingAgent(null)}>
          <DialogContent className="bg-[#0a0f1a] border-amber-500/30 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="size-5 text-amber-400" />
                ตั้งค่า PT/คอม - {editingAgent?.name}
              </DialogTitle>
            </DialogHeader>

            {editingAgent && (
              <div className="space-y-6 py-4">
                {/* Commission Setting */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-400">ค่าคอมที่ให้ลูกทีม</label>
                    <span className="text-lg font-bold text-blue-400 font-mono">
                      {tempCommission}%
                    </span>
                  </div>
                  <Slider
                    value={[tempCommission]}
                    onValueChange={([val]) => setTempCommission(val)}
                    max={editingAgent.parentCommission || 30}
                    step={1}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>0%</span>
                    <span>สูงสุด: {editingAgent.parentCommission || 30}%</span>
                  </div>
                  
                  {/* Spread Preview */}
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="text-sm">
                      <span className="text-slate-400">ส่วนต่างที่เก็บไว้เอง: </span>
                      <span className="text-amber-400 font-bold font-mono">
                        {(editingAgent.parentCommission || 0) - tempCommission}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* PT Setting */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-400 flex items-center gap-2">
                      Position Taking (PT)
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="size-4 text-slate-500" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#0a0f1a] border-amber-500/30 text-white max-w-xs">
                          <p>อัตราการถือสู้ - รับผิดชอบกำไร/ขาดทุนตาม % ที่ตั้ง</p>
                        </TooltipContent>
                      </Tooltip>
                    </label>
                    <span className="text-lg font-bold text-purple-400 font-mono">
                      {tempPT}%
                    </span>
                  </div>
                  <Slider
                    value={[tempPT]}
                    onValueChange={([val]) => setTempPT(val)}
                    max={editingAgent.maxPT}
                    step={1}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>0%</span>
                    <span>สูงสุด: {editingAgent.maxPT}%</span>
                  </div>
                </div>

                {/* Warning */}
                {tempCommission > (editingAgent.parentCommission || 0) && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                    <AlertTriangle className="size-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-400">
                      ไม่สามารถให้ค่าคอมเกินกว่าที่ได้รับมา
                    </span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingAgent(null)}
                className="border-slate-500/30 text-slate-400"
              >
                <X className="size-4 mr-2" />
                ยกเลิก
              </Button>
              <Button
                onClick={handleSave}
                disabled={tempCommission > (editingAgent?.parentCommission || 0)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
              >
                <Save className="size-4 mr-2" />
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Calculator Dialog */}
        <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
          <DialogContent className="bg-[#0a0f1a] border-amber-500/30 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calculator className="size-5 text-amber-400" />
                เครื่องคำนวณคอมมิชชัน
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Bet Amount Input */}
              <div>
                <label className="text-sm text-slate-400 mb-2 block">ยอดแทง</label>
                <Input
                  type="number"
                  value={calcBetAmount}
                  onChange={(e) => setCalcBetAmount(e.target.value)}
                  className="bg-black/40 border-amber-500/30 text-white text-lg font-mono"
                />
              </div>

              {/* Calculation Results */}
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400">เว็บแม่ให้ Master (30%)</div>
                    <div className="text-sm text-white">จากยอด {example.betAmount.toLocaleString()}</div>
                  </div>
                  <div className="text-xl font-bold text-red-400 font-mono">
                    {example.adminToMaster.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400">Master เก็บ (5%)</div>
                    <div className="text-sm text-white">ส่วนต่าง 30% - 25%</div>
                  </div>
                  <div className="text-xl font-bold text-amber-400 font-mono">
                    {example.masterKeeps.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400">Agent เก็บ (5%)</div>
                    <div className="text-sm text-white">ส่วนต่าง 25% - 20%</div>
                  </div>
                  <div className="text-xl font-bold text-blue-400 font-mono">
                    {example.agentKeeps.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-slate-400">Sub-Agent สุทธิ (20%)</div>
                    <div className="text-sm text-white">คอมเต็มจำนวน</div>
                  </div>
                  <div className="text-xl font-bold text-emerald-400 font-mono">
                    {example.agentToSub.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
