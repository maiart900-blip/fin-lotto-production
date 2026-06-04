'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Banknote,
  Upload,
  Building2,
  QrCode,
  Copy,
  ImageIcon,
  X,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Sparkles,
  Shield,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import Link from 'next/link';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

interface TopupRequest {
  id: string;
  amount: number;
  bank_name: string;
  slip_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string;
}

interface PaymentAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string | null;
  promptpay_number: string | null;
  qr_image_url: string | null;
  is_active: boolean;
  display_mode?: 'qr_only' | 'qr_with_bank' | 'bank_only';
  qr_mode?: 'upload' | 'merchant_id' | 'promptpay';
}

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  credit_balance: number;
}

const BANK_LABELS: Record<string, string> = {
  'kbank': 'กสิกรไทย',
  'scb': 'ไทยพาณิชย์',
  'bbl': 'กรุงเทพ',
  'ktb': 'กรุงไทย',
  'bay': 'กรุงศรี',
  'ttb': 'ทหารไทยธนชาต',
  'gsb': 'ออมสิน',
  'baac': 'ธ.ก.ส.',
  'promptpay': 'พร้อมเพย์',
  'truemoney': 'ทรูมันนี่',
  'qr_promptpay': 'QR พร้อมเพย์',
  'scb_maemani': 'SCB แม่มณี',
};

const QUICK_AMOUNTS = [100, 300, 500, 1000, 2000, 5000];

const statusConfig = {
  pending: { label: 'รอตรวจสอบ', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
};

export default function CustomerTopupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Data Fetching
  const { data: customer, error: customerError } = useSWR<CustomerData>(
    '/api/customer/me',
    fetcher
  );
  
  const { data: accounts = [], isLoading: loadingAccounts } = useSWR<PaymentAccount[]>(
    '/api/payment-accounts?active=true',
    fetcher,
    { fallbackData: [] }
  );
  
  const { data: history = [], mutate: mutateHistory } = useSWR<TopupRequest[]>(
    '/api/customer/topup',
    fetcher,
    { fallbackData: [] }
  );

  // Handle unauthorized
  if (customerError?.message === 'UNAUTHORIZED') {
    router.push('/c/login');
    return null;
  }

  const getBankLabel = (code: string) => BANK_LABELS[code] || code;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  // Handle slip file selection
  const handleSlipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }

    setSlipFile(file);
    const reader = new FileReader();
    reader.onload = () => setSlipPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeSlip = () => {
    setSlipFile(null);
    setSlipPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit topup request
  const handleSubmit = async () => {
    // Validation
    if (!customer) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      router.push('/c/login');
      return;
    }
    if (!selectedAccount) {
      toast.error('กรุณาเลือกบัญชีรับเงิน');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }
    if (!slipFile) {
      toast.error('กรุณาแนบสลิปการโอนเงิน');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Upload slip
      setUploadingSlip(true);
      const formData = new FormData();
      formData.append('file', slipFile);
      
      const uploadRes = await fetch('/api/customer/upload-slip', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'อัพโหลดสลิปไม่สำเร็จ');
      }
      
      const { url: slipUrl } = await uploadRes.json();
      setUploadingSlip(false);

      // 2. Submit topup request
      const payload = {
        amount: parseFloat(amount),
        payment_account_id: selectedAccount.id,
        bank_name: selectedAccount.bank_name,
        slip_url: slipUrl,
      };
      
      const res = await fetch('/api/customer/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || 'แจ้งเติมเงินไม่สำเร็จ');
      }

      toast.success('แจ้งเติมเงินสำเร็จ รอแอดมินตรวจสอบ');
      
      // Show success state
      setSubmitSuccess(true);
      mutateHistory();

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
      setUploadingSlip(false);
    }
  };

  const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url || url.trim() === '') return false;
    if (url.includes('localhost') || url.includes('example.com')) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

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
          <h2 className="text-2xl font-bold text-white mb-2">แจ้งฝากสำเร็จ!</h2>
          <p className="text-neutral-400 mb-6">
            รายการของคุณถูกส่งเรียบร้อยแล้ว<br/>
            กรุณารอแอดมินตรวจสอบ
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => {
                setSubmitSuccess(false);
                setSelectedAccount(null);
                setAmount('');
                removeSlip();
                setShowHistory(true);
              }}
              className="w-full h-12 btn-luxury"
            >
              ดูประวัติรายการ
            </Button>
            <Button
              onClick={() => {
                setSubmitSuccess(false);
                setSelectedAccount(null);
                setAmount('');
                removeSlip();
              }}
              variant="outline"
              className="w-full h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              แจ้งฝากเงินอีกครั้ง
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
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-40 left-0 w-[300px] h-[300px] bg-amber-600/3 rounded-full blur-[80px]" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-amber-500/20">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/c">
            <Button variant="ghost" size="icon" className="text-amber-400 hover:bg-amber-500/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            เติมเงินอัตโนมัติ
          </h1>
          <div className="w-10" />
        </div>
      </div>
        
      {/* Credit Balance Card */}
      <div className="px-4 pt-4">
        <div className="glass-card-gold p-4 glow-pulse">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/40 flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-neutral-400">เครดิตคงเหลือ</p>
              <p className="text-2xl font-bold gold-amount">
                {customer?.credit_balance?.toLocaleString() || '0'} <span className="text-sm font-normal text-neutral-400">บาท</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 relative z-10">
        {/* Step 1: เลือกบัญชีรับเงิน */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-amber-500/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-black flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="font-semibold text-white">เลือกบัญชีรับเงิน</h2>
          </div>
          <div className="p-4">
            {loadingAccounts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 text-neutral-400">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>ยังไม่มีบัญชีรับเงิน</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      setSelectedAccount(account);
                      setQrImageError(false);
                    }}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      selectedAccount?.id === account.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        selectedAccount?.id === account.id ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-neutral-700'
                      }`}>
                        {account.qr_image_url ? (
                          <QrCode className={`w-5 h-5 ${selectedAccount?.id === account.id ? 'text-black' : 'text-neutral-300'}`} />
                        ) : (
                          <Building2 className={`w-5 h-5 ${selectedAccount?.id === account.id ? 'text-black' : 'text-neutral-300'}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{account.account_name}</p>
                        <p className="text-sm text-neutral-400">{getBankLabel(account.bank_name)}</p>
                        {account.display_mode !== 'qr_only' && account.account_number && (
                          <p className="text-xs text-neutral-500 font-mono mt-1">{account.account_number}</p>
                        )}
                      </div>
                      {selectedAccount?.id === account.id && (
                        <Check className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: กรอกจำนวนเงิน */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-amber-500/20 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              selectedAccount ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-black' : 'bg-neutral-700 text-neutral-400'
            }`}>2</div>
            <h2 className={`font-semibold ${selectedAccount ? 'text-white' : 'text-neutral-500'}`}>กรอกจำนวนเงิน</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="pl-11 pr-12 h-14 text-2xl font-bold text-center bg-neutral-800/50 border-neutral-700 text-white input-premium"
                disabled={!selectedAccount}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">บาท</span>
            </div>
            
            {/* Quick Amounts */}
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(quickAmount.toString())}
                  disabled={!selectedAccount}
                  className={`h-10 ${
                    amount === quickAmount.toString()
                      ? 'bg-amber-500 text-black border-amber-500 hover:bg-amber-600'
                      : 'bg-neutral-800/50 border-neutral-700 text-white hover:bg-neutral-700'
                  }`}
                >
                  {quickAmount.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 3: แสดง QR Code */}
        {selectedAccount && amount && parseFloat(amount) > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-amber-500/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-black flex items-center justify-center text-sm font-bold">3</div>
              <h2 className="font-semibold text-white">สแกน QR / โอนเงิน</h2>
            </div>
            <div className="p-4">
              <div className="flex flex-col items-center">
                {/* QR Error Alert */}
                {qrImageError && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-amber-400" />
                      <span className="text-sm text-amber-400">QR โหลดไม่สำเร็จ - ใช้ข้อมูลด้านล่างแทน</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 px-2 text-amber-400 hover:text-amber-300"
                      onClick={() => setQrImageError(false)}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {/* QR Code Display */}
                {(() => {
                  const hasValidQrUrl = selectedAccount.qr_image_url && isValidUrl(selectedAccount.qr_image_url);
                  const qrMode = selectedAccount.qr_mode || 'upload';

                  if (qrImageError || !hasValidQrUrl) {
                    return (
                      <div className="w-64 h-48 bg-gradient-to-b from-neutral-800 to-neutral-900 rounded-xl flex flex-col items-center justify-center p-4 border border-neutral-700">
                        <Building2 className="w-10 h-10 text-amber-400 mb-3" />
                        <p className="text-sm font-medium text-white text-center">โอนเงินตามข้อมูลด้านล่าง</p>
                        {qrMode === 'upload' && !selectedAccount.qr_image_url && (
                          <p className="text-xs text-neutral-500 mt-1">ยังไม่ได้อัปโหลด QR</p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="bg-white p-4 rounded-xl shadow-lg shadow-amber-500/10">
                      <img
                        src={selectedAccount.qr_image_url!}
                        alt="QR Code"
                        className="w-56 h-56 object-contain"
                        onError={() => setQrImageError(true)}
                      />
                    </div>
                  );
                })()}

                {/* Account Info */}
                <div className="mt-4 w-full space-y-3">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">{selectedAccount.account_name}</p>
                    {selectedAccount.display_mode !== 'qr_only' && (
                      <p className="text-sm text-neutral-400">{getBankLabel(selectedAccount.bank_name)}</p>
                    )}
                  </div>

                  {/* Account Number - Copyable */}
                  {selectedAccount.display_mode !== 'qr_only' && selectedAccount.account_number && (
                    <button
                      onClick={() => copyToClipboard(selectedAccount.account_number!)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 transition-colors border border-neutral-700"
                    >
                      <span className="text-lg font-mono text-white">{selectedAccount.account_number}</span>
                      <Copy className="w-4 h-4 text-amber-400" />
                    </button>
                  )}

                  {/* Amount to transfer */}
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                    <p className="text-sm text-amber-400 mb-1">จำนวนเงินที่ต้องโอน</p>
                    <p className="text-2xl font-bold gold-amount">{parseFloat(amount).toLocaleString()} บาท</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: แนบสลิป */}
        {selectedAccount && amount && parseFloat(amount) > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-amber-500/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-black flex items-center justify-center text-sm font-bold">4</div>
              <h2 className="font-semibold text-white">แนบสลิปการโอนเงิน</h2>
            </div>
            <div className="p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleSlipSelect}
                className="hidden"
              />

              {!slipPreview ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 rounded-xl border-2 border-dashed border-amber-500/30 hover:border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 transition-all flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-amber-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">อัพโหลดสลิป</p>
                    <p className="text-xs text-neutral-500 mt-1">รองรับ JPG, PNG, WEBP (สูงสุด 5MB)</p>
                  </div>
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={slipPreview} alt="Slip Preview" className="w-full max-h-64 object-contain bg-neutral-900" />
                  <button
                    onClick={removeSlip}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        {selectedAccount && amount && parseFloat(amount) > 0 && (
          <Button
            onClick={handleSubmit}
            disabled={submitting || !slipFile}
            className="w-full h-14 btn-luxury text-lg"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {uploadingSlip ? 'กำลังอัพโหลดสลิป...' : 'กำลังส่งคำขอ...'}
              </>
            ) : (
              <>
                <Shield className="w-5 h-5 mr-2" />
                ยืนยันแจ้งฝากเงิน
              </>
            )}
          </Button>
        )}

        {/* History Section */}
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-neutral-400" />
              <span className="font-medium text-white">ประวัติการเติมเงิน</span>
              {history.length > 0 && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  {history.length} รายการ
                </Badge>
              )}
            </div>
            {showHistory ? (
              <ChevronUp className="w-5 h-5 text-neutral-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-neutral-400" />
            )}
          </button>
          
          {showHistory && (
            <div className="border-t border-neutral-800">
              {history.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>ยังไม่มีประวัติการเติมเงิน</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {history.slice(0, 5).map((req) => {
                    const status = statusConfig[req.status];
                    const StatusIcon = status.icon;
                    return (
                      <div key={req.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status.color.split(' ')[0]}`}>
                              <StatusIcon className={`w-5 h-5 ${status.color.split(' ')[1]}`} />
                            </div>
                            <div>
                              <p className="font-bold text-white">
                                {Number(req.amount).toLocaleString()} <span className="text-sm font-normal text-neutral-400">บาท</span>
                              </p>
                              <p className="text-xs text-neutral-500">
                                {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: th })}
                              </p>
                            </div>
                          </div>
                          <Badge className={`${status.color}`}>
                            {status.label}
                          </Badge>
                        </div>
                        {req.status === 'rejected' && req.reject_reason && (
                          <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-xs text-red-400">เหตุผล: {req.reject_reason}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
