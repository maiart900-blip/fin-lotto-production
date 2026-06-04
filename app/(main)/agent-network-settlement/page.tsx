'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { RouteGuard } from '@/components/security/route-guard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Network,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calculator,
  Download,
  RefreshCw,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  Percent,
  CreditCard,
  Wallet,
  Search,
  Filter,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface AgentSettlement {
  agentId: string;
  agentCode: string;
  agentName: string;
  level: 'master' | 'senior' | 'agent';
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  ptPercent: number; // Position Taking percentage
  commission: number;
  period: string;
  totalBets: number;
  totalWins: number;
  grossProfit: number; // totalBets - totalWins
  ptShare: number; // Agent's share from PT
  commissionAmount: number;
  netSettlement: number; // Amount to settle (positive = agent pays, negative = agent receives)
  memberCount: number;
  downlineCount: number;
  status: 'pending' | 'settled' | 'disputed';
  settledAt?: string;
}

export default function AgentNetworkSettlementPage() {
  const currentWeek = getWeekRange(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState(currentWeek);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentSettlement | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  // Fetch agent settlements
  const { data, error, isLoading, mutate } = useSWR<{
    agents: AgentSettlement[];
    summary: {
      totalAgents: number;
      totalBets: number;
      totalWins: number;
      totalGrossProfit: number;
      totalPTShare: number;
      totalCommission: number;
      netPlatformProfit: number;
      pendingSettlements: number;
    };
    period: string;
  }>(`/api/agent-network/settlement?period=${selectedPeriod}`, fetcher);

  const agents = data?.agents || [];
  const summary = data?.summary || {
    totalAgents: 0,
    totalBets: 0,
    totalWins: 0,
    totalGrossProfit: 0,
    totalPTShare: 0,
    totalCommission: 0,
    netPlatformProfit: 0,
    pendingSettlements: 0,
  };

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    if (searchQuery && !agent.agentName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !agent.agentCode.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (levelFilter !== 'all' && agent.level !== levelFilter) {
      return false;
    }
    return true;
  });

  const formatMoney = (amount: number) => {
    if (Math.abs(amount) >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M`;
    }
    return amount.toLocaleString();
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'master':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Master</Badge>;
      case 'senior':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Senior</Badge>;
      case 'agent':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Agent</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-orange-500/20 text-orange-400"><Clock className="size-3 mr-1" />รอเคลียร์</Badge>;
      case 'settled':
        return <Badge className="bg-emerald-500/20 text-emerald-400"><Check className="size-3 mr-1" />เคลียร์แล้ว</Badge>;
      case 'disputed':
        return <Badge className="bg-red-500/20 text-red-400"><AlertCircle className="size-3 mr-1" />มีข้อโต้แย้ง</Badge>;
      default:
        return null;
    }
  };

  const handleSettle = async () => {
    if (!selectedAgent) return;
    
    setIsSettling(true);
    try {
      const res = await fetch('/api/agent-network/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.agentId,
          period: selectedAgent.period,
          amount: selectedAgent.netSettlement,
          action: 'settle',
        }),
      });

      if (!res.ok) throw new Error('Settlement failed');

      toast.success(`เคลียร์ยอด ${selectedAgent.agentName} สำเร็จ`);
      setShowSettleDialog(false);
      setSelectedAgent(null);
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเคลียร์ยอด');
    } finally {
      setIsSettling(false);
    }
  };

  // Generate period options (last 8 weeks)
  const periodOptions = Array.from({ length: 8 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (i * 7));
    const weekRange = getWeekRange(date);
    const label = getWeekLabel(date);
    return { value: weekRange, label };
  });

  if (error) {
    return (
      <RouteGuard requireSuperAdmin>
        <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 flex items-center justify-center">
          <Card className="bg-red-500/10 border-red-500/30 p-6 text-center">
            <AlertCircle className="size-12 mx-auto text-red-400 mb-4" />
            <p className="text-red-400">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            <Button onClick={() => mutate()} className="mt-4">ลองใหม่</Button>
          </Card>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard requireSuperAdmin>
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
              style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
            >
              Agent Network Settlement
            </h1>
            <p className="text-slate-400 mt-1">สรุปยอดได้-เสีย และเคลียร์ยอดแยกตามเอเย่นต์</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[200px] bg-black/40 border-slate-700">
                <SelectValue placeholder="เลือกงวด" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              className="border-slate-600"
              onClick={() => mutate()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("size-4 mr-2", isLoading && "animate-spin")} />
              รีเฟรช
            </Button>
            
            <Button variant="outline" className="border-amber-500/30 text-amber-400">
              <Download className="size-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                  <Network className="size-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">เอเย่นต์</p>
                  <p className="text-xl font-bold text-amber-300">{summary.totalAgents}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                  <TrendingUp className="size-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">ยอดแทงรวม</p>
                  <p className="text-lg font-bold text-blue-400">{formatMoney(summary.totalBets)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center">
                  <TrendingDown className="size-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">ยอดถูกรางวัล</p>
                  <p className="text-lg font-bold text-red-400">{formatMoney(summary.totalWins)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                  <DollarSign className="size-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">กำไรขั้นต้น</p>
                  <p className={cn(
                    "text-lg font-bold",
                    summary.totalGrossProfit >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {formatMoney(summary.totalGrossProfit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                  <Percent className="size-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">ส่วนแบ่ง PT</p>
                  <p className="text-lg font-bold text-purple-400">{formatMoney(summary.totalPTShare)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center">
                  <Calculator className="size-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">ค่าคอม</p>
                  <p className="text-lg font-bold text-cyan-400">{formatMoney(summary.totalCommission)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                  <Wallet className="size-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">กำไรสุทธิ</p>
                  <p className={cn(
                    "text-lg font-bold",
                    summary.netPlatformProfit >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {formatMoney(summary.netPlatformProfit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PT Explanation Card */}
        <Card className="bg-black/40 backdrop-blur-xl border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-purple-300 flex items-center gap-2">
              <Percent className="size-5" />
              Position Taking (PT) - ระบบแบ่งสัดส่วนได้เสีย
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <p className="font-medium text-purple-300 mb-2">PT คืออะไร?</p>
                <p className="text-slate-400">
                  Position Taking คือการแบ่งสัดส่วนความเสี่ยง (ได้-เสีย) ระหว่างเอเย่นต์กับเว็บแม่
                  เช่น PT 30% หมายความว่าเอเย่นต์รับภาระ 30% ของผลได้-เสีย
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <p className="font-medium text-emerald-300 mb-2">ตัวอย่าง: กำไร 100,000</p>
                <p className="text-slate-400">
                  ถ้ากำไร 100,000 บาท และ PT = 30%<br/>
                  เอเย่นต์ได้รับ: 30,000 บาท<br/>
                  เว็บแม่ได้รับ: 70,000 บาท
                </p>
              </div>
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <p className="font-medium text-red-300 mb-2">ตัวอย่าง: ขาดทุน 100,000</p>
                <p className="text-slate-400">
                  ถ้าขาดทุน 100,000 บาท และ PT = 30%<br/>
                  เอเย่นต์รับภาระ: 30,000 บาท<br/>
                  เว็บแม่รับภาระ: 70,000 บาท
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <Input
              placeholder="ค้นหาชื่อหรือรหัสเอเย่นต์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-black/40 border-slate-700"
            />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[150px] bg-black/40 border-slate-700">
              <Filter className="size-4 mr-2" />
              <SelectValue placeholder="ระดับ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับ</SelectItem>
              <SelectItem value="master">Master</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Agent Settlement Table */}
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-300 flex items-center gap-2">
                <Network className="size-5" />
                รายละเอียดยอดเคลียร์แต่ละเอเย่นต์
              </CardTitle>
              <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                รอเคลียร์: {summary.pendingSettlements}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">เอเย่นต์</TableHead>
                    <TableHead className="text-slate-400">ระดับ</TableHead>
                    <TableHead className="text-slate-400 text-right">วงเงิน</TableHead>
                    <TableHead className="text-slate-400 text-right">PT%</TableHead>
                    <TableHead className="text-slate-400 text-right">ยอดแทง</TableHead>
                    <TableHead className="text-slate-400 text-right">ยอดถูก</TableHead>
                    <TableHead className="text-slate-400 text-right">กำไร/ขาดทุน</TableHead>
                    <TableHead className="text-slate-400 text-right">ส่วนแบ่ง PT</TableHead>
                    <TableHead className="text-slate-400 text-right">ค่าคอม</TableHead>
                    <TableHead className="text-slate-400 text-right">ยอดเคลียร์</TableHead>
                    <TableHead className="text-slate-400 text-center">สถานะ</TableHead>
                    <TableHead className="text-slate-400 text-center">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-slate-500 py-8">
                        {isLoading ? 'กำลังโหลด...' : 'ไม่พบข้อมูลเอเย่นต์'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAgents.map((agent) => (
                      <TableRow key={agent.agentId} className="border-slate-700/50 hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                              <Users className="size-5 text-amber-400" />
                            </div>
                            <div>
                              <p className="font-medium text-white">{agent.agentName}</p>
                              <p className="text-xs text-slate-500">{agent.agentCode}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getLevelBadge(agent.level)}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            <span className="font-mono text-slate-300">{formatMoney(agent.creditLimit)}</span>
                            <div className="text-xs text-slate-500">
                              ใช้ไป: {formatMoney(agent.creditUsed)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-purple-400">
                          {agent.ptPercent}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-400">
                          {formatMoney(agent.totalBets)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-400">
                          {formatMoney(agent.totalWins)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono font-bold",
                          agent.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {agent.grossProfit >= 0 ? '+' : ''}{formatMoney(agent.grossProfit)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono",
                          agent.ptShare >= 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {agent.ptShare >= 0 ? '+' : ''}{formatMoney(agent.ptShare)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-cyan-400">
                          +{formatMoney(agent.commissionAmount)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono font-bold",
                          agent.netSettlement > 0 ? "text-emerald-400" : agent.netSettlement < 0 ? "text-red-400" : "text-slate-400"
                        )}>
                          {agent.netSettlement > 0 ? '+' : ''}{formatMoney(agent.netSettlement)}
                          <div className="text-xs text-slate-500">
                            {agent.netSettlement > 0 ? '(รับเงิน)' : agent.netSettlement < 0 ? '(จ่ายเงิน)' : '(สมดุล)'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(agent.status)}
                        </TableCell>
                        <TableCell className="text-center">
                          {agent.status === 'settled' ? (
                            <Button size="sm" variant="outline" className="border-slate-600">
                              <FileText className="size-4 mr-1" />
                              ดูใบเสร็จ
                            </Button>
                          ) : agent.netSettlement !== 0 ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedAgent(agent);
                                setShowSettleDialog(true);
                              }}
                              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
                            >
                              <Check className="size-4 mr-1" />
                              เคลียร์
                            </Button>
                          ) : (
                            <span className="text-slate-500 text-sm">ไม่มียอด</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Settlement Dialog */}
        <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
          <DialogContent className="bg-[#0a0f1a] border-amber-500/30 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-amber-300 flex items-center gap-2">
                <CreditCard className="size-5" />
                ยืนยันการเคลียร์ยอด
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                กรุณาตรวจสอบรายละเอียดก่อนทำการเคลียร์ยอด
              </DialogDescription>
            </DialogHeader>
            
            {selectedAgent && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-black/40 border border-slate-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                      <Users className="size-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">{selectedAgent.agentName}</p>
                      <p className="text-sm text-slate-400">{selectedAgent.agentCode} | PT: {selectedAgent.ptPercent}%</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-700">
                      <span className="text-slate-400">ยอดแทงรวม</span>
                      <span className="font-mono text-blue-400">{formatMoney(selectedAgent.totalBets)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-700">
                      <span className="text-slate-400">ยอดถูกรางวัล</span>
                      <span className="font-mono text-red-400">{formatMoney(selectedAgent.totalWins)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-700">
                      <span className="text-slate-400">กำไร/ขาดทุน</span>
                      <span className={cn(
                        "font-mono font-bold",
                        selectedAgent.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {selectedAgent.grossProfit >= 0 ? '+' : ''}{formatMoney(selectedAgent.grossProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-700">
                      <span className="text-slate-400">ส่วนแบ่ง PT ({selectedAgent.ptPercent}%)</span>
                      <span className={cn(
                        "font-mono",
                        selectedAgent.ptShare >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {selectedAgent.ptShare >= 0 ? '+' : ''}{formatMoney(selectedAgent.ptShare)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-700">
                      <span className="text-slate-400">ค่าคอมมิชชั่น</span>
                      <span className="font-mono text-cyan-400">+{formatMoney(selectedAgent.commissionAmount)}</span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "p-4 rounded-xl border text-center",
                  selectedAgent.netSettlement > 0 
                    ? "bg-emerald-500/10 border-emerald-500/30" 
                    : "bg-red-500/10 border-red-500/30"
                )}>
                  <p className="text-sm text-slate-400 mb-1">
                    {selectedAgent.netSettlement > 0 ? 'เอเย่นต์รับเงิน' : 'เอเย่นต์จ่ายเงิน'}
                  </p>
                  <p className={cn(
                    "text-3xl font-bold",
                    selectedAgent.netSettlement > 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {Math.abs(selectedAgent.netSettlement).toLocaleString()} บาท
                  </p>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettleDialog(false)}>
                ยกเลิก
              </Button>
              <Button 
                onClick={handleSettle}
                disabled={isSettling}
                className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
              >
                {isSettling ? 'กำลังเคลียร์...' : 'ยืนยันเคลียร์ยอด'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RouteGuard>
  );
}

// Helper functions
function getWeekRange(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return `${monday.toISOString().split('T')[0]}_${sunday.toISOString().split('T')[0]}`;
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const formatDate = (d: Date) => d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  return `${formatDate(monday)} - ${formatDate(sunday)}`;
}
