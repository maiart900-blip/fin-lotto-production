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
  Smartphone,
  ImageIcon,
  X,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

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
  pending: { label: 'รอตรวจสอบ', color: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-green-500/10 text-green-500', icon: CheckCircle },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-500/10 text-red-500', icon: XCircle },
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

  // Success State - แสดงหลังส่งคำขอสำเร็จ
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
        <Card className="bg-[#0D1321] border-green-500/30 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="size-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="size-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">แจ้งฝากสำเร็จ!</h2>
            <p className="text-white/60 mb-6">
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
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
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
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                แจ้งฝากเงินอีกครั้ง
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1a1f35] to-[#0A0F1C] px-4 py-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">เติมเงิน</h1>
          <p className="text-sm text-white/60 mt-1">เลือกบัญชี กรอกยอด แนบสลิป ครบจบในหน้าเดียว</p>
        </div>
        
        {/* Credit Balance */}
        <Card className="mt-4 bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <CreditCard className="size-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-white/60">เครดิตคงเหลือ</p>
                  <p className="text-xl font-bold text-amber-400">
                    {customer?.credit_balance?.toLocaleString() || '0'} <span className="text-sm">บาท</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 space-y-4">
        {/* Step 1: เลือกบัญชีรับเงิน */}
        <Card className="bg-[#0D1321] border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <div className="size-8 rounded-full bg-amber-500 text-black flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="font-semibold text-white">เลือกบัญชีรับเงิน</h2>
          </div>
          <CardContent className="p-4">
            {loadingAccounts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-amber-400" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <Building2 className="size-12 mx-auto mb-2 opacity-50" />
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
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-lg flex items-center justify-center ${
                        selectedAccount?.id === account.id ? 'bg-amber-500' : 'bg-white/10'
                      }`}>
                        {account.qr_image_url ? (
                          <QrCode className={`size-5 ${selectedAccount?.id === account.id ? 'text-black' : 'text-white/70'}`} />
                        ) : (
                          <Building2 className={`size-5 ${selectedAccount?.id === account.id ? 'text-black' : 'text-white/70'}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-white">{account.account_name}</p>
                        <p className="text-sm text-white/60">{getBankLabel(account.bank_name)}</p>
                        {account.display_mode !== 'qr_only' && account.account_number && (
                          <p className="text-xs text-white/40 font-mono mt-1">{account.account_number}</p>
                        )}
                      </div>
                      {selectedAccount?.id === account.id && (
                        <Check className="size-5 text-amber-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: กรอกจำนวนเงิน */}
        <Card className="bg-[#0D1321] border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <div className={`size-8 rounded-full flex items-center justify-center text-sm font-bold ${
              selectedAccount ? 'bg-amber-500 text-black' : 'bg-white/20 text-white/60'
            }`}>2</div>
            <h2 className={`font-semibold ${selectedAccount ? 'text-white' : 'text-white/60'}`}>กรอกจำนวนเงิน</h2>
          </div>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-amber-400" />
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="pl-11 pr-12 h-14 text-2xl font-bold text-center bg-white/5 border-white/10 text-white"
                  disabled={!selectedAccount}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60">บาท</span>
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
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    {quickAmount.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: แสดง QR Code */}
        {selectedAccount && amount && parseFloat(amount) > 0 && (
          <Card className="bg-[#0D1321] border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <div className="size-8 rounded-full bg-amber-500 text-black flex items-center justify-center text-sm font-bold">3</div>
              <h2 className="font-semibold text-white">สแกน QR / โอนเงิน</h2>
            </div>
            <CardContent className="p-4">
              <div className="flex flex-col items-center">
                {/* QR Error Alert - แสดงเล็กๆ ไม่บังหน้า */}
                {qrImageError && (
                  <div className="w-full mb-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <QrCode className="size-4 text-amber-400" />
                      <span className="text-sm text-amber-400">QR โหลดไม่สำเร็จ - ใช้ข้อมูลด้านล่างแทน</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 px-2 text-amber-400 hover:text-amber-300"
                      onClick={() => {
                        setQrImageError(false);
                      }}
                    >
                      <RefreshCw className="size-3" />
                    </Button>
                  </div>
                )}

                {/* QR Code Display - แสดงตาม qr_mode */}
                {(() => {
                  const hasValidQrUrl = selectedAccount.qr_image_url && isValidUrl(selectedAccount.qr_image_url);
                  const qrMode = selectedAccount.qr_mode || 'upload';

                  // ถ้า qrImageError หรือไม่มี QR URL ที่ valid
                  if (qrImageError || !hasValidQrUrl) {
                    // Fallback: แสดงข้อมูลบัญชีแทน QR
                    return (
                      <div className="w-64 h-48 bg-gradient-to-b from-white/10 to-white/5 rounded-xl flex flex-col items-center justify-center p-4 border border-white/10">
                        <Building2 className="size-10 text-amber-400 mb-3" />
                        <p className="text-sm font-medium text-white text-center">โอนเงินตามข้อมูลด้านล่าง</p>
                        {qrMode === 'upload' && !selectedAccount.qr_image_url && (
                          <p className="text-xs text-white/50 mt-1">ยังไม่ได้อัปโหลด QR</p>
                        )}
                        {qrMode === 'merchant_id' && (
                          <p className="text-xs text-white/50 mt-1">Merchant ID ยังไม่พร้อม</p>
                        )}
                        {qrMode === 'promptpay' && !selectedAccount.promptpay_number && (
                          <p className="text-xs text-white/50 mt-1">ยังไม่ได้ตั้งค่า PromptPay</p>
                        )}
                      </div>
                    );
                  }

                  // แสดง QR ปกติ
                  return (
                    <div className="bg-white p-4 rounded-xl">
                      <img
                        src={selectedAccount.qr_image_url!}
                        alt="QR Code"
                        className="w-56 h-56 object-contain"
                        onError={() => {
                          console.error('[v0] QR image load failed:', {
                            url: selectedAccount.qr_image_url,
                            qr_mode: selectedAccount.qr_mode,
                          });
                          setQrImageError(true);
                        }}
                      />
                    </div>
                  );
                })()}

                {/* Account Info */}
                <div className="mt-4 w-full space-y-3">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">{selectedAccount.account_name}</p>
                    {selectedAccount.display_mode !== 'qr_only' && (
                      <p className="text-sm text-white/60">{getBankLabel(selectedAccount.bank_name)}</p>
                    )}
                  </div>

                  {/* Account Number */}
                  {selectedAccount.display_mode !== 'qr_only' && selectedAccount.account_number && (
                    <button
                      onClick={() => copyToClipboard(selectedAccount.account_number!)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <span className="text-lg font-mono text-white">{selectedAccount.account_number}</span>
                      <Copy className="size-4 text-white/60" />
                    </button>
                  )}

                  {/* PromptPay Number */}
                  {selectedAccount.display_mode !== 'qr_only' && selectedAccount.promptpay_number && (
                    <button
                      onClick={() => copyToClipboard(selectedAccount.promptpay_number!)}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                    >
                      <Smartphone className="size-4 text-blue-400" />
                      <span className="font-mono text-blue-400">{selectedAccount.promptpay_number}</span>
                      <Copy className="size-4 text-blue-400/60" />
                    </button>
                  )}

                  {/* Amount to transfer */}
                  <button
                    onClick={() => copyToClipboard(amount)}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors"
                  >
                    <Banknote className="size-5 text-green-400" />
                    <span className="text-xl font-bold text-green-400">
                      {parseFloat(amount).toLocaleString()} บาท
                    </span>
                    <Copy className="size-4 text-green-400/60" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: แนบสลิป */}
        <Card className="bg-[#0D1321] border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <div className={`size-8 rounded-full flex items-center justify-center text-sm font-bold ${
              selectedAccount && amount && parseFloat(amount) > 0 ? 'bg-amber-500 text-black' : 'bg-white/20 text-white/60'
            }`}>4</div>
            <h2 className={`font-semibold ${
              selectedAccount && amount && parseFloat(amount) > 0 ? 'text-white' : 'text-white/60'
            }`}>แนบสลิปการโอนเงิน</h2>
          </div>
          <CardContent className="p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleSlipSelect}
              className="hidden"
            />
            
            {slipPreview ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border-2 border-green-500/30">
                  <img
                    src={slipPreview}
                    alt="Slip preview"
                    className="w-full max-h-64 object-contain bg-black/50"
                  />
                  <button
                    onClick={removeSlip}
                    className="absolute top-2 right-2 size-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="size-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-green-500/90 text-white text-xs flex items-center gap-1">
                    <Check className="size-3" />
                    แนบสลิปแล้ว
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  <RefreshCw className="size-4 mr-2" />
                  เปลี่ยนสลิป
                </Button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedAccount || !amount || parseFloat(amount) <= 0}
                className={`w-full p-8 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center gap-3 ${
                  selectedAccount && amount && parseFloat(amount) > 0
                    ? 'border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer'
                    : 'border-white/10 bg-white/5 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <ImageIcon className="size-6 text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-white">กดเพื่อแนบสลิป</p>
                  <p className="text-xs text-white/60 mt-1">รองรับ JPG, PNG, WEBP (สูงสุด 5MB)</p>
                </div>
              </button>
            )}
          </CardContent>
        </Card>

        {/* Step 5: ปุ่มแจ้งเติมเงิน */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !selectedAccount || !amount || parseFloat(amount) <= 0 || !slipFile}
          className="w-full h-14 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold text-lg rounded-xl shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 mr-2 animate-spin" />
              {uploadingSlip ? 'กำลังอัพโหลดสลิป...' : 'กำลังส่งรายการ...'}
            </>
          ) : (
            <>
              <Upload className="size-5 mr-2" />
              แจ้งเติมเงิน
            </>
          )}
        </Button>

        {/* Checklist */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-white/60 mb-2">ตรวจสอบก่อนแจ้งเติมเงิน:</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              {selectedAccount ? (
                <Check className="size-3 text-green-400" />
              ) : (
                <div className="size-3 rounded-full border border-white/30" />
              )}
              <span className={selectedAccount ? 'text-green-400' : 'text-white/40'}>เลือกบัญชีแล้ว</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {amount && parseFloat(amount) > 0 ? (
                <Check className="size-3 text-green-400" />
              ) : (
                <div className="size-3 rounded-full border border-white/30" />
              )}
              <span className={amount && parseFloat(amount) > 0 ? 'text-green-400' : 'text-white/40'}>กรอกจำนวนเงินแล้ว</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {slipFile ? (
                <Check className="size-3 text-green-400" />
              ) : (
                <div className="size-3 rounded-full border border-white/30" />
              )}
              <span className={slipFile ? 'text-green-400' : 'text-white/40'}>แนบสลิปแล้ว</span>
            </div>
          </div>
        </div>

        {/* History Section */}
        <Card className="bg-[#0D1321] border-white/10 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Clock className="size-5 text-white/60" />
              <span className="font-medium text-white">ประวัติการเติมเงิน</span>
              {history.filter(h => h.status === 'pending').length > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  {history.filter(h => h.status === 'pending').length} รอตรวจสอบ
                </Badge>
              )}
            </div>
            {showHistory ? (
              <ChevronUp className="size-5 text-white/60" />
            ) : (
              <ChevronDown className="size-5 text-white/60" />
            )}
          </button>
          
          {showHistory && (
            <CardContent className="p-4 pt-0 border-t border-white/10">
              {history.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  <Clock className="size-12 mx-auto mb-2 opacity-50" />
                  <p>ยังไม่มีประวัติการเติมเงิน</p>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {history.slice(0, 10).map((item) => {
                    const status = statusConfig[item.status];
                    const StatusIcon = status.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`size-8 rounded-full flex items-center justify-center ${status.color}`}>
                            <StatusIcon className="size-4" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {item.amount.toLocaleString()} บาท
                            </p>
                            <p className="text-xs text-white/60">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: th })}
                            </p>
                          </div>
                        </div>
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
