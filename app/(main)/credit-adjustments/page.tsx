'use client';

import { useState } from 'react';
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
  ArrowDownCircle,
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

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const { user, canAccess } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustReason, setAdjustReason] = useState(''); // Mandatory reason
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false); // For large amounts

  // Fetch customers for search
  const { data: customersData } = useSWR(
    searchTerm.length >= 2 ? `/api/customers?search=${encodeURIComponent(searchTerm)}&limit=10` : null,
    fetcher
  );

  // Fetch recent credit transactions
  const { data: transactionsData, mutate: mutateTransactions } = useSWR<CreditTransaction[]>(
    '/api/credit-transactions?limit=50',
    fetcher,
    { refreshInterval: 30000 }
  );

  const customers = Array.isArray(customersData) ? customersData : customersData?.customers || [];
  const transactions = transactionsData || [];

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

    // MANDATORY: Reason is required for all credit adjustments
    if (!adjustReason.trim()) {
      toast.error('กรุณาเลือกเหตุผลในการปรับยอด');
      return;
    }

    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }

    // Check if subtract more than balance
    const currentBalance = selectedCustomer.credit_balance || selectedCustomer.credit || 0;
    if (adjustType === 'subtract' && amount > currentBalance) {
      toast.error(`ยอดเครดิตไม่เพียงพอ (คงเหลือ ${formatMoney(currentBalance)} บาท)`);
      return;
    }

    // Large amount warning (> 10,000 baht)
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
          reason: adjustReason, // Mandatory reason for audit
          note: adjustNote || null,
          created_by: user?.id,
          // Audit metadata
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
      mutateTransactions();
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

  // Predefined reasons for audit trail
  const adjustmentReasons = [
    { value: 'correction', label: 'แก้ไขยอดผิดพลาด' },
    { value: 'bonus', label: 'โบนัส/โปรโมชั่น' },
    { value: 'refund', label: 'คืนเงิน' },
    { value: 'compensation', label: 'ชดเชยความเสียหาย' },
    { value: 'system_error', label: 'แก้ไขข้อผิดพลาดระบบ' },
    { value: 'deduction', label: 'หักยอดตามเงื่อนไข' },
    { value: 'other', label: 'อื่นๆ (ระบุในหมายเหตุ)' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ปรับยอดเครดิต</h1>
            <p className="text-muted-foreground">เพิ่มหรือลดเครดิตลูกค้า</p>
          </div>
        </div>
      </div>

      {/* Search Customer Card */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Search className="size-5 text-gray-700" />
            ค้นหาลูกค้า
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              <Input
                placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white text-black border-gray-300"
              />
            </div>

            {/* Search Results */}
            {searchTerm.length >= 2 && customers.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 bg-white">
                {customers.map((customer: Customer) => (
                  <div
                    key={customer.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="size-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="size-3" />
                          {customer.phone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">เครดิตคงเหลือ</p>
                      <p className="font-semibold text-green-600">
                        {formatMoney(customer.credit_balance || customer.credit || 0)} บาท
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchTerm.length >= 2 && customers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <User className="size-12 mx-auto mb-2 opacity-50" />
                <p>ไม่พบลูกค้า "{searchTerm}"</p>
              </div>
            )}

            {searchTerm.length > 0 && searchTerm.length < 2 && (
              <p className="text-sm text-gray-500 text-center">
                พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <History className="size-5 text-gray-700" />
            ประวัติการปรับยอดล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="size-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <History className="size-8 text-gray-400" />
              </div>
              <h3 className="font-semibold text-lg mb-1 text-gray-900">ยังไม่มีประวัติการปรับยอด</h3>
              <p className="text-gray-500">การปรับยอดเครดิตจะแสดงที่นี่</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead className="text-right">ก่อน</TableHead>
                  <TableHead className="text-right">หลัง</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                  <TableHead>โดย</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-gray-50">
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-700">
                        <Clock className="size-3" />
                        {formatDate(tx.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{tx.customer?.name || '-'}</p>
                        <p className="text-xs text-gray-500">{tx.customer?.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tx.amount >= 0 ? (
                        <Badge className="bg-green-500/20 text-green-600">
                          <Plus className="size-3 mr-1" />
                          เพิ่ม
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-600">
                          <Minus className="size-3 mr-1" />
                          ลด
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-gray-500">
                      {formatMoney(tx.balance_before)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-gray-900">
                      {formatMoney(tx.balance_after)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-gray-700">
                      {tx.note || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {tx.creator?.display_name || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjust Credit Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={(open) => {
        setIsAdjustOpen(open);
        if (!open) resetDialog();
      }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Wallet className="size-5 text-gray-700" />
              ปรับยอดเครดิต
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {selectedCustomer ? `${selectedCustomer.name} - ${selectedCustomer.phone}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              {/* Current Balance */}
              <div className="p-4 rounded-lg bg-gray-100 text-center">
                <p className="text-sm text-gray-600">เครดิตปัจจุบัน</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatMoney(selectedCustomer.credit_balance || selectedCustomer.credit || 0)} บาท
                </p>
              </div>

              {/* Type Selection */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={adjustType === 'add' ? 'default' : 'outline'}
                  className={adjustType === 'add' ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={() => setAdjustType('add')}
                >
                  <TrendingUp className="size-4 mr-2" />
                  เพิ่มเครดิต
                </Button>
                <Button
                  type="button"
                  variant={adjustType === 'subtract' ? 'default' : 'outline'}
                  className={adjustType === 'subtract' ? 'bg-red-600 hover:bg-red-700' : ''}
                  onClick={() => setAdjustType('subtract')}
                >
                  <TrendingDown className="size-4 mr-2" />
                  ลดเครดิต
                </Button>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-gray-700">จำนวนเงิน (บาท) *</Label>
                <div className="relative">
                  <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={adjustAmount}
                    onChange={(e) => {
                      setAdjustAmount(e.target.value);
                      setRequiresApproval(false); // Reset approval when amount changes
                    }}
                    className="pl-10 text-lg bg-white text-black border-gray-300"
                  />
                </div>
                {parseFloat(adjustAmount) >= 10000 && (
                  <p className="text-sm text-amber-600 flex items-center gap-1">
                    <ArrowUpCircle className="size-3" />
                    ยอดเกิน 10,000 บาท ต้องยืนยันอีกครั้ง
                  </p>
                )}
              </div>

              {/* Mandatory Reason Selection */}
              <div className="space-y-2">
                <Label className="text-gray-700">เหตุผลในการปรับยอด * <span className="text-red-500">(บังคับ)</span></Label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger className="bg-white border-gray-300">
                    <SelectValue placeholder="เลือกเหตุผล..." />
                  </SelectTrigger>
                  <SelectContent>
                    {adjustmentReasons.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label className="text-gray-700">หมายเหตุเพิ่มเติม {adjustReason === 'other' && <span className="text-red-500">* (บังคับเมื่อเลือก อื่นๆ)</span>}</Label>
                <Textarea
                  placeholder="รายละเอียดเพิ่มเติม..."
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  rows={2}
                  className="bg-white text-black border-gray-300"
                  required={adjustReason === 'other'}
                />
              </div>

              {/* Large Amount Confirmation */}
              {requiresApproval && (
                <div className="p-3 rounded-lg bg-amber-100 border border-amber-300">
                  <p className="text-amber-800 font-medium text-sm">
                    ยืนยันการปรับยอดเกิน 10,000 บาท?
                  </p>
                  <p className="text-amber-700 text-xs mt-1">
                    กดปุ่มยืนยันอีกครั้งเพื่อดำเนินการ
                  </p>
                </div>
              )}

              {/* Preview */}
              {adjustAmount && !isNaN(parseFloat(adjustAmount)) && (
                <div className="p-3 rounded-lg bg-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-600">ยอดหลังปรับ</span>
                  <span className={`font-bold ${adjustType === 'add' ? 'text-green-600' : 'text-red-600'}`}>
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
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleAdjustCredit}
              disabled={isSubmitting || !adjustAmount || !adjustReason || (adjustReason === 'other' && !adjustNote.trim())}
              className={adjustType === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : requiresApproval ? (
                <>
                  {adjustType === 'add' ? <Plus className="size-4 mr-2" /> : <Minus className="size-4 mr-2" />}
                  ยืนยันการปรับยอด
                </>
              ) : (
                <>
                  {adjustType === 'add' ? <Plus className="size-4 mr-2" /> : <Minus className="size-4 mr-2" />}
                  {adjustType === 'add' ? 'เพิ่มเครดิต' : 'ลดเครดิต'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
