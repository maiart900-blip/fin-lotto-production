'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowUpCircle,
  Search,
  Loader2,
  Wallet,
  User,
  Phone,
  Clock,
  Banknote,
  History,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  FileSearch,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// NEW: Precise date-time format DD/MM/YYYY HH:mm:ss
const formatDateTime = (date: string) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const seconds = d.getSeconds().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

interface Customer {
  id: string;
  name: string;
  phone: string;
  credit_balance: number;
  credit?: number;
}

interface CreditTransaction {
  id: string;
  customer_id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  customer?: {
    name: string;
    phone: string;
  };
  creator?: {
    display_name: string;
  };
}

export default function CreditAdjustmentsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  
  // NEW: Date-time filter states
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [filterUrl, setFilterUrl] = useState<string | null>(null);

  // Fetch customers for search
  const { data: customersData } = useSWR(
    searchTerm.length >= 2 ? `/api/customers?search=${encodeURIComponent(searchTerm)}&limit=10` : null,
    fetcher
  );

  // NEW: Lazy loading - only fetch when filterUrl is set
  const { data: transactionsResponse, mutate: mutateTransactions, isLoading: isLoadingTransactions } = useSWR<{
    data: CreditTransaction[];
    total?: number;
    message?: string;
    requiresFilter?: boolean;
  }>(
    filterUrl,
    fetcher,
    { refreshInterval: 0 } // Disable auto-refresh for lazy loading
  );

  const customers = Array.isArray(customersData) ? customersData : customersData?.customers || [];
  const transactions = transactionsResponse?.data || [];
  const requiresFilter = transactionsResponse?.requiresFilter || false;

  // NEW: Search with filters
  const handleSearch = useCallback(() => {
    setIsSearching(true);
    const params = new URLSearchParams();
    params.set('limit', '100');
    
    if (startDateTime) {
      params.set('start_date', new Date(startDateTime).toISOString());
    }
    if (endDateTime) {
      params.set('end_date', new Date(endDateTime).toISOString());
    }
    if (transactionType && transactionType !== 'all') {
      params.set('transaction_type', transactionType);
    }
    
    const url = `/api/credit-transactions?${params.toString()}`;
    setFilterUrl(url);
    setHasSearched(true);
    
    // Reset searching state after a brief delay
    setTimeout(() => setIsSearching(false), 500);
  }, [startDateTime, endDateTime, transactionType]);

  // NEW: Reset filters
  const handleResetFilters = () => {
    setStartDateTime('');
    setEndDateTime('');
    setTransactionType('all');
    setFilterUrl(null);
    setHasSearched(false);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchTerm('');
    setIsAdjustOpen(true);
  };

  const handleAdjustCredit = async () => {
    if (!selectedCustomer || !adjustAmount) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    if (!adjustReason.trim()) {
      toast.error('กรุณาเลือกเหตุผลในการปรับยอด');
      return;
    }

    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }

    const currentBalance = selectedCustomer.credit_balance || selectedCustomer.credit || 0;
    if (adjustType === 'subtract' && amount > currentBalance) {
      toast.error(`ยอดเครดิตไม่เพียงพอ (คงเหลือ ${formatMoney(currentBalance)} บาท)`);
      return;
    }

    if (amount >= 10000 && !requiresApproval) {
      toast.warning('ยอดเกิน 10,000 บาท ต้องตรวจสอบอีกครั้ง');
      setRequiresApproval(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/credit-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          type: adjustType === 'add' ? 'admin_add' : 'admin_subtract',
          amount: adjustType === 'add' ? amount : -amount,
          reason: adjustReason,
          note: adjustNote || null,
          created_by: user?.id,
          audit_metadata: {
            operator_name: user?.displayName || user?.username,
            operator_role: user?.role,
            ip_address: 'server-side',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ปรับยอดไม่สำเร็จ');
      }

      toast.success(`ปรับยอดเครดิตสำเร็จ ${adjustType === 'add' ? '+' : '-'}${formatMoney(amount)} บาท`);
      setIsAdjustOpen(false);
      setSelectedCustomer(null);
      setAdjustAmount('');
      setAdjustNote('');
      setAdjustReason('');
      setRequiresApproval(false);
      if (filterUrl) mutateTransactions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetDialog = () => {
    setSelectedCustomer(null);
    setAdjustAmount('');
    setAdjustNote('');
    setAdjustReason('');
    setAdjustType('add');
    setRequiresApproval(false);
  };

  const adjustmentReasons = [
    { value: 'correction', label: 'แก้ไขยอดผิดพลาด' },
    { value: 'bonus', label: 'โบนัส/โปรโมชั่น' },
    { value: 'refund', label: 'คืนเงิน' },
    { value: 'compensation', label: 'ชดเชยความเสียหาย' },
    { value: 'system_error', label: 'แก้ไขข้อผิดพลาดระบบ' },
    { value: 'deduction', label: 'หักยอดตามเงื่อนไข' },
    { value: 'other', label: 'อื่นๆ (ระบุในหมายเหตุ)' },
  ];

  const transactionTypes = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'bet', label: 'แทง' },
    { value: 'deposit', label: 'เติมเงิน' },
    { value: 'withdraw', label: 'ถอนเงิน' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#141414] p-6">
      {/* Header - Premium VIP Dark */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 shadow-lg shadow-amber-500/10">
            <Wallet className="size-7 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
              ปรับยอดเครดิต
            </h1>
            <p className="text-neutral-400 text-sm">เพิ่มหรือลดเครดิตลูกค้า</p>
          </div>
        </div>
      </div>

      {/* Search Customer Card - Premium VIP Dark */}
      <Card className="bg-black/60 backdrop-blur-xl border-amber-500/20 shadow-xl mb-6">
        <CardHeader className="border-b border-amber-500/10">
          <CardTitle className="flex items-center gap-2 text-amber-100">
            <Search className="size-5 text-amber-400" />
            ค้นหาลูกค้า
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-amber-500/50" />
              <Input
                placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-black/40 border-amber-500/20 text-white placeholder:text-neutral-500 focus:border-amber-500/50 focus:ring-amber-500/20"
              />
            </div>

            {searchTerm.length >= 2 && customers.length > 0 && (
              <div className="border border-amber-500/20 rounded-lg divide-y divide-amber-500/10 bg-black/40">
                {customers.map((customer: Customer) => (
                  <div
                    key={customer.id}
                    className="p-3 hover:bg-amber-500/10 cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
                        <User className="size-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{customer.name}</p>
                        <p className="text-sm text-neutral-400 flex items-center gap-1">
                          <Phone className="size-3" />
                          {customer.phone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">เครดิตคงเหลือ</p>
                      <p className="font-semibold text-emerald-400">
                        {formatMoney(customer.credit_balance || customer.credit || 0)} บาท
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchTerm.length >= 2 && customers.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                <User className="size-12 mx-auto mb-2 opacity-50" />
                <p>ไม่พบลูกค้า &quot;{searchTerm}&quot;</p>
              </div>
            )}

            {searchTerm.length > 0 && searchTerm.length < 2 && (
              <p className="text-sm text-neutral-500 text-center">
                พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* NEW: Advanced Date-Time Filter Panel - Premium VIP Dark */}
      <Card className="bg-black/60 backdrop-blur-xl border-amber-500/20 shadow-xl mb-6">
        <CardHeader className="border-b border-amber-500/10">
          <CardTitle className="flex items-center gap-2 text-amber-100">
            <Filter className="size-5 text-amber-400" />
            ตัวกรองค้นหาขั้นสูง
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Start Date-Time */}
            <div className="space-y-2">
              <Label className="text-amber-200 flex items-center gap-1">
                <Calendar className="size-3" />
                วัน-เวลาเริ่มต้น
              </Label>
              <Input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="bg-black/40 border-amber-500/20 text-white focus:border-amber-500/50 focus:ring-amber-500/20 [color-scheme:dark]"
              />
            </div>
            
            {/* End Date-Time */}
            <div className="space-y-2">
              <Label className="text-amber-200 flex items-center gap-1">
                <Calendar className="size-3" />
                วัน-เวลาสิ้นสุด
              </Label>
              <Input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="bg-black/40 border-amber-500/20 text-white focus:border-amber-500/50 focus:ring-amber-500/20 [color-scheme:dark]"
              />
            </div>
            
            {/* Transaction Type */}
            <div className="space-y-2">
              <Label className="text-amber-200">ประเภทรายการ</Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger className="bg-black/40 border-amber-500/20 text-white focus:ring-amber-500/20">
                  <SelectValue placeholder="เลือกประเภท" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-amber-500/30">
                  {transactionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-white hover:bg-amber-500/20">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Search & Reset Buttons */}
            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex gap-2">
                <Button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold shadow-lg shadow-amber-500/25 transition-all"
                >
                  {isSearching ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <FileSearch className="size-4 mr-2" />
                  )}
                  ค้นหาข้อมูล
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetFilters}
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History Table - Premium VIP Dark */}
      <Card className="bg-black/60 backdrop-blur-xl border-amber-500/20 shadow-xl">
        <CardHeader className="border-b border-amber-500/10">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-100">
              <History className="size-5 text-amber-400" />
              ประวัติการปรับยอด
            </div>
            {transactions.length > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                {transactions.length} รายการ
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {!hasSearched ? (
            // Initial state - show message to use filters
            <div className="text-center py-16">
              <div className="size-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                <FileSearch className="size-10 text-amber-400/60" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-amber-200">โปรดเลือกตัวกรองและกดค้นหาข้อมูล</h3>
              <p className="text-neutral-500 max-w-md mx-auto">
                เลือกช่วงวันที่และเวลา หรือประเภทรายการ แล้วกดปุ่ม &quot;ค้นหาข้อมูล&quot; เพื่อแสดงประวัติ
              </p>
            </div>
          ) : isLoadingTransactions || isSearching ? (
            // Loading state
            <div className="text-center py-16">
              <Loader2 className="size-12 mx-auto mb-4 text-amber-400 animate-spin" />
              <p className="text-neutral-400">กำลังค้นหาข้อมูล...</p>
            </div>
          ) : transactions.length === 0 ? (
            // No results
            <div className="text-center py-16">
              <div className="size-20 mx-auto mb-4 rounded-full bg-neutral-800/50 flex items-center justify-center">
                <History className="size-10 text-neutral-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-neutral-300">ไม่พบข้อมูลตามเงื่อนไขที่ระบุ</h3>
              <p className="text-neutral-500">ลองปรับตัวกรองและค้นหาใหม่อีกครั้ง</p>
            </div>
          ) : (
            // Table with results
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber-500/10 hover:bg-transparent">
                    <TableHead className="text-amber-300 font-bold">วัน-เวลา</TableHead>
                    <TableHead className="text-amber-300 font-bold">ลูกค้า</TableHead>
                    <TableHead className="text-amber-300 font-bold">ประเภท</TableHead>
                    <TableHead className="text-amber-300 font-bold text-right">จำนวน</TableHead>
                    <TableHead className="text-amber-300 font-bold text-right">ก่อน</TableHead>
                    <TableHead className="text-amber-300 font-bold text-right">หลัง</TableHead>
                    <TableHead className="text-amber-300 font-bold">หมายเหตุ</TableHead>
                    <TableHead className="text-amber-300 font-bold">โดย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-amber-500/10 hover:bg-amber-500/5">
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-neutral-300 font-mono">
                          <Clock className="size-3 text-amber-500/50" />
                          {formatDateTime(tx.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{tx.customer?.name || '-'}</p>
                          <p className="text-xs text-neutral-500">{tx.customer?.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tx.amount >= 0 ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <Plus className="size-3 mr-1" />
                            เพิ่ม
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            <Minus className="size-3 mr-1" />
                            ลด
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-neutral-500">
                        {formatMoney(tx.balance_before)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-white">
                        {formatMoney(tx.balance_after)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-neutral-400">
                        {tx.note || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-neutral-500">
                        {tx.creator?.display_name || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Credit Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={(open) => {
        setIsAdjustOpen(open);
        if (!open) resetDialog();
      }}>
        <DialogContent className="sm:max-w-md bg-gradient-to-b from-[#0a0a0a] to-[#141414] border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-100">
              <Wallet className="size-5 text-amber-400" />
              ปรับยอดเครดิต
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              {selectedCustomer ? `${selectedCustomer.name} - ${selectedCustomer.phone}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-black/40 border border-amber-500/20 text-center">
                <p className="text-sm text-neutral-400">เครดิตปัจจุบัน</p>
                <p className="text-3xl font-bold text-emerald-400">
                  {formatMoney(selectedCustomer.credit_balance || selectedCustomer.credit || 0)} บาท
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={adjustType === 'add' ? 'default' : 'outline'}
                  className={adjustType === 'add' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}
                  onClick={() => setAdjustType('add')}
                >
                  <TrendingUp className="size-4 mr-2" />
                  เพิ่มเครดิต
                </Button>
                <Button
                  type="button"
                  variant={adjustType === 'subtract' ? 'default' : 'outline'}
                  className={adjustType === 'subtract' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}
                  onClick={() => setAdjustType('subtract')}
                >
                  <TrendingDown className="size-4 mr-2" />
                  ลดเครดิต
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-amber-200">จำนวนเงิน (บาท) *</Label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-amber-500/50" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={adjustAmount}
                    onChange={(e) => {
                      setAdjustAmount(e.target.value);
                      setRequiresApproval(false);
                    }}
                    className="pl-10 text-lg bg-black/40 border-amber-500/20 text-white"
                  />
                </div>
                {parseFloat(adjustAmount) >= 10000 && (
                  <p className="text-sm text-amber-400 flex items-center gap-1">
                    <ArrowUpCircle className="size-3" />
                    ยอดเกิน 10,000 บาท ต้องยืนยันอีกครั้ง
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-amber-200">เหตุผลในการปรับยอด * <span className="text-red-400">(บังคับ)</span></Label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger className="bg-black/40 border-amber-500/20 text-white">
                    <SelectValue placeholder="เลือกเหตุผล..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-amber-500/30">
                    {adjustmentReasons.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value} className="text-white hover:bg-amber-500/20">
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-amber-200">หมายเหตุเพิ่มเติม {adjustReason === 'other' && <span className="text-red-400">* (บังคับ)</span>}</Label>
                <Textarea
                  placeholder="รายละเอียดเพิ่มเติม..."
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  rows={2}
                  className="bg-black/40 border-amber-500/20 text-white"
                  required={adjustReason === 'other'}
                />
              </div>

              {requiresApproval && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-amber-300 font-medium text-sm">
                    ยืนยันการปรับยอดเกิน 10,000 บาท?
                  </p>
                  <p className="text-amber-400/70 text-xs mt-1">
                    กดปุ่มยืนยันอีกครั้งเพื่อดำเนินการ
                  </p>
                </div>
              )}

              {adjustAmount && !isNaN(parseFloat(adjustAmount)) && (
                <div className="p-3 rounded-lg bg-black/40 border border-amber-500/20 flex items-center justify-between">
                  <span className="text-sm text-neutral-400">ยอดหลังปรับ</span>
                  <span className={`font-bold ${adjustType === 'add' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(
                      (selectedCustomer.credit_balance || selectedCustomer.credit || 0) +
                      (adjustType === 'add' ? parseFloat(adjustAmount) : -parseFloat(adjustAmount))
                    )} บาท
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsAdjustOpen(false)}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleAdjustCredit}
              disabled={isSubmitting || !adjustAmount || !adjustReason || (adjustReason === 'other' && !adjustNote.trim())}
              className={adjustType === 'add' 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-red-600 hover:bg-red-700'}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  {adjustType === 'add' ? <Plus className="size-4 mr-2" /> : <Minus className="size-4 mr-2" />}
                  {requiresApproval ? 'ยืนยันอีกครั้ง' : 'ยืนยันปรับยอด'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
