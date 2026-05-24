'use client';

import { useState } from 'react';
import { 
  Crown, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Settings,
  Edit3,
  Save,
  X,
  Plus,
  Minus,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Infinity,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Percent,
  Eye,
  Lock,
  Unlock,
  Search,
  Filter,
  Download,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// =====================================================
// SUPER ADMIN - AGENT DOWNLINE MANAGEMENT
// สำหรับเจ้าของระบบ (ไม่มีวงเงินจำกัด)
// แก้ไข Commission, PT, Credit ได้ทันที
// =====================================================

interface AgentNode {
  id: string;
  username: string;
  name: string;
  level: 'master' | 'senior' | 'agent';
  creditLimit: number;
  creditUsed: number;
  commission: number;
  pt: number;
  todayBets: number;
  todayWinLoss: number;
  memberCount: number;
  downlineCount: number;
  status: 'active' | 'locked' | 'warning';
  children?: AgentNode[];
}

interface TotalFlow {
  incoming: number;
  outgoing: number;
  net: number;
}

export default function SuperAdminDownlinePage() {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['M001', 'M002']));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'warning' | 'locked'>('all');

  // Mock data - replace with real API
  const totalCreditReleased = 25750000;
  const totalFlow: TotalFlow = {
    incoming: 12500000,
    outgoing: 8200000,
    net: 4300000
  };
  const totalAgents = 32;
  const totalMembers = 1850;
  const todayBets = 5850000;
  const todayWinLoss = 485000;

  // Revenue chart data (7 days)
  const revenueData = [
    { date: '7 พ.ค.', revenue: 520000, bets: 6200000 },
    { date: '8 พ.ค.', revenue: 385000, bets: 4800000 },
    { date: '9 พ.ค.', revenue: 610000, bets: 7100000 },
    { date: '10 พ.ค.', revenue: 295000, bets: 3900000 },
    { date: '11 พ.ค.', revenue: 720000, bets: 8200000 },
    { date: '12 พ.ค.', revenue: 480000, bets: 5800000 },
    { date: '13 พ.ค.', revenue: 485000, bets: 5850000 },
  ];
  const maxRevenue = Math.max(...revenueData.map(d => d.revenue));

  // Mock agent tree
  const agentTree: AgentNode[] = [
    {
      id: 'M001',
      username: 'master_north',
      name: 'สายเหนือ (เจ้าเก่ง)',
      level: 'master',
      creditLimit: 8000000,
      creditUsed: 5200000,
      commission: 30,
      pt: 20,
      todayBets: 1850000,
      todayWinLoss: 185000,
      memberCount: 650,
      downlineCount: 12,
      status: 'active',
      children: [
        {
          id: 'S001',
          username: 'senior_cm',
          name: 'เชียงใหม่ (พี่หนึ่ง)',
          level: 'senior',
          creditLimit: 3000000,
          creditUsed: 2400000,
          commission: 27,
          pt: 17,
          todayBets: 650000,
          todayWinLoss: 72000,
          memberCount: 220,
          downlineCount: 5,
          status: 'active',
        },
        {
          id: 'S002',
          username: 'senior_cr',
          name: 'เชียงราย (พี่สอง)',
          level: 'senior',
          creditLimit: 2500000,
          creditUsed: 2450000,
          commission: 25,
          pt: 15,
          todayBets: 480000,
          todayWinLoss: -35000,
          memberCount: 180,
          downlineCount: 4,
          status: 'warning',
        },
      ]
    },
    {
      id: 'M002',
      username: 'master_south',
      name: 'สายใต้ (เจ้าหนุ่ม)',
      level: 'master',
      creditLimit: 6000000,
      creditUsed: 4800000,
      commission: 28,
      pt: 18,
      todayBets: 1250000,
      todayWinLoss: -85000,
      memberCount: 480,
      downlineCount: 8,
      status: 'active',
      children: [
        {
          id: 'S003',
          username: 'senior_hkt',
          name: 'ภูเก็ต (พี่เก็ต)',
          level: 'senior',
          creditLimit: 2000000,
          creditUsed: 1950000,
          commission: 25,
          pt: 15,
          todayBets: 520000,
          todayWinLoss: 45000,
          memberCount: 150,
          downlineCount: 3,
          status: 'warning',
        },
      ]
    },
    {
      id: 'M003',
      username: 'master_central',
      name: 'สายกลาง (เจ้าโต้ง)',
      level: 'master',
      creditLimit: 5500000,
      creditUsed: 3100000,
      commission: 32,
      pt: 22,
      todayBets: 1480000,
      todayWinLoss: 185000,
      memberCount: 420,
      downlineCount: 7,
      status: 'active',
    },
    {
      id: 'M004',
      username: 'master_east',
      name: 'สายตะวันออก (เจ้าบอย)',
      level: 'master',
      creditLimit: 3500000,
      creditUsed: 3480000,
      commission: 25,
      pt: 15,
      todayBets: 620000,
      todayWinLoss: -55000,
      memberCount: 200,
      downlineCount: 5,
      status: 'locked',
    },
  ];

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleEditStart = (nodeId: string, field: string, currentValue: number) => {
    setIsEditing(`${nodeId}-${field}`);
    setEditValues({ ...editValues, [`${nodeId}-${field}`]: currentValue });
  };

  const handleEditSave = async (nodeId: string, field: string) => {
    // API call to update
    console.log(`Saving ${field} for ${nodeId}:`, editValues[`${nodeId}-${field}`]);
    setIsEditing(null);
  };

  const handleCreditAdjust = async (nodeId: string, amount: number) => {
    console.log(`Adjusting credit for ${nodeId}:`, amount);
  };

  const handleToggleLock = async (nodeId: string, currentLocked: boolean) => {
    console.log(`Toggle lock for ${nodeId}:`, !currentLocked);
  };

  // Render agent node
  const renderAgentNode = (node: AgentNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const creditPercent = (node.creditUsed / node.creditLimit) * 100;

    // Filter
    if (filterStatus !== 'all' && node.status !== filterStatus) return null;
    if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !node.username.toLowerCase().includes(searchQuery.toLowerCase())) return null;

    return (
      <div key={node.id} className="animate-fade-in-up" style={{ animationDelay: `${depth * 50}ms` }}>
        <div 
          className={cn(
            "group relative p-4 rounded-xl backdrop-blur-xl border transition-all duration-300",
            "hover:shadow-[0_0_30px_rgba(255,215,0,0.1)]",
            node.status === 'locked' && "opacity-60",
            node.level === 'master' && "bg-gradient-to-r from-amber-900/20 via-black/40 to-amber-900/20 border-amber-500/40",
            node.level === 'senior' && "bg-gradient-to-r from-blue-900/20 via-black/40 to-blue-900/20 border-blue-500/30",
            node.level === 'agent' && "bg-black/40 border-slate-700/50",
          )}
          style={{ marginLeft: depth * 24 }}
        >
          {/* Top shine */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="flex items-center gap-4">
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button 
                onClick={() => toggleExpand(node.id)}
                className="size-8 rounded-lg bg-black/50 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <div className="size-8" />
            )}

            {/* Level Icon */}
            <div className={cn(
              "size-12 rounded-xl flex items-center justify-center shadow-lg",
              node.level === 'master' && "bg-gradient-to-br from-amber-500 to-yellow-600 text-black",
              node.level === 'senior' && "bg-gradient-to-br from-blue-500 to-blue-700 text-white",
              node.level === 'agent' && "bg-gradient-to-br from-slate-600 to-slate-800 text-white",
            )}>
              {node.level === 'master' && <Crown className="size-6" />}
              {node.level === 'senior' && <Building2 className="size-6" />}
              {node.level === 'agent' && <Users className="size-6" />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white truncate">{node.name}</h3>
                <Badge className={cn(
                  "text-[10px]",
                  node.level === 'master' && "bg-amber-500/20 text-amber-300 border-amber-500/30",
                  node.level === 'senior' && "bg-blue-500/20 text-blue-300 border-blue-500/30",
                  node.level === 'agent' && "bg-slate-500/20 text-slate-300 border-slate-500/30",
                )}>
                  {node.level === 'master' ? 'MASTER' : node.level === 'senior' ? 'SENIOR' : 'AGENT'}
                </Badge>
                {node.status === 'locked' && (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                    <Lock className="size-3 mr-1" />
                    ล็อค
                  </Badge>
                )}
                {node.status === 'warning' && (
                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 animate-pulse">
                    <AlertTriangle className="size-3 mr-1" />
                    เตือน
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-400">@{node.username} | {node.memberCount} สมาชิก | {node.downlineCount} ลูกทีม</p>
            </div>

            {/* Credit with Edit */}
            <div className="text-right min-w-[180px]">
              <div className="flex items-center justify-end gap-2">
                {isEditing === `${node.id}-creditLimit` ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={editValues[`${node.id}-creditLimit`] || node.creditLimit}
                      onChange={(e) => setEditValues({ ...editValues, [`${node.id}-creditLimit`]: Number(e.target.value) })}
                      className="w-28 h-8 text-sm bg-black/50 border-amber-500/50 text-right"
                    />
                    <Button size="sm" variant="ghost" className="size-7 p-0 text-emerald-400" onClick={() => handleEditSave(node.id, 'creditLimit')}>
                      <Save className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="size-7 p-0 text-red-400" onClick={() => setIsEditing(null)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 group/edit">
                    <span className="text-white font-bold">{node.creditLimit.toLocaleString()}</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="size-6 p-0 text-amber-400/50 hover:text-amber-400 opacity-0 group-hover/edit:opacity-100"
                      onClick={() => handleEditStart(node.id, 'creditLimit', node.creditLimit)}
                    >
                      <Edit3 className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden w-24">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      creditPercent > 95 ? "bg-red-500" : creditPercent > 80 ? "bg-orange-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${Math.min(creditPercent, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{Math.round(creditPercent)}%</span>
              </div>
              {/* Quick Adjust */}
              <div className="flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-emerald-400 hover:bg-emerald-500/20" onClick={() => handleCreditAdjust(node.id, 500000)}>
                  <Plus className="size-3 mr-0.5" />500K
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-400 hover:bg-red-500/20" onClick={() => handleCreditAdjust(node.id, -500000)}>
                  <Minus className="size-3 mr-0.5" />500K
                </Button>
              </div>
            </div>

            {/* Commission with Edit */}
            <div className="text-center min-w-[80px]">
              <p className="text-[10px] text-slate-500 mb-1">คอม</p>
              {isEditing === `${node.id}-commission` ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={editValues[`${node.id}-commission`] || node.commission}
                    onChange={(e) => setEditValues({ ...editValues, [`${node.id}-commission`]: Number(e.target.value) })}
                    className="w-14 h-7 text-xs text-center bg-black/50 border-amber-500/50"
                  />
                  <Button size="sm" variant="ghost" className="size-6 p-0 text-emerald-400" onClick={() => handleEditSave(node.id, 'commission')}>
                    <Save className="size-3" />
                  </Button>
                </div>
              ) : (
                <div className="group/edit flex items-center justify-center gap-1">
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 font-bold">{node.commission}%</Badge>
                  <Button size="sm" variant="ghost" className="size-5 p-0 text-amber-400/50 hover:text-amber-400 opacity-0 group-hover/edit:opacity-100" onClick={() => handleEditStart(node.id, 'commission', node.commission)}>
                    <Edit3 className="size-2.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* PT with Edit */}
            <div className="text-center min-w-[80px]">
              <p className="text-[10px] text-slate-500 mb-1">PT</p>
              {isEditing === `${node.id}-pt` ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={editValues[`${node.id}-pt`] || node.pt}
                    onChange={(e) => setEditValues({ ...editValues, [`${node.id}-pt`]: Number(e.target.value) })}
                    className="w-14 h-7 text-xs text-center bg-black/50 border-amber-500/50"
                  />
                  <Button size="sm" variant="ghost" className="size-6 p-0 text-emerald-400" onClick={() => handleEditSave(node.id, 'pt')}>
                    <Save className="size-3" />
                  </Button>
                </div>
              ) : (
                <div className="group/edit flex items-center justify-center gap-1">
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 font-bold">{node.pt}%</Badge>
                  <Button size="sm" variant="ghost" className="size-5 p-0 text-amber-400/50 hover:text-amber-400 opacity-0 group-hover/edit:opacity-100" onClick={() => handleEditStart(node.id, 'pt', node.pt)}>
                    <Edit3 className="size-2.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Today Stats */}
            <div className="text-right min-w-[120px]">
              <p className="text-[10px] text-slate-500">ยอดแทงวันนี้</p>
              <p className="text-white font-bold">{node.todayBets.toLocaleString()}</p>
              <p className={cn(
                "text-sm font-bold",
                node.todayWinLoss >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {node.todayWinLoss >= 0 ? '+' : ''}{node.todayWinLoss.toLocaleString()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  "size-8 p-0",
                  node.status === 'locked' ? "text-emerald-400 hover:bg-emerald-500/20" : "text-red-400 hover:bg-red-500/20"
                )}
                onClick={() => handleToggleLock(node.id, node.status === 'locked')}
              >
                {node.status === 'locked' ? <Unlock className="size-4" /> : <Lock className="size-4" />}
              </Button>
              <Link href={`/manual-downline?agent=${node.id}`}>
                <Button size="sm" variant="ghost" className="size-8 p-0 text-amber-400 hover:bg-amber-500/20">
                  <Settings className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mt-2 space-y-2 border-l-2 border-amber-500/20 ml-4">
            {node.children?.map(child => renderAgentNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Crown className="size-6 text-black" />
            </div>
            <div>
              <h1 
                className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
                style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
              >
                จัดการสายงาน Manual
              </h1>
              <p className="text-slate-400 text-sm">Super Admin - FIN LOTTO R+</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/30 px-3 py-1">
            <Zap className="size-3 mr-1" />
            Premium Admin
          </Badge>
          <Button variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Super Admin Credit Status - INFINITY */}
      <div className="relative p-6 rounded-2xl backdrop-blur-xl bg-gradient-to-br from-amber-900/30 via-yellow-900/20 to-amber-900/30 border border-amber-500/40 shadow-[0_0_50px_rgba(255,215,0,0.15)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          {/* Credit Status - Infinity */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-sm text-slate-400 mb-1">วงเงินระบบ</p>
            <div className="flex items-center gap-2">
              <Infinity className="size-8 text-amber-400" />
              <span 
                className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-400"
                style={{ textShadow: '0 0 20px rgba(255,215,0,0.5)' }}
              >
                ไม่จำกัด
              </span>
            </div>
            <p className="text-xs text-amber-500/70 mt-1">Super Admin Mode</p>
          </div>

          {/* Total Credit Released */}
          <div>
            <p className="text-sm text-slate-400">เครดิตปล่อยทั้งหมด</p>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">{totalCreditReleased.toLocaleString()}</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
              <ArrowUpRight className="size-3" />+3.2M จากเดือนก่อน
            </p>
          </div>

          {/* Total Flow - Net */}
          <div>
            <p className="text-sm text-slate-400">กระแสเงินสดสุทธิ</p>
            <p className={cn("text-xl md:text-2xl font-bold mt-1", totalFlow.net >= 0 ? "text-emerald-400" : "text-red-400")}>
              {totalFlow.net >= 0 ? '+' : ''}{totalFlow.net.toLocaleString()}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-emerald-400">เข้า {totalFlow.incoming.toLocaleString()}</span>
              <span className="text-slate-500">|</span>
              <span className="text-red-400">ออก {totalFlow.outgoing.toLocaleString()}</span>
            </div>
          </div>

          {/* Total Agents/Members */}
          <div>
            <p className="text-sm text-slate-400">เอเย่นต์ / สมาชิก</p>
            <p className="text-xl md:text-2xl font-bold text-white mt-1">
              {totalAgents} <span className="text-sm text-slate-400">/ {totalMembers.toLocaleString()}</span>
            </p>
          </div>

          {/* Today Win/Loss */}
          <div>
            <p className="text-sm text-slate-400">กำไร/ขาดทุนวันนี้</p>
            <p className={cn("text-xl md:text-2xl font-bold mt-1", todayWinLoss >= 0 ? "text-emerald-400" : "text-red-400")}>
              {todayWinLoss >= 0 ? '+' : ''}{todayWinLoss.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">ยอดแทง {todayBets.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="relative p-4 md:p-6 rounded-2xl backdrop-blur-xl bg-black/40 border border-amber-500/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
              <BarChart3 className="size-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">รายได้รวมทุกสายงาน</h3>
              <p className="text-sm text-slate-400">7 วันย้อนหลัง</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-amber-400 hover:bg-amber-500/20">
            <Settings className="size-4" />
          </Button>
        </div>

        <div className="h-40 flex items-end gap-2">
          {revenueData.map((data, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div 
                className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-300 hover:from-emerald-500 hover:to-emerald-300 relative group cursor-pointer"
                style={{ height: `${(data.revenue / maxRevenue) * 100}%`, minHeight: '20px' }}
              >
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div className="bg-black/90 border border-amber-500/30 rounded-lg px-2 py-1 text-xs whitespace-nowrap">
                    <p className="text-amber-400 font-bold">{data.revenue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <span className="text-xs text-slate-500">{data.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input
            placeholder="ค้นหาเอเย่นต์..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-amber-500/30 focus:border-amber-400"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'warning', 'locked'] as const).map(status => (
            <Button
              key={status}
              size="sm"
              variant={filterStatus === status ? 'default' : 'outline'}
              onClick={() => setFilterStatus(status)}
              className={cn(
                filterStatus === status 
                  ? "bg-amber-500 text-black hover:bg-amber-400" 
                  : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              )}
            >
              {status === 'all' ? 'ทั้งหมด' : status === 'active' ? 'ปกติ' : status === 'warning' ? 'เตือน' : 'ล็อค'}
            </Button>
          ))}
        </div>
        <Link href="/manual-downline">
          <Button className="bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold hover:from-amber-400 hover:to-yellow-500">
            <Plus className="size-4 mr-2" />
            เพิ่ม Master
          </Button>
        </Link>
      </div>

      {/* Agent Tree */}
      <div className="space-y-3">
        {agentTree.map(node => renderAgentNode(node))}
      </div>
    </div>
  );
}
