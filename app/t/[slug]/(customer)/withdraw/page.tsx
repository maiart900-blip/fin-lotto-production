'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Wallet, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface CustomerInfo {
  credit_balance: number;
  bank_code: string;
  bank_account_number: string;
  bank_account_name: string;
}

const BANK_NAMES: Record<string, string> = {
  'KBANK': 'ธนาคารกสิกรไทย',
  'SCB': 'ธนาคารไทยพาณิชย์',
  'KTB': 'ธนาคารกรุงไทย',
  'BBL': 'ธนาคารกรุงเทพ',
  'BAY': 'ธนาคารกรุงศรี',
  'TMB': 'ธนาคารทหารไทยธนชาต',
  'GSB': 'ธนาคารออมสิน',
};

export default function TenantWithdrawPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const minWithdraw = 100;
  const maxWithdraw = 50000;

  useEffect(() => {
    fetchCustomer();
  }, [slug]);

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/tenant/${slug}/customer/me`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!customer) return;

    const amountNum = parseFloat(amount);
    
    if (!amountNum || amountNum <= 0) {
      toast.error('กรุณาระบุจำนวนเงิน');
      return;
    }

    if (amountNum < minWithdraw) {
      toast.error(`ยอดถอนขั้นต่ำ ${minWithdraw} บาท`);
      return;
    }

    if (amountNum > maxWithdraw) {
      toast.error(`ยอดถอนสูงสุด ${maxWithdraw.toLocaleString()} บาท`);
      return;
    }

    if (amountNum > customer.credit_balance) {
      toast.error('ยอดเครดิตไม่เพียงพอ');
      return;
    }

    if (!customer.bank_account_number) {
      toast.error('กรุณาเพิ่มบัญชีธนาคารในโปรไฟล์ก่อน');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/customer/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountNum }),
      });

      if (res.ok) {
        setSuccess(true);
        setAmount('');
        toast.success('แจ้งถอนเงินสำเร็จ รอดำเนินการ');
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

  if (success) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <Check className="h-10 w-10 text-green-400" />
        </div>
        <h2 className="text-xl font-bold mb-2">แจ้งถอนสำเร็จ</h2>
        <p className="text-gray-400 text-center mb-4">
          รายการของคุณอยู่ระหว่างดำเนินการ<br />
          โดยปกติจะโอนภายใน 5-15 นาที
        </p>
        <Button onClick={() => setSuccess(false)} variant="outline">
          ถอนเงินอีกครั้ง
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-3">
          <Wallet className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold">ถอนเงิน</h1>
        <p className="text-gray-400 text-sm">ระบุยอดที่ต้องการถอน</p>
      </div>

      {/* Balance */}
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl p-4 text-center">
        <p className="text-gray-400 text-sm">ยอดเครดิตคงเหลือ</p>
        <p className="text-3xl font-bold text-amber-400">
          {customer?.credit_balance?.toLocaleString() || 0}
          <span className="text-lg ml-1">บาท</span>
        </p>
      </div>

      {/* Bank Account */}
      <div className="bg-[#1a1a3a] rounded-xl p-4">
        <p className="text-sm text-gray-400 mb-2">บัญชีรับเงิน</p>
        {customer?.bank_account_number ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 font-bold text-xs">
                {customer.bank_code}
              </span>
            </div>
            <div>
              <p className="font-medium">{BANK_NAMES[customer.bank_code] || customer.bank_code}</p>
              <p className="text-sm text-gray-400">
                {customer.bank_account_number} - {customer.bank_account_name}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">กรุณาเพิ่มบัญชีธนาคารในโปรไฟล์</span>
          </div>
        )}
      </div>

      {/* Amount Input */}
      <div className="bg-[#1a1a3a] rounded-xl p-4">
        <label className="text-sm text-gray-400 mb-2 block">จำนวนเงินที่ต้องการถอน</label>
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
              disabled={amt > (customer?.credit_balance || 0)}
              className={`border-white/20 ${
                amount === amt.toString() 
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                  : 'text-gray-300 hover:bg-white/5'
              } ${amt > (customer?.credit_balance || 0) ? 'opacity-50' : ''}`}
            >
              {amt.toLocaleString()}
            </Button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          ขั้นต่ำ {minWithdraw} บาท | สูงสุด {maxWithdraw.toLocaleString()} บาท
        </p>
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={submitting || !customer?.bank_account_number}
        className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
      >
        {submitting ? 'กำลังดำเนินการ...' : 'ยืนยันถอนเงิน'}
      </Button>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <p className="text-blue-400 text-sm">
          <strong>หมายเหตุ:</strong> รายการถอนจะดำเนินการภายใน 5-15 นาที
          ในกรณีที่มียอดแทงค้างอยู่ ระบบจะหักยอดก่อนโอน
        </p>
      </div>
    </div>
  );
}
