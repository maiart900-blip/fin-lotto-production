'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  CreditCard, 
  Plus, 
  Minus, 
  Search, 
  History,
  CheckCircle2,
  Users,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  Settings,
  Ban,
  PlayCircle,
  Percent,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAgentDownline } from '@/hooks/use-agent-downline';

interface Agent {
  id: string;
  name: string;
  phone: string;
  credit_balance: number;
  outstanding_balance: number;
  commission_rate: number;
  agent_level: string;
  is_active: boolean;
  upline_id: string | null;
  updated_at: string;
}

interface CreditTransaction {
  id: string;
  customer_id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  note: string;
  created_at: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return { agents: [], summary: {} };
  return res.json();
};

const LEVEL_LABELS: Record<string, string> = {
  senior_agent: 'ซีเนียร์',
  master_agent: 'มาสเตอร์',
  agent: 'เอเย่นต์',
  member: 'สมาชิก',
};

export default function AgentCreditManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Dialog states
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showClearDebtDialog, setShowClearDebtDialog] = useState(false);
  
  // Settings form
  const [editCommission, setEditCommission] = useState('');
  const [clearDebtAmount, setClearDebtAmount] = useState('');
  const [clearDebtNote, setClearDebtNote] = useState('');

  // Fetch agents from database
  const { data, mutate, isLoading } = useSWR('/api/admin/agents', fetcher, {
    refreshInterval: 10000,
  });

  const agents: Agent[] = data?.agents || [];
  const summary = data?.summary || {};

  // Fetch transactions for selected agent
  const { data: historyData } = useSWR(
    selectedAgent ? `/api/agents/credit/transfer?agentId=${selectedAgent.id}` : null,
    fetcher
  );
  const agentTransactions: CreditTransaction[] = historyData?.transactions || [];

  // Fetch downline stats for selected agent (realtime)
  const {
    totalDownlines,
    totalTurnover,
    totalProfit,
    profitMargin,
    downlines: downlineList,
  } = useAgentDownline(selectedAgent?.id || null, 'today');

  const filteredAgents = agents.filter(agent => 
    agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    agent.id?.includes(searchTerm) || 
    agent.phone?.includes(searchTerm)
  );

  const showSuccessToast = (message: string) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleCreditAction = async (type: 'add' | 'deduct') => {
    if (!selectedAgent || !creditAmount) {
      toast.error('กรุณาระบุจำนวนเงิน');
      return;
    }
    
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('จำนวนเงินไม่ถูกต้อง');
      return;
    }
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/agents/credit/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          type,
          amount,
          note: creditNote || (type === 'add' ? 'เติมวงเงิน' : 'ตัดวงเงิน'),
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }
      
      // Update selected agent locally
      setSelectedAgent(prev => prev ? {
        ...prev,
        credit_balance: result.data.newBalance,
      } : null);
      
      mutate(); // Refresh agents list
      setCreditAmount('');
      setCreditNote('');
      toast.success(type === 'add' ? 'เติมวงเงินสำเร็จ' : 'ตัดวงเงินสำเร็จ');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusChange = async (agent: Agent, newStatus: boolean) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/customers/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      
      mutate();
      toast.success(newStatus ? 'เปิดใช้งานแล้ว' : 'ระงับการใช้งานแล้ว');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSettingsSave = async () => {
    if (!selectedAgent) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedAgent.id,
          commission_rate: parseFloat(editCommission) || 0,
        }),
      });
      
      if (!res.ok) {
        throw new Error('Failed to update');
      }
      
      mutate();
      setShowSettingsDialog(false);
      setEditCommission('');
      toast.success('บันทึกการตั้งค่าสำเร็จ');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearDebt = async () => {
    if (!selectedAgent || !clearDebtAmount) return;
    
    const amount = parseFloat(clearDebtAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('จำนวนเงินไม่ถูกต้อง');
      return;
    }
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/agents/credit/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          type: 'clear_debt',
          amount,
          note: clearDebtNote || 'ล้างยอดค้างชำระ - รับเงินสดแล้ว',
        }),
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาด');
      }
      
      // Update selected agent locally
      setSelectedAgent(prev => prev ? {
        ...prev,
        outstanding_balance: result.data.newBalance,
      } : null);
      
      mutate();
      setShowClearDebtDialog(false);
      setClearDebtAmount('');
      setClearDebtNote('');
      toast.success('ล้างยอดค้างชำระสำเร็จ');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsProcessing(false);
    }
  };

  const openSettings = (agent: Agent) => {
    setSelectedAgent(agent);
    setEditCommission((agent.commission_rate || 0).toString());
    setShowSettingsDialog(true);
  };

  const openClearDebt = (agent: Agent) => {
    setSelectedAgent(agent);
    setClearDebtAmount((agent.outstanding_balance || 0).toString());
    setShowClearDebtDialog(true);
  };

  const openHistory = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowHistoryDialog(true);
  };

  // Calculate totals
  const totals = {
    totalCredit: agents.reduce((acc, agent) => acc + (agent.credit_balance || 0), 0),
    totalOutstanding: agents.reduce((acc, agent) => acc + (agent.outstanding_balance || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 backdrop-blur-xl">
            <CheckCircle2 className="size-5 text-emerald-400" />
            <span className="text-emerald-300 font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            จัดการวงเงินเครดิตเอเย่นต์
          </h1>
          <p className="text-slate-400 text-sm mt-1">เติม/ตัด วงเงิน | ตั้งค่าคอม | ระงับ/เปิดใช้งาน | ล้างยอดค้างชำระ</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => mutate()}
            className="border-slate-600"
          >
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-sm px-4 py-2">
            Super Admin Mode
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Users className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">เอเย่นต์ทั้งหมด</p>
                <p className="text-xl font-bold text-white">{summary.total || agents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <CreditCard className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">เครดิตรวม</p>
                <p className="text-xl font-bold text-blue-400">{totals.totalCredit.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="size-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">คอมมิชชั่นรวม</p>
                <p className="text-xl font-bold text-emerald-400">{Number(summary.totalCommission || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="size-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">คอมค้างจ่าย</p>
                <p className="text-xl font-bold text-red-400">{Number(summary.pendingCommission || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent List */}
        <div className="lg:col-span-2">
          <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">รายชื่อเอเย่นต์</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                  <Input
                    type="text"
                    placeholder="ค้นหาเอเย่นต์..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-64 bg-black/30 border-slate-700"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAgents.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="size-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีสายงาน</p>
                  <p className="text-sm">ไปที่หน้า &quot;สายงานเอเย่นต์&quot; เพื่อเพิ่มสายงาน</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredAgents.map(agent => {
                    const isSelected = selectedAgent?.id === agent.id;
                    
                    return (
                      <div
                        key={agent.id}
                        className={cn(
                          "p-4 rounded-xl border transition-all cursor-pointer",
                          isSelected 
                            ? "bg-amber-500/10 border-amber-500/50" 
                            : "bg-black/30 border-slate-700/50 hover:border-slate-600"
                        )}
                        onClick={() => setSelectedAgent(agent)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{agent.name || agent.phone}</span>
                              <Badge 
                                className={cn(
                                  "text-xs",
                                  agent.is_active 
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    : "bg-red-500/20 text-red-400 border-red-500/30"
                                )}
                              >
                                {agent.is_active ? 'ใช้งาน' : 'ระงับ'}
                              </Badge>
                              <Badge className="text-xs bg-slate-700/50 text-slate-300">
                                {LEVEL_LABELS[agent.agent_level] || agent.agent_level}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">{agent.phone}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                              <span>คอม: {agent.commission_rate || 0}%</span>
                            </div>
                          </div>
                          
                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); openSettings(agent); }}
                              className="size-8 p-0 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                              title="ตั้งค่าคอม"
                            >
                              <Settings className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); openHistory(agent); }}
                              className="size-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                              title="ดูประวัติ"
                            >
                              <History className="size-4" />
                            </Button>
                            {agent.is_active ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(agent, false); }}
                                className="size-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                title="ระงับการใช้งาน"
                              >
                                <Ban className="size-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(agent, true); }}
                                className="size-8 p-0 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                                title="เปิดใช้งาน"
                              >
                                <PlayCircle className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Credit Info */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-500">เครดิตคงเหลือ</p>
                            <p className="text-lg font-bold text-amber-400">{(agent.credit_balance || 0).toLocaleString()}</p>
                          </div>
                          {(agent.outstanding_balance || 0) > 0 && (
                            <div className="text-right">
                              <p className="text-xs text-slate-500">ยอดค้างชำระ</p>
                              <p className="text-lg font-bold text-red-400">{(agent.outstanding_balance || 0).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Clear Debt Button */}
                        {(agent.outstanding_balance || 0) > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); openClearDebt(agent); }}
                            className="w-full mt-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            <Wallet className="size-4 mr-2" />
                            ล้างยอดค้างชำระ
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Credit Action Panel */}
        <div>
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg text-amber-400 flex items-center gap-2">
                <CreditCard className="size-5" />
                จัดการวงเงิน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedAgent ? (
                <>
                  {/* Selected Agent Info */}
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-sm text-slate-400">เอเย่นต์ที่เลือก</p>
                    <p className="font-bold text-white">{selectedAgent.name || selectedAgent.phone}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">เครดิตปัจจุบัน</span>
                      <span className="font-bold text-amber-400">{(selectedAgent.credit_balance || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {/* Amount Input */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">จำนวนเงิน</Label>
                    <Input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="ระบุจำนวนเงิน..."
                      className="bg-black/30 border-slate-700"
                    />
                  </div>
                  
                  {/* Note Input */}
                  <div className="space-y-2">
                    <Label className="text-slate-300">หมายเหตุ (ไม่บังคับ)</Label>
                    <Textarea
                      value={creditNote}
                      onChange={(e) => setCreditNote(e.target.value)}
                      placeholder="ระบุหมายเหตุ..."
                      className="bg-black/30 border-slate-700 min-h-[60px]"
                    />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleCreditAction('add')}
                      disabled={isProcessing || !creditAmount}
                      className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                    >
                      {isProcessing ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="size-4 mr-2" />
                      )}
                      เติมวงเงิน
                    </Button>
                    <Button
                      onClick={() => handleCreditAction('deduct')}
                      disabled={isProcessing || !creditAmount}
                      className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    >
                      {isProcessing ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Minus className="size-4 mr-2" />
                      )}
                      ตัดวงเงิน
                    </Button>
                  </div>

                  {/* Downline Stats - Real-time */}
                  {totalDownlines > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <p className="text-sm text-blue-400 font-medium mb-2">สถิติลูกทีมวันนี้ (Real-time)</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">จำนวนลูกทีม</span>
                          <span className="text-white font-medium">{totalDownlines} คน</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">ยอดเทิร์นโอเวอร์</span>
                          <span className="text-emerald-400 font-medium">฿{totalTurnover.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">กำไร/ขาดทุน</span>
                          <span className={cn(
                            "font-medium",
                            totalProfit >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
                            {totalProfit >= 0 ? '+' : ''}฿{totalProfit.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">อัตรากำไร</span>
                          <span className="text-amber-400 font-medium">{profitMargin.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <CreditCard className="size-12 mx-auto mb-4 opacity-50" />
                  <p>เลือกเอเย่นต์จากรายชื่อ</p>
                  <p className="text-sm">เพื่อจัดการวงเงิน</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="bg-[#0a0a0a] border-amber-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Percent className="size-5" />
              ตั้งค่าคอมมิชชั่น - {selectedAgent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">คอมมิชชั่น (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={editCommission}
                onChange={(e) => setEditCommission(e.target.value)}
                className="bg-black/30 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)} className="border-slate-600">
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSettingsSave} 
              disabled={isProcessing}
              className="bg-amber-500/20 text-amber-400 border border-amber-500/30"
            >
              {isProcessing ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="bg-[#0a0a0a] border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-blue-400 flex items-center gap-2">
              <History className="size-5" />
              ประวัติเครดิต - {selectedAgent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {agentTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <History className="size-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีประวัติ</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agentTransactions.map((txn) => (
                  <div key={txn.id} className="p-3 rounded-lg bg-black/30 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <Badge 
                        className={cn(
                          "text-xs",
                          txn.type?.includes('add') 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-red-500/20 text-red-400"
                        )}
                      >
                        {txn.type?.includes('add') ? 'เติม' : txn.type?.includes('deduct') ? 'ตัด' : 'ล้างหนี้'}
                      </Badge>
                      <span className={cn(
                        "font-bold",
                        txn.type?.includes('add') ? "text-emerald-400" : "text-red-400"
                      )}>
                        {txn.type?.includes('add') ? '+' : '-'}{(txn.amount || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>{txn.balance_before?.toLocaleString()} → {txn.balance_after?.toLocaleString()}</span>
                      <span>{txn.created_at ? new Date(txn.created_at).toLocaleString('th-TH') : '-'}</span>
                    </div>
                    {txn.note && <p className="text-xs text-slate-400 mt-1">{txn.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Debt Dialog */}
      <Dialog open={showClearDebtDialog} onOpenChange={setShowClearDebtDialog}>
        <DialogContent className="bg-[#0a0a0a] border-red-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Wallet className="size-5" />
              ล้างยอดค้างชำระ - {selectedAgent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-slate-400">ยอดค้างชำระปัจจุบัน</p>
              <p className="text-2xl font-bold text-red-400">{(selectedAgent?.outstanding_balance || 0).toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">จำนวนที่ต้องการล้าง</Label>
              <Input
                type="number"
                value={clearDebtAmount}
                onChange={(e) => setClearDebtAmount(e.target.value)}
                className="bg-black/30 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">หมายเหตุ</Label>
              <Textarea
                value={clearDebtNote}
                onChange={(e) => setClearDebtNote(e.target.value)}
                placeholder="เช่น รับเงินสดแล้ว, โอนมาแล้ว..."
                className="bg-black/30 border-slate-700 min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowClearDebtDialog(false)} className="border-slate-600">
              ยกเลิก
            </Button>
            <Button 
              onClick={handleClearDebt} 
              disabled={isProcessing || !clearDebtAmount}
              className="bg-red-500/20 text-red-400 border border-red-500/30"
            >
              {isProcessing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Wallet className="size-4 mr-2" />}
              ล้างยอดค้างชำระ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
