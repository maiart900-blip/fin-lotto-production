'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard, Upload, Copy, Check, Building2, QrCode, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface PaymentAccount {
  id: string;
  account_type: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  min_deposit: number;
  max_deposit: number;
}

const BANK_NAMES: Record<string, string> = {
  'KBANK': 'ธนาคารกสิกรไทย',
  'SCB': 'ธนาคารไทยพาณิชย์',
  'KTB': 'ธนาคารกรุงไทย',
  'BBL': 'ธนาคารกรุงเทพ',
  'BAY': 'ธนาคารกรุงศรี',
  'TMB': 'ธนาคารทหารไทยธนชาต',
  'GSB': 'ธนาคารออมสิน',
  'PROMPTPAY': 'พร้อมเพย์',
  'TRUEWALLET': 'TrueMoney Wallet',
};

export default function TenantDepositPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'select' | 'transfer' | 'upload'>('select');

  useEffect(() => {
    fetchAccounts();
  }, [slug]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/tenant/${slug}/customer/payment-accounts`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('คัดลอกแล้ว');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAccount || !amount || !slipFile) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum < selectedAccount.min_deposit) {
      toast.error(`ยอดฝากขั้นต่ำ ${selectedAccount.min_deposit} บาท`);
      return;
    }
    if (amountNum > selectedAccount.max_deposit) {
      toast.error(`ยอดฝากสูงสุด ${selectedAccount.max_deposit} บาท`);
      return;
    }

    setSubmitting(true);
    try {
      // Upload slip first
      const formData = new FormData();
      formData.append('file', slipFile);
      
      const uploadRes = await fetch(`/api/tenant/${slug}/customer/upload-slip`, {
        method: 'POST',
        body: formData,
      });

      let slipUrl = '';
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        slipUrl = uploadData.url;
      }

      // Create topup request
      const res = await fetch(`/api/tenant/${slug}/customer/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          payment_account_id: selectedAccount.id,
          slip_url: slipUrl,
        }),
      });

      if (res.ok) {
        toast.success('แจ้งฝากเงินสำเร็จ รอตรวจสอบ');
        setAmount('');
        setSlipFile(null);
        setSlipPreview('');
        setStep('select');
        setSelectedAccount(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const quickAmounts = [100, 300, 500, 1000, 2000, 5000];

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-3">
          <CreditCard className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-xl font-bold">ฝากเงิน</h1>
        <p className="text-gray-400 text-sm">เลือกบัญชีและยอดที่ต้องการฝาก</p>
      </div>

      {/* Step 1: Select Account */}
      {step === 'select' && (
        <div className="space-y-4">
          {/* Quick Amount */}
          <div className="bg-[#1a1a3a] rounded-xl p-4">
            <label className="text-sm text-gray-400 mb-2 block">จำนวนเงิน (บาท)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ระบุจำนวนเงิน"
              className="bg-[#12122a] border-white/10 text-white text-lg h-12 mb-3"
            />
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(amt.toString())}
                  className={`border-white/20 ${amount === amt.toString() ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'text-gray-300 hover:bg-white/5'}`}
                >
                  {amt.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>

          {/* Account Selection */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">เลือกบัญชีรับเงิน</label>
            {accounts.length === 0 ? (
              <div className="bg-[#1a1a3a] rounded-xl p-6 text-center">
                <p className="text-gray-400">ยังไม่มีบัญชีรับเงิน กรุณาติดต่อแอดมิน</p>
              </div>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccount(account)}
                  className={`w-full p-4 rounded-xl border transition-all text-left ${
                    selectedAccount?.id === account.id
                      ? 'bg-amber-500/20 border-amber-500'
                      : 'bg-[#1a1a3a] border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      account.account_type === 'promptpay' ? 'bg-blue-500/20' :
                      account.account_type === 'wallet' ? 'bg-orange-500/20' : 'bg-green-500/20'
                    }`}>
                      {account.account_type === 'promptpay' ? <QrCode className="h-5 w-5 text-blue-400" /> :
                       account.account_type === 'wallet' ? <Smartphone className="h-5 w-5 text-orange-400" /> :
                       <Building2 className="h-5 w-5 text-green-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{BANK_NAMES[account.bank_code] || account.bank_code}</p>
                      <p className="text-sm text-gray-400">{account.account_number}</p>
                    </div>
                    {selectedAccount?.id === account.id && (
                      <Check className="h-5 w-5 text-amber-400" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          <Button
            onClick={() => setStep('transfer')}
            disabled={!selectedAccount || !amount}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            ถัดไป
          </Button>
        </div>
      )}

      {/* Step 2: Transfer Info */}
      {step === 'transfer' && selectedAccount && (
        <div className="space-y-4">
          <div className="bg-[#1a1a3a] rounded-xl p-4 space-y-4">
            <div className="text-center py-2">
              <p className="text-gray-400 text-sm">ยอดที่ต้องโอน</p>
              <p className="text-3xl font-bold text-green-400">{parseFloat(amount).toLocaleString()} บาท</p>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">ธนาคาร</span>
                <span className="font-medium">{BANK_NAMES[selectedAccount.bank_code]}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">เลขบัญชี</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium font-mono">{selectedAccount.account_number}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopy(selectedAccount.account_number)}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">ชื่อบัญชี</span>
                <span className="font-medium">{selectedAccount.account_name}</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-amber-400 text-sm text-center">
              โอนเงินแล้วกรุณาอัพโหลดสลิปเพื่อยืนยัน
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('select')}
              className="flex-1 border-white/20"
            >
              ย้อนกลับ
            </Button>
            <Button
              onClick={() => setStep('upload')}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600"
            >
              โอนแล้ว อัพโหลดสลิป
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Upload Slip */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="bg-[#1a1a3a] rounded-xl p-4">
            <p className="text-center text-gray-400 text-sm mb-4">อัพโหลดสลิปโอนเงิน</p>
            
            <label className="block cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                slipPreview ? 'border-green-500' : 'border-white/20 hover:border-white/40'
              }`}>
                {slipPreview ? (
                  <img src={slipPreview} alt="Slip" className="max-h-48 mx-auto rounded-lg" />
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-gray-500 mb-2" />
                    <p className="text-gray-400">คลิกเพื่อเลือกรูปสลิป</p>
                    <p className="text-gray-500 text-xs mt-1">รองรับ JPG, PNG</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep('transfer')}
              className="flex-1 border-white/20"
            >
              ย้อนกลับ
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!slipFile || submitting}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600"
            >
              {submitting ? 'กำลังส่ง...' : 'ยืนยันฝากเงิน'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
