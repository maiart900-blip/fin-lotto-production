'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Wallet, 
  Building2, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Plus,
  Clock,
  Ban,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

interface CustomerData {
  id: string;
  name: string;
  credit_balance: number;
  bank_code?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  current_turnover?: number;
  required_turnover?: number;
  total_deposits?: number;
}

const BANKS: Record<string, { name: string; color: string }> = {
  kbank: { name: 'ธนาคารกสิกรไทย', color: 'bg-green-600' },
  scb: { name: 'ธนาคารไทยพาณิชย์', color: 'bg-purple-600' },
  bbl: { name: 'ธนาคารกรุงเทพ', color: 'bg-blue-800' },
  ktb: { name: 'ธนาคารกรุงไทย', color: 'bg-cyan-600' },
  bay: { name: 'ธนาคารกรุงศรี', color: 'bg-yellow-500' },
  ttb: { name: 'ธนาคารทหารไทยธนชาต', color: 'bg-blue-500' },
  gsb: { name: 'ธนาคารออมสิน', color: 'bg-pink-500' },
  baac: { name: 'ธนาคาร ธ.ก.ส.', color: 'bg-green-700' },
};

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000, 10000];

export default function CustomerWithdrawPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  const { data: customer, isLoading } = useSWR<CustomerData>('/api/customer/me', fetcher);
  const { data: withdrawHistory, mutate } = useSWR('/api/customer/withdraw', fetcher);
  const { data: settings } = useSWR('/api/settings', fetcher);
  
  const hasBank = customer?.bank_code && customer?.bank_account_number;
  const balance = customer?.credit_balance || 0;
  
  // Check if turnover is enabled from settings
  const turnoverEnabled = settings?.turnover_enabled ?? false;
  
  // Turnover calculation (only if enabled)
  const currentTurnover = customer?.current_turnover || 0;
  const requiredTurnover = turnoverEnabled ? (customer?.required_turnover || 0) : 0;
  const remainingTurnover = Math.max(0, requiredTurnover - currentTurnover);
  const turnoverProgress = requiredTurnover > 0 ? Math.min(100, (currentTurnover / requiredTurnover) * 100) : 100;
  const isTurnoverComplete = !turnoverEnabled || currentTurnover >= requiredTurnover;
  
  // Calculate locked amount from pending withdrawals
  const lockedAmount = withdrawHistory?.requests
    ?.filter((r: { status: string }) => r.status === 'pending')
    .reduce((sum: number, r: { amount: number }) => sum + Number(r.amount), 0) || 0;
  const availableBalance = balance - lockedAmount;
  
  // Maximum withdrawable amount based on turnover
  // ถ้าเทิร์นไม่ครบ: สามารถถอนได้เท่ากับยอดที่ทำเทิร์นแล้ว (currentTurnover)
  // ถ้าเทิร์นครบ: ถอนได้ทั้งหมด
  const maxWithdrawable = isTurnoverComplete 
    ? availableBalance 
    : Math.min(availableBalance, currentTurnover);

  const handleQuickAmount = (value: number) => {
    if (value <= maxWithdrawable) {
      setAmount(value.toString());
    } else if (!isTurnoverComplete) {
      toast.error(`ยอดเทิร์นไม่เพียงพอ ถอนได้สูงสุด ${maxWithdrawable.toLocaleString()} บาท`);
    } else {
      toast.error('ยอดเครดิตที่ถอนได้ไม่เพียงพอ');
    }
  };

  const handleMaxAmount = () => {
    setAmount(Math.floor(maxWithdrawable).toString());
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasBank) {
      toast.error('กรุณาผูกบัญชีธนาคารก่อนถอนเงิน');
      router.push('/c/bank-account');
      return;
    }
    
    if (!amount) {
      toast.error('กรุณากรอกจำนวนเงิน');
      return;
    }
    
    const numAmount = parseFloat(amount);
    if (numAmount < 100) {
      toast.error('ยอดถอนขั้นต่ำ 100 บาท');
      return;
    }

    if (numAmount > maxWithdrawable) {
      if (!isTurnoverComplete) {
        toast.error(`ยอดเทิร์นไม่เพียงพอ ถอนได้สูงสุด ${maxWithdrawable.toLocaleString()} บาท (ต้องเดิมพันอีก ${remainingTurnover.toLocaleString()} บาท)`);
      } else {
        toast.error(`ยอดที่ถอนได้ไม่เพียงพอ (คงเหลือ: ${availableBalance.toLocaleString()} บาท)`);
      }
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        amount: numAmount,
        bank_code: customer?.bank_code,
        bank_name: BANKS[customer?.bank_code || '']?.name || customer?.bank_code,
        account_number: customer?.bank_account_number,
        account_name: customer?.bank_account_name,
      };
      
      
      const res = await fetch('/api/customer/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('ส่งคำขอถอนเงินสำเร็จ รอแอดมินตรวจสอบ');
        setSubmitSuccess(true);
        mutate();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('[v0] Withdraw error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'รอดำเนินการ', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock };
      case 'approved':
        return { label: 'โอนแล้ว', color: 'bg-green-500/20 text-green-400', icon: Check };
      case 'rejected':
        return { label: 'ปฏิเสธ', color: 'bg-red-500/20 text-red-400', icon: Ban };
      default:
        return { label: status, color: 'bg-gray-500/20 text-gray-400', icon: Clock };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // Success State - แสดงหลังส่งคำขอสำเร็จ
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
        <Card className="bg-[#0D1321] border-green-500/30 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="size-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="size-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">แจ้งถอนสำเร็จ!</h2>
            <p className="text-white/60 mb-6">
              รายการของคุณถูกส่งเรียบร้อยแล้ว<br/>
              กรุณารอแอดมินตรวจสอบและโอนเงิน
            </p>
            <div className="space-y-3">
              <Link href="/c/wallet">
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  กลับหน้ากระเป๋าเงิน
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setSubmitSuccess(false);
                  setAmount('');
                }}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                แจ้งถอนเงินอีกครั้ง
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white pb-20">
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/c/wallet">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">ถอนเงิน</h1>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-r from-red-600 to-red-700 border-0 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <Wallet className="size-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white/70">ยอดเครดิตคงเหลือ</p>
                <p className="text-3xl font-bold font-mono">
                  {balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </p>
                {lockedAmount > 0 && (
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className="text-white/70">ล็อคถอน: <span className="text-yellow-300 font-mono">{lockedAmount.toLocaleString()}</span></span>
                    <span className="text-white/70">|</span>
                    <span className="text-white/70">ถอนได้: <span className="text-green-300 font-mono">{maxWithdrawable.toLocaleString()}</span></span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Turnover Status Card */}
        {requiredTurnover > 0 && (
          <Card className={`border-0 overflow-hidden ${isTurnoverComplete ? 'bg-green-900/30 border-green-500/30' : 'bg-amber-900/30 border-amber-500/30'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isTurnoverComplete ? (
                    <CheckCircle className="size-5 text-green-400" />
                  ) : (
                    <AlertCircle className="size-5 text-amber-400" />
                  )}
                  <span className="font-medium text-white">
                    {isTurnoverComplete ? 'เทิร์นโอเวอร์ครบแล้ว' : 'ยอดเทิร์นโอเวอร์'}
                  </span>
                </div>
                <span className={`text-sm font-mono ${isTurnoverComplete ? 'text-green-400' : 'text-amber-400'}`}>
                  {turnoverProgress.toFixed(0)}%
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full transition-all duration-500 ${isTurnoverComplete ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${turnoverProgress}%` }}
                />
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-white/60">
                  เดิมพันแล้ว: <span className="text-white font-mono">{currentTurnover.toLocaleString()}</span>
                </span>
                <span className="text-white/60">
                  เป้าหมาย: <span className="text-white font-mono">{requiredTurnover.toLocaleString()}</span>
                </span>
              </div>
              
              {!isTurnoverComplete && (
                <div className="mt-3 p-3 bg-amber-500/10 rounded-lg">
                  <p className="text-amber-400 text-sm">
                    ต้องเดิมพันอีก <span className="font-bold font-mono">{remainingTurnover.toLocaleString()}</span> บาท จึงจะถอนได้เต็มจำนวน
                  </p>
                  <p className="text-amber-400/70 text-xs mt-1">
                    ถอนได้สูงสุดตอนนี้: <span className="font-mono">{maxWithdrawable.toLocaleString()}</span> บาท
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bank Account Section */}
        {!hasBank ? (
          <Card className="bg-[#0D1321] border-amber-500/30">
            <CardContent className="p-6 text-center">
              <div className="size-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Building2 className="size-8 text-amber-400" />
              </div>
              <h3 className="font-bold text-lg mb-2">ยังไม่มีบัญชีผูกไว้</h3>
              <p className="text-[#94A3B8] text-sm mb-4">
                กรุณาผูกบัญชีธนาคารก่อนทำรายการถอนเงิน
              </p>
              <Link href="/c/bank-account">
                <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  <Plus className="size-4 mr-2" />
                  ผูกบัญชีธนาคาร
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Linked Bank Account */}
            <Card className="bg-[#0D1321] border-green-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2 text-[#94A3B8]">
                    <CheckCircle className="size-4 text-green-400" />
                    บัญชีที่จะรับเงิน
                  </CardTitle>
                  <Link href="/c/bank-account">
                    <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 text-xs">
                      แก้ไข
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0A0F1C]">
                  <div className={`size-12 rounded-xl ${BANKS[customer.bank_code || '']?.color || 'bg-gray-500'} flex items-center justify-center`}>
                    <Building2 className="size-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{BANKS[customer.bank_code || '']?.name}</p>
                    <p className="font-mono text-amber-400">{customer.bank_account_number}</p>
                    <p className="text-xs text-[#64748B]">{customer.bank_account_name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Withdraw Form */}
            <Card className="bg-[#0D1321] border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Wallet className="size-5 text-red-400" />
                  กรอกจำนวนเงิน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-[#0A0F1C] border-white/10 text-white text-center text-3xl font-mono h-16 pr-16"
                        min="100"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B]">บาท</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <p className="text-xs text-[#64748B]">ขั้นต่ำ 100 บาท</p>
                      <button 
                        type="button"
                        onClick={handleMaxAmount}
                        className="text-xs text-amber-400 hover:text-amber-300"
                      >
                        ถอนทั้งหมด
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Amounts */}
                  <div>
                    <Label className="text-[#94A3B8] text-sm mb-2 block">เลือกจำนวน</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {QUICK_AMOUNTS.map((val) => (
                        <Button
                          key={val}
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickAmount(val)}
                          disabled={val > maxWithdrawable}
                          className={`border-white/10 ${
                            amount === val.toString() 
                              ? 'bg-amber-500 text-black border-amber-500' 
                              : 'text-white hover:bg-white/10'
                          } disabled:opacity-30`}
                        >
                          {val.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Warning */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex gap-2">
                    <AlertCircle className="size-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-yellow-400 space-y-1">
                      <p>ถอนขั้นต่ำ 100 บาท ไม่มีค่าธรรมเนียม</p>
                      <p>โอนเงินภายใน 5-15 นาที (ช่วงเวลาทำการ)</p>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-lg"
                    disabled={isSubmitting || !amount}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-5 mr-2 animate-spin" />
                        กำลังส่งคำขอ...
                      </>
                    ) : (
                      'ยืนยันถอนเงิน'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}

        {/* History */}
        <Card className="bg-[#0D1321] border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Clock className="size-4 text-[#64748B]" />
              ประวัติการถอน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawHistory?.requests?.length > 0 ? (
              <div className="space-y-3">
                {withdrawHistory.requests.slice(0, 5).map((req: { 
                  id: string; 
                  amount: number; 
                  status: string; 
                  bank_name: string; 
                  account_number: string; 
                  created_at: string 
                }) => {
                  const statusInfo = getStatusInfo(req.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div key={req.id} className="bg-[#0A0F1C] rounded-xl p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-xl font-mono text-white">
                            {Number(req.amount).toLocaleString()} <span className="text-sm font-normal text-[#64748B]">บาท</span>
                          </p>
                          <p className="text-sm text-[#64748B] mt-1">{req.bank_name}</p>
                          <p className="text-xs text-[#475569] mt-1">
                            {new Date(req.created_at).toLocaleString('th-TH', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${statusInfo.color}`}>
                          <StatusIcon className="size-3.5" />
                          <span className="text-xs font-medium">{statusInfo.label}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-[#64748B] py-8">ยังไม่มีประวัติการถอน</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
