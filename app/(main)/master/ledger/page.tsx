'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  ArrowDownCircle,
  ArrowUpCircle,
  DollarSign,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  Building2,
  Crown,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface LedgerEntry {
  id: string;
  transaction_type: string;
  amount: number;
  customer_id: string;
  agent_site_id?: string;
  transaction_ref?: string;
  reference_id?: string;
  performed_by: string;
  notes?: string;
  created_at: string;
  customers?: { username: string };
}

interface DailySummary {
  deposit: number;
  withdrawal: number;
  bet: number;
  payout: number;
  adjustment: number;
  total_transactions: number;
}

const TRANSACTION_TYPES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  deposit: { label: 'ฝากเงิน', color: 'bg-emerald-500', icon: <ArrowDownCircle className="size-4" /> },
  withdrawal: { label: 'ถอนเงิน', color: 'bg-red-500', icon: <ArrowUpCircle className="size-4" /> },
  bet: { label: 'แทง', color: 'bg-blue-500', icon: <TrendingDown className="size-4" /> },
  payout: { label: 'จ่ายรางวัล', color: 'bg-amber-500', icon: <TrendingUp className="size-4" /> },
  adjustment: { label: 'ปรับยอด', color: 'bg-purple-500', icon: <DollarSign className="size-4" /> },
};

export default function MasterLedgerPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [agentFilter, setAgentFilter] = useState<string>('all');
  
  // Fetch transactions
  const { data: transactionsData, mutate: mutateTransactions } = useSWR(
    '/api/financial/autopilot?type=recent_transactions&limit=100',
    fetcher,
    { refreshInterval: 10000 }
  );
  
  // Fetch daily summary
  const { data: summaryData } = useSWR(
    `/api/financial/autopilot?type=daily_summary&date=${dateFilter}`,
    fetcher,
    { refreshInterval: 30000 }
  );
  
  // Fetch pending counts
  const { data: pendingData } = useSWR(
    '/api/financial/autopilot?type=pending_count',
    fetcher,
    { refreshInterval: 10000 }
  );
  
  const transactions: LedgerEntry[] = transactionsData?.transactions || [];
  const summary: DailySummary = summaryData?.summary || {};
  
  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (typeFilter !== 'all' && tx.transaction_type !== typeFilter) return false;
    if (agentFilter !== 'all' && tx.agent_site_id !== agentFilter) return false;
    if (dateFilter) {
      const txDate = new Date(tx.created_at).toISOString().split('T')[0];
      if (txDate !== dateFilter) return false;
    }
    return true;
  });
  
  // Calculate totals
  const totalDeposits = Number(summary.deposit) || 0;
  const totalWithdrawals = Math.abs(Number(summary.withdrawal) || 0);
  const totalBets = Math.abs(Number(summary.bet) || 0);
  const totalPayouts = Number(summary.payout) || 0;
  const netFlow = totalDeposits - totalWithdrawals;
  
  const handleExportCSV = () => {
    const headers = ['เวลา', 'ประเภท', 'จำนวน', 'ลูกค้า', 'เว็บลูก', 'อ้างอิง', 'ผู้ทำรายการ'];
    const rows = filteredTransactions.map(tx => [
      new Date(tx.created_at).toLocaleString('th-TH'),
      TRANSACTION_TYPES[tx.transaction_type]?.label || tx.transaction_type,
      tx.amount.toLocaleString(),
      tx.customers?.username || tx.customer_id,
      tx.agent_site_id || '-',
      tx.transaction_ref || '-',
      tx.performed_by,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-ledger-${dateFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('ส่งออก CSV สำเร็จ');
  };
  
  return (
    <div className="live-midnight-canvas -m-6 p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.3)]">
              <BookOpen className="size-6 text-white" />
            </div>
            <span className="text-gold-gradient">Master Ledger</span>
          </h1>
          <p className="text-[#94A3B8] mt-1">ศูนย์กลางบัญชีการเงินเครือข่าย</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutateTransactions()}
            className="border-[#EAB308]/30 text-[#EAB308] hover:bg-[#EAB308]/10"
          >
            <RefreshCw className="size-4 mr-1" />
            รีเฟรช
          </Button>
          <Button
            size="sm"
            onClick={handleExportCSV}
            className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-white"
          >
            <Download className="size-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-6">
        <Card className="gold-stats-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดฝากวันนี้</p>
                <p className="text-2xl font-bold text-[#10B981] mt-1">
                  +{totalDeposits.toLocaleString()}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#10B981]/20">
                <ArrowDownCircle className="size-5 text-[#10B981]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="gold-stats-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดถอนวันนี้</p>
                <p className="text-2xl font-bold text-[#EF4444] mt-1">
                  -{totalWithdrawals.toLocaleString()}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#EF4444]/20">
                <ArrowUpCircle className="size-5 text-[#EF4444]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="gold-stats-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดแทงวันนี้</p>
                <p className="text-2xl font-bold text-[#3B82F6] mt-1">
                  {totalBets.toLocaleString()}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#3B82F6]/20">
                <TrendingDown className="size-5 text-[#3B82F6]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="gold-stats-card">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">ยอดจ่ายวันนี้</p>
                <p className="text-2xl font-bold text-[#F59E0B] mt-1">
                  {totalPayouts.toLocaleString()}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#F59E0B]/20">
                <TrendingUp className="size-5 text-[#F59E0B]" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`gold-stats-card ${netFlow >= 0 ? 'border-[#10B981]/30' : 'border-[#EF4444]/30'}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">Net Flow</p>
                <p className={`text-2xl font-bold mt-1 ${netFlow >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  {netFlow >= 0 ? '+' : ''}{netFlow.toLocaleString()}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${netFlow >= 0 ? 'bg-[#10B981]/20' : 'bg-[#EF4444]/20'}`}>
                <DollarSign className={`size-5 ${netFlow >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Pending Alerts */}
      {(pendingData?.pendingDeposits > 0 || pendingData?.pendingWithdrawals > 0) && (
        <Card className="mb-6 border-[#F59E0B]/30 bg-[#F59E0B]/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-[#F59E0B]" />
                <span className="text-[#F59E0B] font-medium">
                  รอดำเนินการ: {pendingData?.pendingDeposits || 0} ฝาก, {pendingData?.pendingWithdrawals || 0} ถอน
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/10"
                onClick={() => window.location.href = '/topup-requests'}
              >
                ดำเนินการ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Filters */}
      <Card className="gold-stats-card mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-[#94A3B8]" />
              <span className="text-sm text-[#94A3B8]">กรองข้อมูล:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-[#EAB308]" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-40 bg-[#0F172A] border-[#EAB308]/30 text-white"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-[#0F172A] border-[#EAB308]/30 text-white">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="deposit">ฝากเงิน</SelectItem>
                <SelectItem value="withdrawal">ถอนเงิน</SelectItem>
                <SelectItem value="bet">แทง</SelectItem>
                <SelectItem value="payout">จ่ายรางวัล</SelectItem>
                <SelectItem value="adjustment">ปรับยอด</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Transactions Table */}
      <Card className="gold-stats-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Crown className="size-5 text-[#EAB308]" />
            รายการธุรกรรม ({filteredTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#EAB308]/20">
                  <TableHead className="text-[#94A3B8]">เวลา</TableHead>
                  <TableHead className="text-[#94A3B8]">ประเภท</TableHead>
                  <TableHead className="text-[#94A3B8] text-right">จำนวน</TableHead>
                  <TableHead className="text-[#94A3B8]">ลูกค้า</TableHead>
                  <TableHead className="text-[#94A3B8]">อ้างอิง</TableHead>
                  <TableHead className="text-[#94A3B8]">ผู้ทำรายการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => {
                  const typeInfo = TRANSACTION_TYPES[tx.transaction_type] || {
                    label: tx.transaction_type,
                    color: 'bg-gray-500',
                    icon: null,
                  };
                  
                  return (
                    <TableRow key={tx.id} className="border-[#EAB308]/10 hover:bg-[#EAB308]/5">
                      <TableCell className="text-[#94A3B8] text-sm">
                        {new Date(tx.created_at).toLocaleString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${typeInfo.color} text-white gap-1`}>
                          {typeInfo.icon}
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${
                        tx.amount >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-white">
                        {tx.customers?.username || tx.customer_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-[#94A3B8] text-sm font-mono">
                        {tx.transaction_ref || '-'}
                      </TableCell>
                      <TableCell className="text-[#94A3B8] text-sm">
                        {tx.performed_by === 'system_auto' ? (
                          <Badge variant="outline" className="border-[#10B981]/30 text-[#10B981]">
                            <CheckCircle className="size-3 mr-1" />
                            Auto
                          </Badge>
                        ) : (
                          tx.performed_by
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[#94A3B8] py-8">
                      ไม่พบรายการธุรกรรม
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
