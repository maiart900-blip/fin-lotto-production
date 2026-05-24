'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft,
  Building2,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Shield,
  CreditCard,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  bank_code?: string;
  bank_account_number?: string;
  bank_account_name?: string;
}

const BANKS = [
  { code: 'kbank', name: 'ธนาคารกสิกรไทย', shortName: 'KBANK', color: 'bg-green-600' },
  { code: 'scb', name: 'ธนาคารไทยพาณิชย์', shortName: 'SCB', color: 'bg-purple-600' },
  { code: 'bbl', name: 'ธนาคารกรุงเทพ', shortName: 'BBL', color: 'bg-blue-800' },
  { code: 'ktb', name: 'ธนาคารกรุงไทย', shortName: 'KTB', color: 'bg-cyan-600' },
  { code: 'bay', name: 'ธนาคารกรุงศรี', shortName: 'BAY', color: 'bg-yellow-500' },
  { code: 'ttb', name: 'ธนาคารทหารไทยธนชาต', shortName: 'TTB', color: 'bg-blue-500' },
  { code: 'gsb', name: 'ธนาคารออมสิน', shortName: 'GSB', color: 'bg-pink-500' },
  { code: 'baac', name: 'ธนาคาร ธ.ก.ส.', shortName: 'BAAC', color: 'bg-green-700' },
  { code: 'lh', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', shortName: 'LH', color: 'bg-orange-500' },
  { code: 'uob', name: 'ธนาคารยูโอบี', shortName: 'UOB', color: 'bg-blue-600' },
  { code: 'cimb', name: 'ธนาคารซีไอเอ็มบี', shortName: 'CIMB', color: 'bg-red-600' },
  { code: 'tisco', name: 'ธนาคารทิสโก้', shortName: 'TISCO', color: 'bg-blue-400' },
  { code: 'kkp', name: 'ธนาคารเกียรตินาคินภัทร', shortName: 'KKP', color: 'bg-amber-600' },
];

export default function BankAccountPage() {
  const router = useRouter();
  const [bankCode, setBankCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: customer, error, isLoading, mutate } = useSWR<CustomerData>(
    '/api/customer/me',
    fetcher,
    { revalidateOnFocus: false }
  );

  // Initialize fields when customer data loads
  useEffect(() => {
    if (customer) {
      setBankCode(customer.bank_code || '');
      setBankAccountNumber(customer.bank_account_number || '');
      setBankAccountName(customer.bank_account_name || '');
    }
  }, [customer]);

  const hasBank = customer?.bank_code && customer?.bank_account_number;

  const handleSave = async () => {
    if (!bankCode) {
      toast.error('กรุณาเลือกธนาคาร');
      return;
    }
    if (!bankAccountNumber || bankAccountNumber.length < 10) {
      toast.error('กรุณากรอกเลขบัญชี 10-15 หลัก');
      return;
    }
    if (!bankAccountName || bankAccountName.length < 3) {
      toast.error('กรุณากรอกชื่อบัญชี');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/customer/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_code: bankCode,
          bank_account_number: bankAccountNumber,
          bank_account_name: bankAccountName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      toast.success('บันทึกข้อมูลบัญชีสำเร็จ');
      setIsEditing(false);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const getBankInfo = (code: string) => {
    return BANKS.find(b => b.code === code);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
        <Card className="bg-[#0D1321] border-red-500/20 max-w-md w-full">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="size-12 text-red-400 mx-auto mb-4" />
            <p className="text-white mb-4">ไม่สามารถโหลดข้อมูลได้</p>
            <Button onClick={() => router.push('/c/login')} className="bg-amber-500 hover:bg-amber-600 text-black">
              เข้าสู่ระบบใหม่
            </Button>
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
          <Link href="/c/profile">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">ผูกบัญชีธนาคาร</h1>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3">
          <Shield className="size-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-400 mb-1">ความปลอดภัย</p>
            <p className="text-[#94A3B8]">
              บัญชีธนาคารที่ผูกไว้จะใช้สำหรับรับเงินถอนเท่านั้น 
              ชื่อบัญชีต้องตรงกับชื่อผู้ใช้งานเพื่อความปลอดภัย
            </p>
          </div>
        </div>

        {/* Current Bank Account */}
        {hasBank && !isEditing && (
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <CheckCircle className="size-4 text-green-400" />
                  บัญชีที่ผูกไว้
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsEditing(true)}
                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                >
                  แก้ไข
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0D1321]">
                <div className={`size-14 rounded-xl ${getBankInfo(customer.bank_code || '')?.color || 'bg-gray-500'} flex items-center justify-center shadow-lg`}>
                  <Building2 className="size-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{getBankInfo(customer.bank_code || '')?.name}</p>
                  <p className="font-mono text-xl text-amber-400 my-1">{customer.bank_account_number}</p>
                  <p className="text-sm text-[#94A3B8]">{customer.bank_account_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bank Form */}
        {(!hasBank || isEditing) && (
          <Card className="bg-[#0D1321] border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <CreditCard className="size-5 text-amber-400" />
                {hasBank ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคาร'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Bank Select */}
              <div className="space-y-2">
                <Label className="text-[#94A3B8]">เลือกธนาคาร</Label>
                <Select value={bankCode} onValueChange={setBankCode}>
                  <SelectTrigger className="bg-[#0A0F1C] border-white/10 text-white h-12">
                    <SelectValue placeholder="-- เลือกธนาคาร --" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0D1321] border-white/10">
                    {BANKS.map((bank) => (
                      <SelectItem 
                        key={bank.code} 
                        value={bank.code}
                        className="text-white hover:bg-white/10 focus:bg-white/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`size-6 rounded ${bank.color} flex items-center justify-center`}>
                            <Building2 className="size-3 text-white" />
                          </div>
                          <span>{bank.name}</span>
                          <span className="text-[#64748B] text-xs">({bank.shortName})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Number */}
              <div className="space-y-2">
                <Label className="text-[#94A3B8]">เลขบัญชี</Label>
                <Input
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="เช่น 1234567890"
                  className="bg-[#0A0F1C] border-white/10 text-white h-12 font-mono text-lg"
                  maxLength={15}
                />
                <p className="text-xs text-[#64748B]">กรอกเลขบัญชี 10-15 หลัก ไม่ต้องมีขีด</p>
              </div>

              {/* Account Name - รองรับภาษาไทย */}
              <div className="space-y-2">
                <Label className="text-[#94A3B8]">ชื่อบัญชี (ภาษาไทยหรืออังกฤษ)</Label>
                <Input
                  value={bankAccountName}
                  onChange={(e) => {
                    // รองรับภาษาไทย อังกฤษ ตัวเลข และเว้นวรรค
                    const value = e.target.value;
                    const cleaned = value.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.\-]/g, '');
                    setBankAccountName(cleaned);
                  }}
                  placeholder="เช่น สมชาย ใจดี หรือ Somchai Jaidee"
                  className="bg-[#0A0F1C] border-white/10 text-white h-12"
                />
                <p className="text-xs text-[#64748B]">ชื่อ-นามสกุล ตามหน้าสมุดบัญชี (ภาษาไทย อังกฤษ เว้นวรรคได้)</p>
              </div>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex gap-2">
                <Info className="size-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึก เงินถอนจะโอนเข้าบัญชีนี้เท่านั้น
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                {hasBank && (
                  <Button 
                    variant="outline" 
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                    onClick={() => {
                      setIsEditing(false);
                      setBankCode(customer?.bank_code || '');
                      setBankAccountNumber(customer?.bank_account_number || '');
                      setBankAccountName(customer?.bank_account_name || '');
                    }}
                  >
                    ยกเลิก
                  </Button>
                )}
                <Button 
                  className={`flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold ${!hasBank ? 'w-full' : ''}`}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Save className="size-4 mr-2" />
                      บันทึกบัญชี
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/c/topup">
            <Card className="bg-[#0D1321] border-green-500/20 hover:border-green-500/40 transition-colors cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className="size-10 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-green-400 text-xl">+</span>
                </div>
                <p className="font-medium text-white">เติมเงิน</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/c/withdraw">
            <Card className="bg-[#0D1321] border-red-500/20 hover:border-red-500/40 transition-colors cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className="size-10 rounded-xl bg-red-500/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-red-400 text-xl">-</span>
                </div>
                <p className="font-medium text-white">ถอนเงิน</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
