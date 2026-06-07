'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Shield,
  TrendingUp,
  Lock,
  Unlock,
  Info,
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
      console.error('Withdraw error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'รอดำเนินการ', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock };
      case 'approved':
        return { label: 'โอนแล้ว', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Check };
      case 'rejected':
        return { label: 'ปฏิเสธ', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Ban };
      default:
        return { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black premium-bg-pattern flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  // Success State
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-black premium-bg-pattern flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-green-500/10 rounded-full blur-[100px]" />
        </div>
        
        <div className="glass-card-gold max-w-md w-full p-8 text-center relative z-10">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">แจ้งถอนสำเร็จ!</h2>
          <p className="text-neutral-400 mb-6">
            รายการของคุณถูกส่งเรียบร้อยแล้ว<br/>
            กรุณารอแอดมินตรวจสอบและโอนเงิน
          </p>
          <div className="space-y-3">
            <Link href="/c/wallet">
              <Button className="w-full h-12 btn-luxury">
                กลับหน้ากระเป๋าเงิน
              </Button>
            </Link>
            <Button
              onClick={() => {
                setSubmitSuccess(false);
                setAmount('');
              }}
              variant="outline"
              className="w-full h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              แจ้งถอนเงินอีกครั้ง
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black premium-bg-pattern pb-24">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-40 left-0 w-[300px] h-[300px] bg-amber-600/3 rounded-full blur-[80px]" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-amber-500/20">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/c/wallet">
            <Button variant="ghost" size="icon" className="text-amber-400 hover:bg-amber-500/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-400" />
            ถอนเงิน
          </h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 relative z-10">
        {/* Balance Card */}
        <div className="glass-card overflow-hidden">
          <div className="bg-gradient-to-r from-red-600/20 to-red-700/20 p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/30 to-red-600/20 border border-red-500/40 flex items-center justify-center">
                <Wallet className="w-7 h-7 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-neutral-400">ยอดเครดิตคงเหลือ</p>
                <p className="text-3xl font-bold text-white font-mono">
                  {balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </p>
                {lockedAmount > 0 && (
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Lock className="w-3 h-3" />
                      ล็อค: {lockedAmount.toLocaleString()}
                    </span>
                    <span className="text-neutral-500">|</span>
                    <span className="flex items-center gap-1 text-green-400">
                      <Unlock className="w-3 h-3" />
                      ถอนได้: {maxWithdrawable.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Turnover Status Card */}
        {requiredTurnover > 0 && (
          <div className={`glass-card overflow-hidden ${isTurnoverComplete ? 'border-green-500/30' : 'border-amber-500/30'}`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isTurnoverComplete ? (
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-amber-400" />
                    </div>
                  )}
                  <span className="font-medium text-white">
                    {isTurnoverComplete ? 'เทิร์นโอเวอร์ครบแล้ว' : 'ยอดเทิร์นโอเวอร์'}
                  </span>
                </div>
                <Badge className={isTurnoverComplete ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}>
                  {turnoverProgress.toFixed(0)}%
                </Badge>
              </div>
              
              {/* Progress Bar */}
              <div className="h-3 bg-neutral-800 rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full transition-all duration-500 ${isTurnoverComplete ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                  style={{ width: `${turnoverProgress}%` }}
                />
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">
                  เดิมพันแล้ว: <span className="text-white font-mono">{currentTurnover.toLocaleString()}</span>
                </span>
                <span className="text-neutral-400">
                  เป้าหมาย: <span className="text-white font-mono">{requiredTurnover.toLocaleString()}</span>
                </span>
              </div>
              
              {!isTurnoverComplete && (
                <div className="mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-400 text-sm">
                        ต้องเดิมพันอีก <span className="font-bold font-mono">{remainingTurnover.toLocaleString()}</span> บาท จึงจะถอนได้เต็มจำนวน
                      </p>
                      <p className="text-amber-400/70 text-xs mt-1">
                        ถอนได้สูงสุดตอนนี้: <span className="font-mono">{maxWithdrawable.toLocaleString()}</span> บาท
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bank Account Section */}
        {!hasBank ? (
          <div className="glass-card p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">ยังไม่มีบัญชีผูกไว้</h3>
            <p className="text-neutral-400 text-sm mb-4">
              กรุณาผูกบัญชีธนาคารก่อนทำรายการถอนเงิน
            </p>
            <Link href="/c/bank-account">
              <Button className="btn-luxury">
                <Plus className="w-4 h-4 mr-2" />
                ผูกบัญชีธนาคาร
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Linked Bank Account */}
            <div className="glass-card overflow-hidden border-green-500/20">
              <div className="p-4 border-b border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-sm">บัญชีที่จะรับเงิน</span>
                  </div>
                  <Link href="/c/bank-account">
                    <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 text-xs">
                      แก้ไข
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/50">
                  <div className={`w-12 h-12 rounded-xl ${BANKS[customer.bank_code || '']?.color || 'bg-gray-500'} flex items-center justify-center`}>
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{BANKS[customer.bank_code || '']?.name}</p>
                    <p className="font-mono text-amber-400">{customer.bank_account_number}</p>
                    <p className="text-xs text-neutral-500">{customer.bank_account_name}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Withdraw Form */}
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-red-400" />
                  <span className="font-semibold text-white">กรอกจำนวนเงิน</span>
                </div>
              </div>
              <div className="p-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-neutral-800/50 border-neutral-700 text-white text-center text-3xl font-mono h-16 pr-16 input-premium"
                        min="100"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500">บาท</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <p className="text-xs text-neutral-500">ขั้นต่ำ 100 บาท</p>
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
                    <p className="text-neutral-400 text-sm mb-2">เลือกจำนวน</p>
                    <div className="grid grid-cols-3 gap-2">
                      {QUICK_AMOUNTS.map((val) => (
                        <Button
                          key={val}
                          type="button"
                          variant="outline"
                          onClick={() => handleQuickAmount(val)}
                          disabled={val > maxWithdrawable}
                          className={`${
                            amount === val.toString() 
                              ? 'bg-amber-500 text-black border-amber-500' 
                              : 'bg-neutral-800/50 border-neutral-700 text-white hover:bg-neutral-700'
                          } disabled:opacity-30`}
                        >
                          {val.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Warning */}
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-400 space-y-1">
                      <p>ถอนขั้นต่ำ 100 บาท ไม่มีค่าธรรมเนียม</p>
                      <p>โอนเงินภายใน 5-15 นาที (ช่วงเวลาทำการ)</p>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-14 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-lg"
                    disabled={isSubmitting || !amount}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        กำลังส่งคำขอ...
                      </>
                    ) : (
                      'ยืนยันถอนเงิน'
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* History */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-400" />
              <span className="font-medium text-white">ประวัติการถอน</span>
            </div>
          </div>
          <div className="p-4">
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
                    <div key={req.id} className="bg-neutral-800/50 rounded-xl p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusInfo.color.split(' ')[0]}`}>
                            <StatusIcon className={`w-5 h-5 ${statusInfo.color.split(' ')[1]}`} />
                          </div>
                          <div>
                            <p className="font-bold text-xl font-mono text-white">
                              {Number(req.amount).toLocaleString()} <span className="text-sm font-normal text-neutral-500">บาท</span>
                            </p>
                            <p className="text-sm text-neutral-500 mt-1">{req.bank_name}</p>
                            <p className="text-xs text-neutral-600 mt-1">
                              {new Date(req.created_at).toLocaleString('th-TH', {
                                day: '2-digit',
                                month: 'short',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                        <Badge className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto text-neutral-600 mb-2" />
                <p className="text-neutral-500">ยังไม่มีประวัติการถอน</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
