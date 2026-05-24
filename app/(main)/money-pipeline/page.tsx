'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { 
  CreditCard, 
  QrCode, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  Settings,
  Shield,
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Wallet,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Activity,
  Upload,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Types
interface Customer {
  id: string;
  name: string;
  phone: string;
  credit_balance: number;
}

interface DepositRequest {
  id: string;
  customer_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  slip_url?: string;
  bank_name?: string;
  transfer_time?: string;
  admin_note?: string;
  created_at: string;
  approved_at?: string;
  customer?: Customer;
}

interface WithdrawRequest {
  id: string;
  customer_id: string;
  amount: number;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  bank_name: string;
  account_number: string;
  account_name: string;
  admin_note?: string;
  slip_url?: string;
  created_at: string;
  approved_at?: string;
  customer?: Customer;
}

const THAI_BANKS = [
  { code: 'BBL', name: 'กรุงเทพ', color: '#1e3a8a' },
  { code: 'KBANK', name: 'กสิกรไทย', color: '#16a34a' },
  { code: 'KTB', name: 'กรุงไทย', color: '#0ea5e9' },
  { code: 'SCB', name: 'ไทยพาณิชย์', color: '#7c3aed' },
  { code: 'BAY', name: 'กรุงศรี', color: '#eab308' },
  { code: 'TMB', name: 'ทหารไทยธนชาต', color: '#f97316' },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function MoneyPipelinePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showApiKey, setShowApiKey] = useState(false);
  const [autoWithdrawEnabled, setAutoWithdrawEnabled] = useState(true);
  const [autoApproveLimit, setAutoApproveLimit] = useState('30000');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedWithdraw, setSelectedWithdraw] = useState<WithdrawRequest | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipDialogOpen, setSlipDialogOpen] = useState(false);
  
  // Alert settings
  const [warningThreshold, setWarningThreshold] = useState('500000');
  const [criticalThreshold, setCriticalThreshold] = useState('100000');
  const [lineToken, setLineToken] = useState('');
  
  // Fetch real data from API
  const { data: depositData, mutate: mutateDeposits } = useSWR<{ requests: DepositRequest[], summary: any }>(
    '/api/deposit-requests?status=all',
    fetcher,
    { refreshInterval: 5000 }
  );
  
  const { data: withdrawData, mutate: mutateWithdraws } = useSWR<{ requests: WithdrawRequest[], summary: any }>(
    '/api/withdraw-requests?status=all',
    fetcher,
    { refreshInterval: 5000 }
  );
  
  const { data: transactionsData } = useSWR(
    '/api/transactions?limit=10',
    fetcher,
    { refreshInterval: 10000 }
  );

  // Calculate totals from real data
  const pendingDeposits = depositData?.requests?.filter(d => d.status === 'pending') || [];
  const pendingWithdrawals = withdrawData?.requests?.filter(w => w.status === 'pending' || w.status === 'reviewing') || [];
  const pendingDepositAmount = pendingDeposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const pendingWithdrawAmount = pendingWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
  
  // Master balance (sum of all customer credits - this should come from a dedicated API in production)
  const masterBalance = (depositData?.summary?.totalAmount || 0) - (withdrawData?.summary?.totalAmount || 0) + 15000000;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds} วินาทีที่แล้ว`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  };

  const handleApproveDeposit = async (id: string) => {
    setIsProcessing(id);
    try {
      const res = await fetch(`/api/deposit-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'admin' }),
      });
      const data = await res.json();
      if (data.success) {
        mutateDeposits();
        alert(`อนุมัติการฝากเงินสำเร็จ - ยอดใหม่: ${formatCurrency(data.newBalance)} บาท`);
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอนุมัติ');
    }
    setIsProcessing(null);
  };

  const handleRejectDeposit = async (id: string) => {
    setIsProcessing(id);
    try {
      const res = await fetch(`/api/deposit-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejected_by: 'admin', reject_reason: 'ไม่พบหลักฐานการโอนเงิน' }),
      });
      const data = await res.json();
      if (data.success) {
        mutateDeposits();
        alert('ปฏิเสธคำขอฝากเงินแล้ว');
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาด');
    }
    setIsProcessing(null);
  };

  const handleApproveWithdrawal = async (id: string) => {
    setIsProcessing(id);
    try {
      const res = await fetch(`/api/withdraw-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (data.success) {
        mutateWithdraws();
        // Open slip upload dialog
        const withdraw = pendingWithdrawals.find(w => w.id === id);
        if (withdraw) {
          setSelectedWithdraw(withdraw);
          setSlipDialogOpen(true);
        }
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอนุมัติ');
    }
    setIsProcessing(null);
  };

  const handleRejectWithdrawal = async (id: string) => {
    setIsProcessing(id);
    try {
      const res = await fetch(`/api/withdraw-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', admin_note: 'ข้อมูลบัญชีไม่ถูกต้อง' }),
      });
      const data = await res.json();
      if (data.success) {
        mutateWithdraws();
        alert('ปฏิเสธคำขอถอนเงินแล้ว - คืนเครดิตให้ลูกค้าเรียบร้อย');
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาด');
    }
    setIsProcessing(null);
  };

  const handleUploadSlip = async () => {
    if (!selectedWithdraw || !slipFile) return;
    
    setIsProcessing(selectedWithdraw.id);
    try {
      // Upload to Vercel Blob
      const formData = new FormData();
      formData.append('file', slipFile);
      formData.append('withdraw_id', selectedWithdraw.id);
      
      const res = await fetch('/api/upload-slip', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (data.success) {
        mutateWithdraws();
        setSlipDialogOpen(false);
        setSlipFile(null);
        setSelectedWithdraw(null);
        alert('อัปโหลดสลิปสำเร็จ');
      } else {
        alert(`เกิดข้อผิดพลาด: ${data.error}`);
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัปโหลด');
    }
    setIsProcessing(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 
          className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
        >
          Money Pipeline
        </h1>
        <p className="text-slate-400 mt-2">ระบบจัดการการเงินอัตโนมัติ - Auto Deposit &amp; Withdrawal</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Master Balance */}
        <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 border-emerald-500/30 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-400 text-sm">ยอดคงเหลือ Master</span>
              <Wallet className="size-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(masterBalance)}
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-emerald-400">
              <TrendingUp className="size-3" />
              <span>+2.5% จากเมื่อวาน</span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Deposits */}
        <Card className="bg-gradient-to-br from-blue-900/40 to-blue-950/60 border-blue-500/30 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-400 text-sm">รอเติมเงิน</span>
              <ArrowDownToLine className="size-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(pendingDepositAmount)}
            </div>
            <div className="text-xs text-blue-400 mt-2">
              {pendingDeposits.length} รายการรอดำเนินการ
            </div>
          </CardContent>
        </Card>

        {/* Pending Withdrawals */}
        <Card className="bg-gradient-to-br from-orange-900/40 to-orange-950/60 border-orange-500/30 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-400 text-sm">รอถอนเงิน</span>
              <ArrowUpFromLine className="size-5 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(pendingWithdrawAmount)}
            </div>
            <div className="text-xs text-orange-400 mt-2">
              {pendingWithdrawals.length} รายการรอดำเนินการ
            </div>
          </CardContent>
        </Card>

        {/* Auto System Status */}
        <Card className="bg-gradient-to-br from-purple-900/40 to-purple-950/60 border-purple-500/30 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-400 text-sm">สถานะระบบออโต้</span>
              <Activity className="size-5 text-purple-400" />
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-lg font-bold text-emerald-400">ONLINE</span>
            </div>
            <div className="text-xs text-purple-400 mt-2">
              Auto-Approve: {autoWithdrawEnabled ? 'เปิด' : 'ปิด'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-black/40 border border-amber-500/20 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Activity className="size-4 mr-2" />
            ภาพรวม
          </TabsTrigger>
          <TabsTrigger value="deposits" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
            <ArrowDownToLine className="size-4 mr-2" />
            เติมเงิน
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <ArrowUpFromLine className="size-4 mr-2" />
            ถอนเงิน
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Settings className="size-4 mr-2" />
            ตั้งค่า
          </TabsTrigger>
          <TabsTrigger value="tokens" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            <Shield className="size-4 mr-2" />
            API Tokens
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Transactions */}
            <Card className="bg-black/40 backdrop-blur-xl border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-amber-400 flex items-center gap-2">
                  <RefreshCw className="size-5" />
                  รายการล่าสุด
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(transactionsData?.transactions || []).slice(0, 5).map((txn: any) => (
                  <div 
                    key={txn.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-slate-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "size-10 rounded-full flex items-center justify-center",
                        txn.type === 'deposit' 
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-orange-500/20 text-orange-400"
                      )}>
                        {txn.type === 'deposit' ? <ArrowDownToLine className="size-5" /> : <ArrowUpFromLine className="size-5" />}
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {txn.type === 'deposit' ? 'เติมเงิน' : txn.type === 'withdraw' ? 'ถอนเงิน' : txn.description}
                        </p>
                        <p className="text-xs text-slate-400">{txn.customer?.name || txn.customer_id?.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-bold",
                        txn.type === 'deposit' || txn.type === 'win' ? "text-emerald-400" : "text-orange-400"
                      )}>
                        {txn.type === 'deposit' || txn.type === 'win' ? '+' : '-'}{formatCurrency(txn.amount)}
                      </p>
                      <p className="text-xs text-slate-400">{formatTimeAgo(txn.created_at)}</p>
                    </div>
                  </div>
                ))}
                {(!transactionsData?.transactions || transactionsData.transactions.length === 0) && (
                  <div className="text-center py-8 text-slate-500">
                    ยังไม่มีรายการ
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Status */}
            <Card className="bg-black/40 backdrop-blur-xl border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-amber-400 flex items-center gap-2">
                  <Activity className="size-5" />
                  สถานะ Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Deposit Pipeline */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-900/30 to-emerald-950/50 border border-emerald-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-emerald-400 font-medium">Deposit Pipeline</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      <CheckCircle2 className="size-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-white">{depositData?.summary?.total || 0}</p>
                      <p className="text-xs text-slate-400">ทั้งหมด</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">฿{((depositData?.summary?.totalAmount || 0) / 1000).toFixed(0)}K</p>
                      <p className="text-xs text-slate-400">ยอดรวม</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{depositData?.summary?.approved || 0}</p>
                      <p className="text-xs text-slate-400">สำเร็จ</p>
                    </div>
                  </div>
                </div>

                {/* Withdrawal Pipeline */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-orange-900/30 to-orange-950/50 border border-orange-500/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-orange-400 font-medium">Withdrawal Pipeline</span>
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      <CheckCircle2 className="size-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-white">{withdrawData?.summary?.total || 0}</p>
                      <p className="text-xs text-slate-400">ทั้งหมด</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-400">฿{((withdrawData?.summary?.totalAmount || 0) / 1000).toFixed(0)}K</p>
                      <p className="text-xs text-slate-400">ยอดรวม</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{withdrawData?.summary?.approved || 0}</p>
                      <p className="text-xs text-slate-400">สำเร็จ</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deposits Tab */}
        <TabsContent value="deposits" className="space-y-6">
          <Card className="bg-black/40 backdrop-blur-xl border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-blue-400 flex items-center gap-2">
                <QrCode className="size-5" />
                รายการรอเติมเงิน (QR Code)
              </CardTitle>
              <CardDescription className="text-slate-400">
                รายการที่รอการยืนยันจาก Payment Gateway
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingDeposits.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    ไม่มีรายการรอดำเนินการ
                  </div>
                ) : (
                  pendingDeposits.map((deposit) => (
                    <div 
                      key={deposit.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-blue-500/20 hover:border-blue-500/40 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="size-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <QrCode className="size-6 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{deposit.customer?.name || 'ลูกค้า'}</p>
                          <p className="text-xs text-slate-400">โทร: {deposit.customer?.phone || '-'}</p>
                          {deposit.bank_name && (
                            <p className="text-xs text-slate-400">ธนาคาร: {deposit.bank_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-blue-400">
                          +{formatCurrency(deposit.amount)}
                        </p>
                        <p className="text-xs text-slate-400">{formatTimeAgo(deposit.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                          onClick={() => handleRejectDeposit(deposit.id)}
                          disabled={isProcessing === deposit.id}
                        >
                          {isProcessing === deposit.id ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                        </Button>
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white"
                          onClick={() => handleApproveDeposit(deposit.id)}
                          disabled={isProcessing === deposit.id}
                        >
                          {isProcessing === deposit.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                          อนุมัติ
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals" className="space-y-6">
          <Card className="bg-black/40 backdrop-blur-xl border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-orange-400 flex items-center gap-2">
                <Building2 className="size-5" />
                รายการรออนุมัติถอนเงิน
              </CardTitle>
              <CardDescription className="text-slate-400">
                ยอดเกิน Auto-Approve Limit ({formatCurrency(parseInt(autoApproveLimit))}) ต้องอนุมัติด้วยมือ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingWithdrawals.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    ไม่มีรายการรอดำเนินการ
                  </div>
                ) : (
                  pendingWithdrawals.map((withdrawal) => (
                    <div 
                      key={withdrawal.id}
                      className="p-4 rounded-xl bg-black/30 border border-orange-500/20 hover:border-orange-500/40 transition-all"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="size-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Building2 className="size-6 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{withdrawal.customer?.name || 'ลูกค้า'}</p>
                            <p className="text-xs text-slate-400">
                              {withdrawal.bank_name} - {withdrawal.account_number}
                            </p>
                            <p className="text-xs text-emerald-400 font-medium">{withdrawal.account_name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-400">
                            -{formatCurrency(withdrawal.amount)}
                          </p>
                          <p className="text-xs text-slate-400">{formatTimeAgo(withdrawal.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={cn(
                            "border",
                            withdrawal.status === 'pending' 
                              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          )}>
                            {withdrawal.status === 'pending' ? (
                              <>
                                <Clock className="size-3 mr-1" />
                                รอตรวจสอบ
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="size-3 mr-1" />
                                กำลังตรวจสอบ
                              </>
                            )}
                          </Badge>
                          {withdrawal.amount > parseInt(autoApproveLimit) && (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              เกิน Auto-Approve
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                            onClick={() => handleRejectWithdrawal(withdrawal.id)}
                            disabled={isProcessing === withdrawal.id}
                          >
                            {isProcessing === withdrawal.id ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4 mr-1" />}
                            ปฏิเสธ
                          </Button>
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white"
                            onClick={() => handleApproveWithdrawal(withdrawal.id)}
                            disabled={isProcessing === withdrawal.id}
                          >
                            {isProcessing === withdrawal.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                            อนุมัติ + อัปสลิป
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Auto-Withdrawal Settings */}
            <Card className="bg-black/40 backdrop-blur-xl border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-purple-400 flex items-center gap-2">
                  <Settings className="size-5" />
                  ตั้งค่า Auto-Withdrawal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-black/30 border border-purple-500/20">
                  <div>
                    <p className="text-white font-medium">เปิดระบบถอนอัตโนมัติ</p>
                    <p className="text-xs text-slate-400">ยอดต่ำกว่า limit จะโอนออกทันที 24 ชม.</p>
                  </div>
                  <Switch
                    checked={autoWithdrawEnabled}
                    onCheckedChange={setAutoWithdrawEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Auto-Approve Limit (บาท)</label>
                  <Input
                    type="number"
                    value={autoApproveLimit}
                    onChange={(e) => setAutoApproveLimit(e.target.value)}
                    className="bg-black/30 border-purple-500/30 text-white"
                    placeholder="30000"
                  />
                  <p className="text-xs text-slate-500">ยอดถอนต่ำกว่านี้จะอนุมัติอัตโนมัติ</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">ยอดถอนขั้นต่ำ</label>
                    <Input
                      type="number"
                      defaultValue="100"
                      className="bg-black/30 border-purple-500/30 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-400">ยอดถอนสูงสุด</label>
                    <Input
                      type="number"
                      defaultValue="500000"
                      className="bg-black/30 border-purple-500/30 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-400">วงเงินถอนต่อวัน (ต่อยูสเซอร์)</label>
                  <Input
                    type="number"
                    defaultValue="1000000"
                    className="bg-black/30 border-purple-500/30 text-white"
                  />
                </div>

                <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600">
                  บันทึกการตั้งค่า
                </Button>
              </CardContent>
            </Card>

            {/* Balance Alert Settings */}
            <Card className="bg-black/40 backdrop-blur-xl border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-amber-400 flex items-center gap-2">
                  <Bell className="size-5" />
                  ตั้งค่าแจ้งเตือนยอดเงิน
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">LINE Notify Token</label>
                  <div className="flex gap-2">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={lineToken}
                      onChange={(e) => setLineToken(e.target.value)}
                      className="bg-black/30 border-amber-500/30 text-white"
                      placeholder="ใส่ LINE Notify Token"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-amber-500/30"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-400">เตือนเมื่อยอดต่ำกว่า (Warning)</label>
                  <Input
                    type="number"
                    value={warningThreshold}
                    onChange={(e) => setWarningThreshold(e.target.value)}
                    className="bg-black/30 border-yellow-500/30 text-white"
                    placeholder="500000"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-400">เตือนวิกฤตเมื่อยอดต่ำกว่า (Critical)</label>
                  <Input
                    type="number"
                    value={criticalThreshold}
                    onChange={(e) => setCriticalThreshold(e.target.value)}
                    className="bg-black/30 border-red-500/30 text-white"
                    placeholder="100000"
                  />
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-r from-amber-900/30 to-amber-950/50 border border-amber-500/20">
                  <p className="text-amber-400 text-sm font-medium mb-2">ตัวอย่างข้อความแจ้งเตือน:</p>
                  <p className="text-xs text-slate-300">
                    [WARNING] ยอดเงินในบัญชี Master เหลือ 450,000 บาท - กรุณาเติมเงิน
                  </p>
                </div>

                <Button className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600">
                  ทดสอบส่ง LINE
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Tokens Tab */}
        <TabsContent value="tokens" className="space-y-6">
          <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <Shield className="size-5" />
                API Tokens - Payment Gateway
              </CardTitle>
              <CardDescription className="text-slate-400">
                จัดการ API Keys สำหรับเชื่อมต่อ Payment Gateway
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PromptPay API */}
              <div className="p-4 rounded-xl bg-black/30 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <QrCode className="size-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">PromptPay API</p>
                      <p className="text-xs text-slate-400">สำหรับ QR Code Auto-Deposit</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    เชื่อมต่อแล้ว
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">API Key</label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        defaultValue="sk_live_xxxxxxxxxxxx"
                        className="bg-black/30 border-emerald-500/30 text-white text-sm"
                        readOnly
                      />
                      <Button variant="outline" size="icon" className="border-emerald-500/30">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Merchant ID</label>
                    <Input
                      type="text"
                      defaultValue="MER-FINLOTTO-001"
                      className="bg-black/30 border-emerald-500/30 text-white text-sm"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Bank API */}
              <div className="p-4 rounded-xl bg-black/30 border border-blue-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Building2 className="size-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Bank Transfer API</p>
                      <p className="text-xs text-slate-400">สำหรับโอนเงินออกอัตโนมัติ</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    เชื่อมต่อแล้ว
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">API Key</label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        defaultValue="bank_api_xxxxxxxxxxxx"
                        className="bg-black/30 border-blue-500/30 text-white text-sm"
                        readOnly
                      />
                      <Button variant="outline" size="icon" className="border-blue-500/30">
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400">Secret Key</label>
                    <Input
                      type="password"
                      defaultValue="secret_xxxxxxxxxxxx"
                      className="bg-black/30 border-blue-500/30 text-white text-sm"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Add New Gateway */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-amber-500/50"
                  >
                    + เพิ่ม Payment Gateway ใหม่
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0a0f1a] border-amber-500/30">
                  <DialogHeader>
                    <DialogTitle className="text-amber-400">เพิ่ม Payment Gateway</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      กรอกข้อมูล API สำหรับเชื่อมต่อ Payment Gateway ใหม่
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">ประเภท Gateway</label>
                      <Select>
                        <SelectTrigger className="bg-black/30 border-amber-500/30">
                          <SelectValue placeholder="เลือกประเภท" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="promptpay">PromptPay</SelectItem>
                          <SelectItem value="truewallet">TrueWallet</SelectItem>
                          <SelectItem value="bank">Bank API</SelectItem>
                          <SelectItem value="custom">Custom API</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">API Key</label>
                      <Input className="bg-black/30 border-amber-500/30" placeholder="ใส่ API Key" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Secret Key</label>
                      <Input type="password" className="bg-black/30 border-amber-500/30" placeholder="ใส่ Secret Key" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Merchant ID / PromptPay ID</label>
                      <Input className="bg-black/30 border-amber-500/30" placeholder="ใส่ Merchant ID" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Callback URL</label>
                      <Input className="bg-black/30 border-amber-500/30" defaultValue="https://yourdomain.com/api/payment/callback" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button className="bg-gradient-to-r from-amber-600 to-amber-700">
                      บันทึก Gateway
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Security Notice */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-red-900/20 to-red-950/30 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <Shield className="size-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium text-sm">คำเตือนความปลอดภัย</p>
                    <p className="text-xs text-slate-400 mt-1">
                      API Keys ถูกเข้ารหัสด้วย AES-256-GCM และจัดเก็บอย่างปลอดภัย 
                      ทุกการเปลี่ยนแปลงจะถูกบันทึกใน Audit Log เพื่อตรวจสอบย้อนหลัง
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Slip Upload Dialog */}
      <Dialog open={slipDialogOpen} onOpenChange={setSlipDialogOpen}>
        <DialogContent className="bg-[#0a0f1a] border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="text-amber-400">อัปโหลดสลิปการโอนเงิน</DialogTitle>
            <DialogDescription className="text-slate-400">
              อัปโหลดหลักฐานการโอนเงินให้ลูกค้า
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdraw && (
            <div className="space-y-4 py-4">
              {/* Customer Info */}
              <div className="p-4 rounded-lg bg-black/30 border border-orange-500/20">
                <p className="text-white font-medium">{selectedWithdraw.customer?.name}</p>
                <p className="text-emerald-400">{selectedWithdraw.bank_name} - {selectedWithdraw.account_number}</p>
                <p className="text-slate-400">{selectedWithdraw.account_name}</p>
                <p className="text-2xl font-bold text-orange-400 mt-2">
                  {formatCurrency(selectedWithdraw.amount)} บาท
                </p>
              </div>
              
              {/* Slip Upload */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">เลือกรูปสลิป</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                  className="bg-black/30 border-amber-500/30 text-white"
                />
                {slipFile && (
                  <p className="text-xs text-emerald-400">
                    เลือกไฟล์: {slipFile.name}
                  </p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSlipDialogOpen(false);
                setSlipFile(null);
                setSelectedWithdraw(null);
              }}
              className="border-slate-600"
            >
              ข้าม
            </Button>
            <Button
              onClick={handleUploadSlip}
              disabled={!slipFile || isProcessing === selectedWithdraw?.id}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600"
            >
              {isProcessing === selectedWithdraw?.id ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Upload className="size-4 mr-2" />
              )}
              อัปโหลดสลิป
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
