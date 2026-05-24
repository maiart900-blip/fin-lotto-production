'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wallet, Plus, Minus, ArrowUpRight, ArrowDownLeft, Gift, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import useSWR, { mutate } from 'swr';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  credit_balance: number;
}

interface CreditTransaction {
  id: string;
  customer_id: string;
  type: 'deposit' | 'withdraw' | 'bet' | 'win' | 'refund' | 'bonus';
  amount: number;
  balance_before: number;
  balance_after: number;
  note: string | null;
  created_at: string;
  customer?: { id: string; name: string };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

const TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  deposit: { label: 'เติมเงิน', color: 'bg-green-500', icon: <Plus className="size-3" /> },
  withdraw: { label: 'ถอนเงิน', color: 'bg-red-500', icon: <Minus className="size-3" /> },
  bet: { label: 'แทง', color: 'bg-blue-500', icon: <ArrowUpRight className="size-3" /> },
  win: { label: 'ถูกรางวัล', color: 'bg-yellow-500', icon: <ArrowDownLeft className="size-3" /> },
  refund: { label: 'คืนเงิน', color: 'bg-purple-500', icon: <RotateCcw className="size-3" /> },
  bonus: { label: 'โบนัส', color: 'bg-pink-500', icon: <Gift className="size-3" /> },
};

export default function CreditsPage() {
  const { data: customers = [] } = useSWR<Customer[]>('/api/customers', fetcher);
  const { data: transactions = [] } = useSWR<CreditTransaction[]>('/api/credits?limit=100', fetcher);
  
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchCustomer, setSearchCustomer] = useState('');
  
  // New states for phone search in deposit modal
  const [phoneSearch, setPhoneSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);
  const [searchError, setSearchError] = useState('');

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    (c.phone && c.phone.includes(searchCustomer))
  );

  // Search customer by phone
  const handlePhoneSearch = useCallback(async (phone: string) => {
    if (!phone || phone.length < 3) {
      setSearchedCustomer(null);
      setSearchError('');
      return;
    }
    
    setIsSearching(true);
    setSearchError('');
    
    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Search from local customers first
    const found = customers.find(c => c.phone && c.phone.includes(cleanPhone));
    
    if (found) {
      setSearchedCustomer(found);
      setSelectedCustomerId(found.id);
      setSearchError('');
    } else {
      setSearchedCustomer(null);
      setSelectedCustomerId('');
      setSearchError('ไม่พบข้อมูลลูกค้า');
    }
    
    setIsSearching(false);
  }, [customers]);

  // Handle phone input change with auto search
  const handlePhoneChange = (value: string) => {
    setPhoneSearch(value);
    // Auto search when phone number is complete (10 digits)
    const cleanPhone = value.replace(/\D/g, '');
    if (cleanPhone.length >= 10) {
      handlePhoneSearch(cleanPhone);
    } else {
      setSearchedCustomer(null);
      setSelectedCustomerId('');
      setSearchError('');
    }
  };

  // Handle Enter key to search
  const handlePhoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePhoneSearch(phoneSearch);
    }
  };

  // Clear phone search
  const clearPhoneSearch = () => {
    setPhoneSearch('');
    setSearchedCustomer(null);
    setSelectedCustomerId('');
    setSearchError('');
  };

  // Reset deposit modal state when closing
  const handleCloseDepositDialog = (open: boolean) => {
    setShowDepositDialog(open);
    if (!open) {
      setPhoneSearch('');
      setSearchedCustomer(null);
      setSelectedCustomerId('');
      setAmount('');
      setNote('');
      setSearchError('');
    }
  };

  const handleTransaction = useCallback(async (type: 'deposit' | 'withdraw' | 'bonus') => {
    if (!selectedCustomerId || !amount) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          type,
          amount: parseFloat(amount),
          note,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(type === 'deposit' ? 'เติมเงินสำเร็จ' : type === 'withdraw' ? 'ถอนเงินสำเร็จ' : 'เพิ่มโบนัสสำเร็จ');
      
      // Refresh data
      mutate('/api/customers');
      mutate('/api/credits?limit=100');
      
      // Reset form
      setShowDepositDialog(false);
      setShowWithdrawDialog(false);
      setAmount('');
      setNote('');
      setSelectedCustomerId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCustomerId, amount, note]);

  // Quick amounts
  const quickAmounts = [100, 500, 1000, 2000, 5000, 10000];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="size-6 text-accent" />
            จัดการเครดิต
          </h1>
          <p className="text-muted-foreground">เติม/ถอนเงินให้ลูกค้า</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowDepositDialog(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="size-4 mr-2" />
            เติมเงิน
          </Button>
          <Button onClick={() => setShowWithdrawDialog(true)} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10">
            <Minus className="size-4 mr-2" />
            ถอนเงิน
          </Button>
        </div>
      </div>

      {/* Customer Balances */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">ยอดเครดิตลูกค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
              <Input
                placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                className="pl-9 bg-white text-black border-gray-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredCustomers.slice(0, 20).map((customer) => (
              <div
                key={customer.id}
                className="p-4 rounded-xl border border-gray-200 bg-gray-50 hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedCustomerId(customer.id);
                  setShowDepositDialog(true);
                }}
              >
                <p className="font-medium truncate text-gray-900">{customer.name}</p>
                <p className="text-xs text-gray-500">{customer.phone || '-'}</p>
                <p className="text-xl font-bold font-mono text-green-600 mt-2">
                  {(customer.credit_balance || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">ประวัติล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-gray-700">เวลา</TableHead>
                  <TableHead className="text-gray-700">ลูกค้า</TableHead>
                  <TableHead className="text-gray-700">ประเภท</TableHead>
                  <TableHead className="text-right text-gray-700">จำนวน</TableHead>
                  <TableHead className="text-right text-gray-700">ยอดคงเหลือ</TableHead>
                  <TableHead className="text-gray-700">หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const typeInfo = TYPE_LABELS[tx.type];
                  return (
                    <TableRow key={tx.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm text-gray-700">
                        {new Date(tx.created_at).toLocaleString('th-TH', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {tx.customer?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${typeInfo.color} text-white`}>
                          {typeInfo.icon}
                          <span className="ml-1">{typeInfo.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${
                        tx.type === 'withdraw' || tx.type === 'bet' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {tx.type === 'withdraw' || tx.type === 'bet' ? '-' : '+'}
                        {tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-900">
                        {tx.balance_after.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-[150px] truncate">
                        {tx.note || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Deposit Dialog */}
      <Dialog open={showDepositDialog} onOpenChange={handleCloseDepositDialog}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Plus className="size-5" />
              เติมเงิน
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Phone Search */}
            <div>
              <Label className="text-gray-700">ค้นหาลูกค้าด้วยเบอร์โทรศัพท์</Label>
              <div className="relative mt-1">
                <Input
                  type="text"
                  inputMode="tel"
                  placeholder="วางหรือพิมพ์เบอร์โทรศัพท์..."
                  value={phoneSearch}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onKeyDown={handlePhoneKeyDown}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData('text');
                    setTimeout(() => handlePhoneSearch(pastedText), 100);
                  }}
                  className="pr-20 bg-white text-black border-gray-300"
                  autoFocus
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {phoneSearch && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-gray-400 hover:text-gray-600"
                      onClick={clearPhoneSearch}
                    >
                      ล้าง
                    </Button>
                  )}
                  <Search className="size-4 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">วางเบอร์โทรศัพท์แล้วกด Enter เพื่อค้นหา</p>
            </div>

            {/* Search Loading */}
            {isSearching && (
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-center">
                <p className="text-sm text-gray-500">กำลังค้นหา...</p>
              </div>
            )}

            {/* Search Error */}
            {searchError && !isSearching && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                <p className="text-sm text-red-600">{searchError}</p>
              </div>
            )}

            {/* Found Customer */}
            {searchedCustomer && !isSearching && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-xs text-green-600 font-medium mb-2">พบลูกค้า</p>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 font-medium">
                      {searchedCustomer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{searchedCustomer.name}</p>
                    <p className="text-sm text-gray-500">{searchedCustomer.phone || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">เครดิตคงเหลือ</p>
                    <p className="text-lg font-bold font-mono text-green-600">
                      {(searchedCustomer.credit_balance || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Amount Input */}
            {searchedCustomer && (
              <>
                <div>
                  <Label className="text-gray-700">จำนวนเงิน</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    className="text-center font-mono text-2xl h-14 bg-white text-black border-gray-300 mt-1"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {quickAmounts.map((qa) => (
                      <Button
                        key={qa}
                        size="sm"
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => setAmount(qa.toString())}
                      >
                        +{qa.toLocaleString()}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700">หมายเหตุ (ไม่บังคับ)</Label>
                  <Textarea
                    placeholder="หมายเหตุ..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-white text-black border-gray-300 mt-1"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleCloseDepositDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleTransaction('deposit')}
              disabled={isSubmitting || !selectedCustomerId || !amount}
            >
              {isSubmitting ? 'กำลังบันทึก...' : `เติม ${parseInt(amount || '0').toLocaleString()} บาท`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <Minus className="size-5" />
              ถอนเงิน
            </DialogTitle>
            <DialogDescription>ถอนเครดิตจากลูกค้า</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>เลือกลูกค้า</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกลูกค้า" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({(c.credit_balance || 0).toLocaleString()} บาท)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCustomer && (
              <div className="p-3 rounded-lg bg-secondary/50 border">
                <p className="text-sm text-muted-foreground">ยอดปัจจุบัน</p>
                <p className="text-2xl font-bold font-mono text-accent">
                  {(selectedCustomer.credit_balance || 0).toLocaleString()} บาท
                </p>
              </div>
            )}

            <div>
              <Label>จำนวนเงิน</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                className="text-center font-mono text-2xl h-14"
              />
              {selectedCustomer && parseInt(amount || '0') > (selectedCustomer.credit_balance || 0) && (
                <p className="text-sm text-red-500 mt-1">ยอดไม่เพียงพอ</p>
              )}
            </div>

            <div>
              <Label>หมายเหตุ (ไม่บังคับ)</Label>
              <Textarea
                placeholder="หมายเหตุ..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleTransaction('withdraw')}
              disabled={
                isSubmitting || 
                !selectedCustomerId || 
                !amount || 
                (selectedCustomer && parseInt(amount || '0') > (selectedCustomer.credit_balance || 0))
              }
            >
              {isSubmitting ? 'กำลังบันทึก...' : `ถอน ${parseInt(amount || '0').toLocaleString()} บาท`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
