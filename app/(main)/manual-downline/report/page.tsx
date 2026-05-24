'use client';

import { useState } from 'react';
import { 
  FileText, 
  Download, 
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Crown,
  Building2,
  User,
  Calendar,
  ChevronDown,
  CheckCircle,
  Clock,
  Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AgentReport {
  id: string;
  username: string;
  name: string;
  level: 'master' | 'agent' | 'sub-agent';
  parentName: string | null;
  totalBets: number;
  totalPayout: number;
  winLoss: number;
  commission: number;
  commissionAmount: number;
  ptAmount: number;
  netResult: number;
  outstanding: number;
  clearedAmount: number;
  pendingClear: number;
  memberCount: number;
}

const mockReports: AgentReport[] = [
  {
    id: 'M001',
    username: 'master_a',
    name: 'มาสเตอร์ A',
    level: 'master',
    parentName: null,
    totalBets: 850000,
    totalPayout: 720000,
    winLoss: 130000,
    commission: 5,
    commissionAmount: 42500,
    ptAmount: 26000,
    netResult: 198500,
    outstanding: 120000,
    clearedAmount: 680000,
    pendingClear: 170000,
    memberCount: 45,
  },
  {
    id: 'A001',
    username: 'agent_1',
    name: 'เอเย่นต์ 1',
    level: 'agent',
    parentName: 'มาสเตอร์ A',
    totalBets: 350000,
    totalPayout: 280000,
    winLoss: 70000,
    commission: 5,
    commissionAmount: 17500,
    ptAmount: 10500,
    netResult: 98000,
    outstanding: 35000,
    clearedAmount: 280000,
    pendingClear: 70000,
    memberCount: 18,
  },
  {
    id: 'S001',
    username: 'sub_agent_1',
    name: 'ซับเอเย่นต์ 1-1',
    level: 'sub-agent',
    parentName: 'เอเย่นต์ 1',
    totalBets: 120000,
    totalPayout: 140000,
    winLoss: -20000,
    commission: 20,
    commissionAmount: 24000,
    ptAmount: -2000,
    netResult: 2000,
    outstanding: 15000,
    clearedAmount: 90000,
    pendingClear: 30000,
    memberCount: 5,
  },
  {
    id: 'S002',
    username: 'sub_agent_2',
    name: 'ซับเอเย่นต์ 1-2',
    level: 'sub-agent',
    parentName: 'เอเย่นต์ 1',
    totalBets: 95000,
    totalPayout: 75000,
    winLoss: 20000,
    commission: 20,
    commissionAmount: 19000,
    ptAmount: 2000,
    netResult: 41000,
    outstanding: 8000,
    clearedAmount: 75000,
    pendingClear: 20000,
    memberCount: 7,
  },
  {
    id: 'A002',
    username: 'agent_2',
    name: 'เอเย่นต์ 2',
    level: 'agent',
    parentName: 'มาสเตอร์ A',
    totalBets: 280000,
    totalPayout: 250000,
    winLoss: 30000,
    commission: 7,
    commissionAmount: 19600,
    ptAmount: 3600,
    netResult: 53200,
    outstanding: 42000,
    clearedAmount: 200000,
    pendingClear: 80000,
    memberCount: 12,
  },
  {
    id: 'M002',
    username: 'master_b',
    name: 'มาสเตอร์ B',
    level: 'master',
    parentName: null,
    totalBets: 420000,
    totalPayout: 450000,
    winLoss: -30000,
    commission: 5,
    commissionAmount: 21000,
    ptAmount: -5400,
    netResult: -14400,
    outstanding: 85000,
    clearedAmount: 320000,
    pendingClear: 100000,
    memberCount: 28,
  },
];

const periods = [
  { value: 'today', label: 'วันนี้' },
  { value: 'yesterday', label: 'เมื่อวาน' },
  { value: 'week', label: 'สัปดาห์นี้' },
  { value: 'month', label: 'เดือนนี้' },
  { value: 'last_round', label: 'งวดล่าสุด (16 ม.ค. 67)' },
];

export default function AgentReportPage() {
  const [period, setPeriod] = useState('last_round');
  const [levelFilter, setLevelFilter] = useState('all');

  const filteredReports = mockReports.filter(r => 
    levelFilter === 'all' || r.level === levelFilter
  );

  // Calculate totals
  const totals = filteredReports.reduce((acc, r) => ({
    totalBets: acc.totalBets + r.totalBets,
    totalPayout: acc.totalPayout + r.totalPayout,
    winLoss: acc.winLoss + r.winLoss,
    commissionAmount: acc.commissionAmount + r.commissionAmount,
    ptAmount: acc.ptAmount + r.ptAmount,
    netResult: acc.netResult + r.netResult,
    outstanding: acc.outstanding + r.outstanding,
    pendingClear: acc.pendingClear + r.pendingClear,
  }), {
    totalBets: 0,
    totalPayout: 0,
    winLoss: 0,
    commissionAmount: 0,
    ptAmount: 0,
    netResult: 0,
    outstanding: 0,
    pendingClear: 0,
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
        >
          รายงานแพ้-ชนะ
        </h1>
        <p className="text-slate-400 mt-2">สรุปยอดกำไร/ขาดทุน และยอดค้างชำระรายเอเย่นต์</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { label: 'โครงสร้างสายงาน', href: '/manual-downline' },
          { label: 'จัดการเครดิต', href: '/manual-downline/credit' },
          { label: 'ตั้งค่า PT/คอม', href: '/manual-downline/commission' },
          { label: 'รายชื่อลูกค้า', href: '/manual-downline/members' },
          { label: 'รายงานแพ้ชนะ', href: '/manual-downline/report', active: true },
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

      {/* Period & Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-amber-400" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-52 bg-black/40 border-amber-500/30 text-white">
              <SelectValue placeholder="เลือกช่วงเวลา" />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        <div className="flex-1" />

        <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20">
          <Download className="size-4 mr-2" />
          Export Excel
        </Button>
        <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20">
          <Printer className="size-4 mr-2" />
          พิมพ์
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <DollarSign className="size-3" />
            ยอดแทงรวม
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {totals.totalBets.toLocaleString()}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            {totals.winLoss >= 0 ? <TrendingUp className="size-3 text-emerald-400" /> : <TrendingDown className="size-3 text-red-400" />}
            กำไร/ขาดทุน
          </div>
          <div className={cn(
            "text-2xl font-bold font-mono",
            totals.winLoss >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {totals.winLoss >= 0 ? '+' : ''}{totals.winLoss.toLocaleString()}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <AlertTriangle className="size-3 text-orange-400" />
            ยอดค้างชำระ
          </div>
          <div className="text-2xl font-bold text-orange-400 font-mono">
            {totals.outstanding.toLocaleString()}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Clock className="size-3 text-purple-400" />
            รอเคลียร์
          </div>
          <div className="text-2xl font-bold text-purple-400 font-mono">
            {totals.pendingClear.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="rounded-xl overflow-hidden border border-amber-500/20">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 p-4 bg-black/60 text-xs font-bold text-slate-400 border-b border-amber-500/20">
          <div className="col-span-2">เอเย่นต์</div>
          <div className="col-span-1 text-right">ยอดแทง</div>
          <div className="col-span-1 text-right">จ่ายออก</div>
          <div className="col-span-1 text-right">แพ้/ชนะ</div>
          <div className="col-span-1 text-right">คอม %</div>
          <div className="col-span-1 text-right">คอมฯ</div>
          <div className="col-span-1 text-right">PT</div>
          <div className="col-span-1 text-right">ผลสุทธิ</div>
          <div className="col-span-1 text-right">ค้างชำระ</div>
          <div className="col-span-2 text-center">สถานะ</div>
        </div>

        {/* Table Body */}
        {filteredReports.map((report) => {
          const levelConfig = getLevelConfig(report.level);
          const LevelIcon = levelConfig.icon;

          return (
            <div 
              key={report.id}
              className="grid grid-cols-12 gap-2 p-4 items-center bg-black/40 hover:bg-black/50 transition-colors border-b border-white/5 last:border-b-0"
            >
              {/* Agent Info */}
              <div className="col-span-2 flex items-center gap-2">
                <div className={cn(
                  "size-8 rounded-full flex items-center justify-center border flex-shrink-0",
                  levelConfig.bg,
                  levelConfig.border
                )}>
                  <LevelIcon className={cn("size-4", levelConfig.color)} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm truncate">{report.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {report.parentName || 'ระดับสูงสุด'}
                  </div>
                </div>
              </div>

              {/* Total Bets */}
              <div className="col-span-1 text-right">
                <div className="text-sm font-mono text-white">
                  {report.totalBets.toLocaleString()}
                </div>
              </div>

              {/* Total Payout */}
              <div className="col-span-1 text-right">
                <div className="text-sm font-mono text-slate-400">
                  {report.totalPayout.toLocaleString()}
                </div>
              </div>

              {/* Win/Loss */}
              <div className="col-span-1 text-right">
                <div className={cn(
                  "text-sm font-mono font-bold",
                  report.winLoss >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {report.winLoss >= 0 ? '+' : ''}{report.winLoss.toLocaleString()}
                </div>
              </div>

              {/* Commission % */}
              <div className="col-span-1 text-right">
                <div className="text-sm font-mono text-amber-400">
                  {report.commission}%
                </div>
              </div>

              {/* Commission Amount */}
              <div className="col-span-1 text-right">
                <div className="text-sm font-mono text-amber-400">
                  {report.commissionAmount.toLocaleString()}
                </div>
              </div>

              {/* PT Amount */}
              <div className="col-span-1 text-right">
                <div className={cn(
                  "text-sm font-mono",
                  report.ptAmount >= 0 ? "text-purple-400" : "text-red-400"
                )}>
                  {report.ptAmount >= 0 ? '+' : ''}{report.ptAmount.toLocaleString()}
                </div>
              </div>

              {/* Net Result */}
              <div className="col-span-1 text-right">
                <div className={cn(
                  "text-sm font-mono font-bold",
                  report.netResult >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {report.netResult >= 0 ? '+' : ''}{report.netResult.toLocaleString()}
                </div>
              </div>

              {/* Outstanding */}
              <div className="col-span-1 text-right">
                <div className={cn(
                  "text-sm font-mono font-bold",
                  report.outstanding > 0 ? "text-orange-400" : "text-slate-500"
                )}>
                  {report.outstanding.toLocaleString()}
                </div>
              </div>

              {/* Clear Status */}
              <div className="col-span-2 flex justify-center gap-2">
                {report.pendingClear > 0 ? (
                  <>
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/40 text-[10px]">
                      <Clock className="size-3 mr-1" />
                      รอเคลียร์ {report.pendingClear.toLocaleString()}
                    </Badge>
                    <Button
                      size="sm"
                      className="h-6 text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40"
                    >
                      <CheckCircle className="size-3 mr-1" />
                      เคลียร์
                    </Button>
                  </>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                    <CheckCircle className="size-3 mr-1" />
                    เคลียร์แล้ว
                  </Badge>
                )}
              </div>
            </div>
          );
        })}

        {/* Totals Row */}
        <div className="grid grid-cols-12 gap-2 p-4 items-center bg-amber-500/10 border-t-2 border-amber-500/30">
          <div className="col-span-2 font-bold text-amber-400">
            รวมทั้งหมด
          </div>
          <div className="col-span-1 text-right">
            <div className="text-sm font-mono font-bold text-white">
              {totals.totalBets.toLocaleString()}
            </div>
          </div>
          <div className="col-span-1 text-right">
            <div className="text-sm font-mono text-slate-400">
              {totals.totalPayout.toLocaleString()}
            </div>
          </div>
          <div className="col-span-1 text-right">
            <div className={cn(
              "text-sm font-mono font-bold",
              totals.winLoss >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {totals.winLoss >= 0 ? '+' : ''}{totals.winLoss.toLocaleString()}
            </div>
          </div>
          <div className="col-span-1 text-right">
            <div className="text-sm text-slate-500">-</div>
          </div>
          <div className="col-span-1 text-right">
            <div className="text-sm font-mono font-bold text-amber-400">
              {totals.commissionAmount.toLocaleString()}
            </div>
          </div>
          <div className="col-span-1 text-right">
            <div className={cn(
              "text-sm font-mono font-bold",
              totals.ptAmount >= 0 ? "text-purple-400" : "text-red-400"
            )}>
              {totals.ptAmount >= 0 ? '+' : ''}{totals.ptAmount.toLocaleString()}
            </div>
          </div>
          <div className="col-span-1 text-right">
            <div className={cn(
              "text-sm font-mono font-bold",
              totals.netResult >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {totals.netResult >= 0 ? '+' : ''}{totals.netResult.toLocaleString()}
            </div>
          </div>
          <div className="col-span-1 text-right">
            <div className="text-sm font-mono font-bold text-orange-400">
              {totals.outstanding.toLocaleString()}
            </div>
          </div>
          <div className="col-span-2 text-center">
            <div className="text-sm font-mono font-bold text-purple-400">
              รอ {totals.pendingClear.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 rounded-xl bg-black/40 border border-amber-500/20">
        <h3 className="text-sm font-bold text-amber-400 mb-3">คำอธิบาย</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">แพ้/ชนะ</span>
              <span className="text-slate-400">= ยอดแทง - จ่ายออก (บวก = เว็บชนะ)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">คอมฯ</span>
              <span className="text-slate-400">= ค่าคอมมิชชันที่เอเย่นต์ได้รับ</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-bold">PT</span>
              <span className="text-slate-400">= กำไร/ขาดทุนจากการถือสู้</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">ผลสุทธิ</span>
              <span className="text-slate-400">= แพ้/ชนะ + คอมฯ + PT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
