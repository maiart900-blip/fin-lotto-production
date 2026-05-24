'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  DollarSign,
  RefreshCw,
  Search,
  Plus,
  Minus,
  Ban,
  CheckCircle,
  AlertTriangle,
  Activity,
  Wallet,
  Clock,
  MoreVertical,
  Settings,
  Eye,
  Crown
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Agent {
  id: string;
  username: string;
  displayName: string;
  phone: string;
  status: string;
  isOnline: boolean;
  creditLimit: number;
  creditBalance: number;
  creditUsed: number;
  customerCount: number;
  todaySales: number;
  todayEntries: number;
  monthSales: number;
  commissionPercent: number;
  sharePercent: number;
  lastActivity: string | null;
  createdAt: string;
}

interface AgentSummary {
  totalAgents: number;
  activeAgents: number;
  suspendedAgents: number;
  totalCredit: number;
  totalCreditUsed: number;
  totalTodaySales: number;
  totalMonthSales: number;
  totalCustomers: number;
}

export default function AgentNetworkPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferType, setTransferType] = useState<'add' | 'deduct'>('add');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Real-time data fetching with SWR
  const { data, mutate, isLoading } = useSWR<{
    agents: Agent[];
    summary: AgentSummary;
    lastUpdated: string;
  }>('/api/master/agent-network', fetcher, {
    refreshInterval: 3000, // Real-time update every 3 seconds
    revalidateOnFocus: true,
  });

  const agents = data?.agents || [];
  const summary = data?.summary;

  // Filter agents by search
  const filteredAgents = agents.filter(agent =>
    agent.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.phone?.includes(searchTerm)
  );

  // Handle credit transfer
  const handleTransfer = async () => {
    if (!selectedAgent || !transferAmount) return;
    
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/master/agent-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: transferType === 'add' ? 'add_credit' : 'deduct_credit',
          agentId: selectedAgent.id,
          amount,
          note: transferNote,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(transferType === 'add' ? 'เติมเครดิตสำเร็จ' : 'ตัดเครดิตสำเร็จ');
        setIsTransferOpen(false);
        setTransferAmount('');
        setTransferNote('');
        mutate(); // Refresh data
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการดำเนินการ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle suspend/activate
  const handleToggleStatus = async (agent: Agent) => {
    const action = agent.status === 'active' ? 'suspend' : 'activate';
    
    try {
      const response = await fetch('/api/master/agent-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          agentId: agent.id,
          reason: action === 'suspend' ? 'ระงับโดย Master' : undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(action === 'suspend' ? 'ระงับเอเย่นต์สำเร็จ' : 'เปิดใช้งานเอเย่นต์สำเร็จ');
        mutate();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8FAFC] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#0F172A]">
            <Crown className="h-6 w-6 text-[#EAB308]" />
            Master Control - เครือข่ายลูกสาย
          </h1>
          <p className="text-[#64748B]">จัดการและควบคุมลูกสายทั้งหมดแบบ Real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#EAB308] text-[#EAB308]">
            <Activity className="h-3 w-3 mr-1 animate-pulse" />
            Live
          </Badge>
          <Button 
            variant="outline" 
            onClick={() => mutate()}
            className="border-[#EAB308] text-[#B8860B] hover:bg-[rgba(234,179,8,0.1)]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">ลูกสายทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-[#EAB308]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0F172A]">{summary?.totalAgents || 0}</div>
            <p className="text-xs text-[#64748B]">
              <span className="text-green-500">{summary?.activeAgents || 0} ใช้งาน</span>
              {' / '}
              <span className="text-red-500">{summary?.suspendedAgents || 0} ระงับ</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">เครดิตทั้งหมด</CardTitle>
            <Wallet className="h-4 w-4 text-[#EAB308]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0F172A]">{formatCurrency(summary?.totalCredit || 0)}</div>
            <p className="text-xs text-[#64748B]">
              ใช้ไป: <span className="text-orange-500">{formatCurrency(summary?.totalCreditUsed || 0)}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">ยอดขายวันนี้</CardTitle>
            <DollarSign className="h-4 w-4 text-[#EAB308]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0F172A]">{formatCurrency(summary?.totalTodaySales || 0)}</div>
            <p className="text-xs text-[#64748B]">จากลูกสายทั้งหมด</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#64748B]">ลูกค้าทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-[#EAB308]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0F172A]">{summary?.totalCustomers || 0}</div>
            <p className="text-xs text-[#64748B]">ในเครือข่าย</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <Input
            placeholder="ค้นหาลูกสาย..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-[#E2E8F0] focus:border-[#EAB308]"
          />
        </div>
      </div>

      {/* Agent Table */}
      <Card className="bg-white border-[rgba(234,179,8,0.2)]">
        <CardHeader>
          <CardTitle className="text-[#B8860B]">รายชื่อลูกสาย</CardTitle>
          <CardDescription>ข้อมูลอัปเดตอัตโนมัติทุก 3 วินาที</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(234,179,8,0.2)]">
                <TableHead className="text-[#64748B]">ลูกสาย</TableHead>
                <TableHead className="text-[#64748B]">สถานะ</TableHead>
                <TableHead className="text-[#64748B] text-right">เครดิต</TableHead>
                <TableHead className="text-[#64748B] text-right">ยอดวันนี้</TableHead>
                <TableHead className="text-[#64748B] text-right">ลูกค้า</TableHead>
                <TableHead className="text-[#64748B]">กิจกรรมล่าสุด</TableHead>
                <TableHead className="text-[#64748B] text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map((agent) => (
                <TableRow key={agent.id} className="border-[rgba(234,179,8,0.1)] hover:bg-[rgba(234,179,8,0.05)]">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                      <div>
                        <p className="font-medium text-[#0F172A]">{agent.displayName}</p>
                        <p className="text-xs text-[#64748B]">@{agent.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={agent.status === 'active' ? 'default' : 'destructive'}
                      className={agent.status === 'active' 
                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                        : ''
                      }
                    >
                      {agent.status === 'active' ? 'ใช้งาน' : 'ระงับ'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <p className="font-medium text-[#0F172A]">{formatCurrency(agent.creditBalance)}</p>
                      <p className="text-xs text-[#64748B]">/ {formatCurrency(agent.creditLimit)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>
                      <p className="font-medium text-[#0F172A]">{formatCurrency(agent.todaySales)}</p>
                      <p className="text-xs text-[#64748B]">{agent.todayEntries} รายการ</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-medium text-[#0F172A]">{agent.customerCount}</span>
                  </TableCell>
                  <TableCell>
                    {agent.lastActivity ? (
                      <div className="flex items-center gap-1 text-xs text-[#64748B]">
                        <Clock className="h-3 w-3" />
                        {new Date(agent.lastActivity).toLocaleTimeString('th-TH')}
                      </div>
                    ) : (
                      <span className="text-xs text-[#94A3B8]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-[#64748B] hover:text-[#EAB308]">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white border-[rgba(234,179,8,0.2)]">
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedAgent(agent);
                            setTransferType('add');
                            setIsTransferOpen(true);
                          }}
                          className="cursor-pointer"
                        >
                          <Plus className="h-4 w-4 mr-2 text-green-500" />
                          เติมเครดิต
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedAgent(agent);
                            setTransferType('deduct');
                            setIsTransferOpen(true);
                          }}
                          className="cursor-pointer"
                        >
                          <Minus className="h-4 w-4 mr-2 text-orange-500" />
                          ตัดเครดิต
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleToggleStatus(agent)}
                          className="cursor-pointer"
                        >
                          {agent.status === 'active' ? (
                            <>
                              <Ban className="h-4 w-4 mr-2 text-red-500" />
                              ระงับการใช้งาน
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                              เปิดใช้งาน
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                          <Eye className="h-4 w-4 mr-2" />
                          ดูรายละเอียด
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAgents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#64748B]">
                    {isLoading ? 'กำลังโหลด...' : 'ไม่พบข้อมูลลูกสาย'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Credit Transfer Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="bg-white border-[rgba(234,179,8,0.3)]">
          <DialogHeader>
            <DialogTitle className="text-[#B8860B]">
              {transferType === 'add' ? 'เติมเครดิต' : 'ตัดเครดิต'} - {selectedAgent?.displayName}
            </DialogTitle>
            <DialogDescription>
              เครดิตปัจจุบัน: {formatCurrency(selectedAgent?.creditBalance || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">จำนวนเงิน</label>
              <Input
                type="number"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="bg-white border-[#E2E8F0] focus:border-[#EAB308]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#0F172A]">หมายเหตุ (ไม่บังคับ)</label>
              <Input
                placeholder="ระบุหมายเหตุ..."
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="bg-white border-[#E2E8F0] focus:border-[#EAB308]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleTransfer}
              disabled={isProcessing}
              className={transferType === 'add' 
                ? 'premium-gold-btn' 
                : 'bg-gradient-to-b from-orange-500 to-orange-600 text-white'
              }
            >
              {isProcessing ? 'กำลังดำเนินการ...' : transferType === 'add' ? 'เติมเครดิต' : 'ตัดเครดิต'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
