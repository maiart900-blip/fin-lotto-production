'use client';

import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Users, 
  CreditCard, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Lock,
  Unlock,
  Settings,
  FileText,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Crown,
  User,
  Building2,
  Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Mock hierarchical agent data
interface AgentNode {
  id: string;
  username: string;
  name: string;
  level: 'master' | 'agent' | 'sub-agent';
  credit: number;
  creditUsed: number;
  creditLimit: number;
  todayBets: number;
  commission: number;
  pt: number; // Position Taking %
  isLocked: boolean;
  winLoss: number;
  outstanding: number;
  memberCount: number;
  children?: AgentNode[];
}

const mockAgentTree: AgentNode[] = [
  {
    id: 'M001',
    username: 'master_a',
    name: 'มาสเตอร์ A',
    level: 'master',
    credit: 1000000,
    creditUsed: 750000,
    creditLimit: 1000000,
    todayBets: 250000,
    commission: 30,
    pt: 20,
    isLocked: false,
    winLoss: 45000,
    outstanding: 120000,
    memberCount: 45,
    children: [
      {
        id: 'A001',
        username: 'agent_1',
        name: 'เอเย่นต์ 1',
        level: 'agent',
        credit: 300000,
        creditUsed: 220000,
        creditLimit: 300000,
        todayBets: 85000,
        commission: 25,
        pt: 15,
        isLocked: false,
        winLoss: 12000,
        outstanding: 35000,
        memberCount: 18,
        children: [
          {
            id: 'S001',
            username: 'sub_agent_1',
            name: 'ซับเอเย่นต์ 1-1',
            level: 'sub-agent',
            credit: 50000,
            creditUsed: 48000,
            creditLimit: 50000,
            todayBets: 25000,
            commission: 20,
            pt: 10,
            isLocked: true,
            winLoss: -5000,
            outstanding: 15000,
            memberCount: 5,
          },
          {
            id: 'S002',
            username: 'sub_agent_2',
            name: 'ซับเอเย่นต์ 1-2',
            level: 'sub-agent',
            credit: 80000,
            creditUsed: 45000,
            creditLimit: 80000,
            todayBets: 18000,
            commission: 20,
            pt: 10,
            isLocked: false,
            winLoss: 8000,
            outstanding: 8000,
            memberCount: 7,
          },
        ],
      },
      {
        id: 'A002',
        username: 'agent_2',
        name: 'เอเย่นต์ 2',
        level: 'agent',
        credit: 200000,
        creditUsed: 180000,
        creditLimit: 200000,
        todayBets: 65000,
        commission: 25,
        pt: 15,
        isLocked: false,
        winLoss: 18000,
        outstanding: 42000,
        memberCount: 12,
      },
    ],
  },
  {
    id: 'M002',
    username: 'master_b',
    name: 'มาสเตอร์ B',
    level: 'master',
    credit: 500000,
    creditUsed: 320000,
    creditLimit: 500000,
    todayBets: 120000,
    commission: 28,
    pt: 18,
    isLocked: false,
    winLoss: -15000,
    outstanding: 85000,
    memberCount: 28,
    children: [
      {
        id: 'A003',
        username: 'agent_3',
        name: 'เอเย่นต์ 3',
        level: 'agent',
        credit: 150000,
        creditUsed: 95000,
        creditLimit: 150000,
        todayBets: 45000,
        commission: 22,
        pt: 12,
        isLocked: false,
        winLoss: -8000,
        outstanding: 28000,
        memberCount: 10,
      },
    ],
  },
];

// Tree Node Component
function AgentTreeNode({ 
  agent, 
  depth = 0,
  onManageCredit,
  onToggleLock,
}: { 
  agent: AgentNode; 
  depth?: number;
  onManageCredit: (agent: AgentNode) => void;
  onToggleLock: (agent: AgentNode) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = agent.children && agent.children.length > 0;
  const creditPercent = (agent.creditUsed / agent.creditLimit) * 100;
  const isNearLimit = creditPercent >= 90;
  
  const getLevelConfig = () => {
    switch (agent.level) {
      case 'master':
        return { 
          icon: Crown, 
          color: 'text-amber-400', 
          bg: 'bg-amber-500/20',
          border: 'border-amber-500/40'
        };
      case 'agent':
        return { 
          icon: Building2, 
          color: 'text-blue-400', 
          bg: 'bg-blue-500/20',
          border: 'border-blue-500/40'
        };
      default:
        return { 
          icon: User, 
          color: 'text-slate-400', 
          bg: 'bg-slate-500/20',
          border: 'border-slate-500/40'
        };
    }
  };
  
  const levelConfig = getLevelConfig();
  const LevelIcon = levelConfig.icon;

  return (
    <div className="select-none">
      {/* Node Row */}
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
          "bg-black/40 backdrop-blur-sm border border-amber-500/20",
          "hover:border-amber-500/40 hover:bg-black/50",
          agent.isLocked && "opacity-60 border-red-500/40",
          depth > 0 && "ml-8"
        )}
        style={{ marginLeft: depth > 0 ? `${depth * 32}px` : 0 }}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "size-7 rounded-full flex items-center justify-center transition-colors",
            hasChildren 
              ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400" 
              : "bg-transparent"
          )}
          disabled={!hasChildren}
        >
          {hasChildren && (
            isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />
          )}
        </button>

        {/* Level Icon */}
        <div className={cn(
          "size-10 rounded-full flex items-center justify-center border",
          levelConfig.bg,
          levelConfig.border
        )}>
          <LevelIcon className={cn("size-5", levelConfig.color)} />
        </div>

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white truncate">{agent.name}</span>
            <span className="text-xs text-slate-500">@{agent.username}</span>
            {agent.isLocked && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px]">
                <Lock className="size-3 mr-1" />
                LOCKED
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
            <span className="flex items-center gap-1">
              <Users className="size-3" />
              {agent.memberCount} สมาชิก
            </span>
            <span className="flex items-center gap-1">
              <Percent className="size-3" />
              คอม {agent.commission}%
            </span>
            <span className="flex items-center gap-1">
              PT {agent.pt}%
            </span>
          </div>
        </div>

        {/* Credit Bar */}
        <div className="w-36">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">เครดิต</span>
            <span className={cn(
              "font-mono font-bold",
              isNearLimit ? "text-red-400" : "text-amber-400"
            )}>
              {creditPercent.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-black/60 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isNearLimit 
                  ? "bg-gradient-to-r from-red-500 to-red-600" 
                  : "bg-gradient-to-r from-amber-500 to-amber-600"
              )}
              style={{ width: `${Math.min(creditPercent, 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono text-right">
            {agent.creditUsed.toLocaleString()} / {agent.creditLimit.toLocaleString()}
          </div>
        </div>

        {/* Today Bets */}
        <div className="text-right w-24">
          <div className="text-[10px] text-slate-500">ยอดแทงวันนี้</div>
          <div className="text-sm font-bold text-white font-mono">
            {agent.todayBets.toLocaleString()}
          </div>
        </div>

        {/* Win/Loss */}
        <div className="text-right w-24">
          <div className="text-[10px] text-slate-500">กำไร/ขาดทุน</div>
          <div className={cn(
            "text-sm font-bold font-mono flex items-center justify-end gap-1",
            agent.winLoss >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {agent.winLoss >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {agent.winLoss >= 0 ? '+' : ''}{agent.winLoss.toLocaleString()}
          </div>
        </div>

        {/* Outstanding */}
        <div className="text-right w-24">
          <div className="text-[10px] text-slate-500">ยอดค้าง</div>
          <div className="text-sm font-bold text-orange-400 font-mono">
            {agent.outstanding.toLocaleString()}
          </div>
        </div>

        {/* Actions */}
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
              onClick={() => onManageCredit(agent)}
              className="text-amber-400 focus:bg-amber-500/20 focus:text-amber-300"
            >
              <CreditCard className="size-4 mr-2" />
              จัดการเครดิต
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onToggleLock(agent)}
              className={cn(
                "focus:bg-amber-500/20",
                agent.isLocked ? "text-emerald-400 focus:text-emerald-300" : "text-red-400 focus:text-red-300"
              )}
            >
              {agent.isLocked ? (
                <>
                  <Unlock className="size-4 mr-2" />
                  ปลดล็อค
                </>
              ) : (
                <>
                  <Lock className="size-4 mr-2" />
                  ล็อคเครดิต
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 focus:bg-amber-500/20 focus:text-white">
              <Settings className="size-4 mr-2" />
              ตั้งค่า PT/คอม
            </DropdownMenuItem>
            <DropdownMenuItem className="text-slate-300 focus:bg-amber-500/20 focus:text-white">
              <FileText className="size-4 mr-2" />
              ดูรายงาน
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {agent.children!.map((child) => (
            <AgentTreeNode 
              key={child.id} 
              agent={child} 
              depth={depth + 1}
              onManageCredit={onManageCredit}
              onToggleLock={onToggleLock}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ManualDownlinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);

  // Calculate totals
  const calculateTotals = (agents: AgentNode[]): { 
    totalCredit: number; 
    totalUsed: number; 
    totalBets: number;
    totalWinLoss: number;
    totalOutstanding: number;
    totalMembers: number;
  } => {
    let totals = { totalCredit: 0, totalUsed: 0, totalBets: 0, totalWinLoss: 0, totalOutstanding: 0, totalMembers: 0 };
    
    const traverse = (nodes: AgentNode[]) => {
      for (const node of nodes) {
        totals.totalCredit += node.creditLimit;
        totals.totalUsed += node.creditUsed;
        totals.totalBets += node.todayBets;
        totals.totalWinLoss += node.winLoss;
        totals.totalOutstanding += node.outstanding;
        totals.totalMembers += node.memberCount;
        if (node.children) traverse(node.children);
      }
    };
    
    traverse(agents);
    return totals;
  };

  const totals = calculateTotals(mockAgentTree);

  const handleManageCredit = (agent: AgentNode) => {
    setSelectedAgent(agent);
    // Open credit management modal
  };

  const handleToggleLock = (agent: AgentNode) => {
    // Toggle lock status
    console.log('Toggle lock for:', agent.username);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
        >
          สายงานเอเย่นต์ (Manual Downline)
        </h1>
        <p className="text-slate-400 mt-2">จัดการโครงสร้างสายงาน วงเงินเครดิต และค่าคอมมิชชัน</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'วงเงินรวม', value: totals.totalCredit, color: 'amber' },
          { label: 'ใช้ไปแล้ว', value: totals.totalUsed, color: 'blue' },
          { label: 'ยอดแทงวันนี้', value: totals.totalBets, color: 'purple' },
          { label: 'กำไร/ขาดทุน', value: totals.totalWinLoss, color: totals.totalWinLoss >= 0 ? 'emerald' : 'red', prefix: totals.totalWinLoss >= 0 ? '+' : '' },
          { label: 'ยอดค้างชำระ', value: totals.totalOutstanding, color: 'orange' },
          { label: 'สมาชิกทั้งหมด', value: totals.totalMembers, color: 'slate', suffix: ' คน', noFormat: true },
        ].map((stat, i) => (
          <div 
            key={i}
            className={cn(
              "p-4 rounded-xl backdrop-blur-sm border transition-all duration-300",
              "bg-black/40 border-amber-500/20 hover:border-amber-500/40"
            )}
          >
            <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
            <div className={cn(
              "text-xl font-bold font-mono",
              `text-${stat.color}-400`
            )}>
              {stat.prefix || ''}{stat.noFormat ? stat.value : stat.value.toLocaleString()}{stat.suffix || ''}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
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
        
        <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20">
          <Filter className="size-4 mr-2" />
          กรอง
        </Button>

        <Link href="/manual-downline/add">
          <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold hover:from-amber-400 hover:to-amber-500">
            <UserPlus className="size-4 mr-2" />
            เพิ่มเอเย่นต์
          </Button>
        </Link>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { label: 'โครงสร้างสายงาน', href: '/manual-downline', active: true },
          { label: 'จัดการเครดิต', href: '/manual-downline/credit' },
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

      {/* Tree View */}
      <div className="space-y-3">
        {mockAgentTree.map((agent) => (
          <AgentTreeNode 
            key={agent.id} 
            agent={agent}
            onManageCredit={handleManageCredit}
            onToggleLock={handleToggleLock}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 p-4 rounded-xl bg-black/40 border border-amber-500/20">
        <h3 className="text-sm font-bold text-amber-400 mb-3">คำอธิบายสัญลักษณ์</h3>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Crown className="size-3 text-amber-400" />
            </div>
            <span className="text-slate-400">Master</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              <Building2 className="size-3 text-blue-400" />
            </div>
            <span className="text-slate-400">Agent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-slate-500/20 border border-slate-500/40 flex items-center justify-center">
              <User className="size-3 text-slate-400" />
            </div>
            <span className="text-slate-400">Sub-Agent</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px]">
              <Lock className="size-3 mr-1" />
              LOCKED
            </Badge>
            <span className="text-slate-400">เครดิตถูกล็อค</span>
          </div>
        </div>
      </div>
    </div>
  );
}
