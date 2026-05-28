'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Phone, 
  Gift, 
  Copy, 
  Share2, 
  LogOut,
  Lock,
  Loader2,
  Building2,
  Save,
  CreditCard,
  Pencil,
  CheckCircle,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  credit_balance: number;
  referral_code: string;
  bank_code?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  current_turnover?: number;
  required_turnover?: number;
  total_deposits?: number;
  total_bets?: number;
}

const BANKS = [
  { code: 'kbank', name: 'ธนาคารกสิกรไทย', color: 'bg-green-600' },
  { code: 'scb', name: 'ธนาคารไทยพาณิชย์', color: 'bg-purple-600' },
  { code: 'bbl', name: 'ธนาคารกรุงเทพ', color: 'bg-blue-800' },
  { code: 'ktb', name: 'ธนาคารกรุงไทย', color: 'bg-cyan-600' },
  { code: 'bay', name: 'ธนาคารกรุงศรี', color: 'bg-yellow-500' },
  { code: 'ttb', name: 'ธนาคารทหารไทยธนชาต', color: 'bg-blue-500' },
  { code: 'gsb', name: 'ธนาคารออมสิน', color: 'bg-pink-500' },
  { code: 'baac', name: 'ธนาคาร ธ.ก.ส.', color: 'bg-green-700' },
];

export default function CustomerProfilePage() {
  const router = useRouter();
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: customer, error, mutate } = useSWR<CustomerData>(
    '/api/customer/me',
    fetcher,
    { 
      revalidateOnFocus: false,
      onError: () => {
        // If API fails, try localStorage
      }
    }
  );
  
  const { data: settings } = useSWR('/api/settings', fetcher);
  const turnoverEnabled = settings?.turnover_enabled ?? false;

  // Initialize bank fields when customer data loads
  useEffect(() => {
    if (customer) {
      setBankCode(customer.bank_code || '');
      setBankAccountNumber(customer.bank_account_number || '');
      setBankAccountName(customer.bank_account_name || '');
    }
  }, [customer]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  const shareReferral = async () => {
    const url = `${window.location.origin}/c/register?ref=${customer?.referral_code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FIN LOTTO - สมัครสมาชิก',
          text: 'สมัครสมาชิก FIN LOTTO และรับโบนัส!',
          url,
        });
      } catch {
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const handleSaveBank = async () => {
    if (!bankCode || !bankAccountNumber || !bankAccountName) {
      toast.error('กรุณากรอกข้อมูลบัญชีให้ครบถ้วน');
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
      setIsEditingBank(false);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST' });
    } catch {
      // Ignore error
    }
    localStorage.removeItem('customer');
    localStorage.removeItem('customer_token');
    toast.success('ออกจากระบบสำเร็จ');
    router.push('/c/login');
  };

  const getBankName = (code: string) => {
    return BANKS.find(b => b.code === code)?.name || code;
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">กรุณาเข้าสู่ระบบ</p>
        <Button onClick={() => router.push('/c/login')}>เข้าสู่ระบบ</Button>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasBank = customer.bank_code && customer.bank_account_number;

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <User className="size-5 text-primary" />
        บัญชีของฉัน
      </h1>

      {/* Profile Info */}
      <Card className="bg-card/80 backdrop-blur border-border/50">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center border-2 border-primary/50">
              <User className="size-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">{customer.name}</h2>
              <p className="text-white/80 flex items-center gap-1">
                <Phone className="size-3" />
                {customer.phone}
              </p>
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/20 to-cyan-500/20 border border-primary/40 text-center">
              <p className="text-sm text-white/70 font-medium">เครดิต</p>
              <p className="text-2xl font-bold font-mono text-primary">
                {(customer.credit_balance || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-center">
              <p className="text-sm text-white/70 font-medium">รหัสแนะนำ</p>
              <p className="text-2xl font-bold font-mono text-amber-400">
                {customer.referral_code || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Turnover Status - Only show if enabled */}
      {turnoverEnabled && customer.required_turnover && customer.required_turnover > 0 && (
        <Card className="bg-card/80 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <TrendingUp className="size-4 text-primary" />
              สถานะเทิร์นโอเวอร์
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const current = customer.current_turnover || 0;
              const required = customer.required_turnover || 0;
              const progress = required > 0 ? Math.min(100, (current / required) * 100) : 100;
              const isComplete = current >= required;
              const remaining = Math.max(0, required - current);
              
              return (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isComplete ? (
                        <CheckCircle className="size-5 text-green-400" />
                      ) : (
                        <Clock className="size-5 text-amber-400" />
                      )}
                      <span className={`font-medium ${isComplete ? 'text-green-400' : 'text-amber-400'}`}>
                        {isComplete ? 'ครบเงื่อนไขถอนแล้ว' : 'ยังไม่ครบเงื่อนไข'}
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${isComplete ? 'text-green-400' : 'text-amber-400'}`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="h-3 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-neutral-800/50">
                      <p className="text-xs text-white/50">เดิมพันแล้ว</p>
                      <p className="text-lg font-bold font-mono text-white">{current.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-800/50">
                      <p className="text-xs text-white/50">เป้าหมาย</p>
                      <p className="text-lg font-bold font-mono text-white">{required.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {!isComplete && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <p className="text-sm text-amber-400">
                        ต้องเดิมพันอีก <span className="font-bold font-mono">{remaining.toLocaleString()}</span> บาท จึงจะถอนเงินได้
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Bank Account */}
      <Card className="bg-card/80 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <Building2 className="size-4 text-primary" />
              บัญชีธนาคารของฉัน
            </CardTitle>
            {hasBank && !isEditingBank && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditingBank(true)} className="text-white/80 hover:text-white">
                <Pencil className="size-4 mr-1" />
                แก้ไข
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasBank && !isEditingBank ? (
            <div className="text-center py-6">
              <CreditCard className="size-12 text-white/40 mx-auto mb-3" />
              <p className="text-white/60 mb-4">ยังไม่มีข้อมูลบัญชีธนาคาร</p>
              <Button onClick={() => setIsEditingBank(true)} className="bg-primary hover:bg-primary/90">
                <Building2 className="size-4 mr-2" />
                เพิ่มบัญชีธนาคารของฉัน
              </Button>
            </div>
          ) : isEditingBank ? (
            <div className="space-y-4">
              <div>
                <Label className="text-white/90">ธนาคาร</Label>
                <Select value={bankCode} onValueChange={setBankCode}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกธนาคาร" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>
                        <div className="flex items-center gap-2">
                          <div className={`size-3 rounded-full ${bank.color}`} />
                          {bank.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/90">เลขบัญชี</Label>
                <Input
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234567890"
                  className="mt-1 font-mono bg-background/50 border-border/50 text-white"
                  maxLength={15}
                />
              </div>
              <div>
                <Label className="text-white/90">ชื่อบัญชี (ภาษาไทยหรืออังกฤษ)</Label>
                <Input
                  value={bankAccountName}
                  onChange={(e) => {
                    // รองรับภาษาไทย อังกฤษ ตัวเลข และเว้นวรรค
                    const value = e.target.value;
                    const cleaned = value.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.\-]/g, '');
                    setBankAccountName(cleaned);
                  }}
                  placeholder="เช่น สมชาย ใจดี"
                  className="mt-1 bg-background/50 border-border/50 text-white"
                />
                <p className="text-xs text-white/60 mt-1">ภาษาไทย อังกฤษ เว้นวรรคได้</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditingBank(false)}>
                  ยกเลิก
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSaveBank} disabled={saving}>
                  {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                  บันทึก
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/40">
              <div className="flex items-center gap-3 mb-3">
                <div className={`size-10 rounded-full ${BANKS.find(b => b.code === customer.bank_code)?.color || 'bg-gray-500'} flex items-center justify-center`}>
                  <Building2 className="size-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-white">{getBankName(customer.bank_code || '')}</p>
                  <p className="text-sm text-white/70">{customer.bank_account_name}</p>
                </div>
                <CheckCircle className="size-5 text-green-400 ml-auto" />
              </div>
              <div className="flex items-center justify-between p-3 rounded bg-background/30 border border-white/10">
                <span className="font-mono text-lg text-primary">{customer.bank_account_number}</span>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(customer.bank_account_number || '')} className="text-white/70 hover:text-white">
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral */}
      <Card className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-400">
            <Gift className="size-4 text-amber-400" />
            แนะนำเพื่อน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-white/80">
            แชร์ลิงก์นี้ให้เพื่อน เมื่อเพื่อนสมัครและซื้อเลขครั้งแรก คุณจะได้รับโบนัส!
          </p>
          
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/c/register?ref=${customer.referral_code}`}
              className="text-sm bg-background/30 border-amber-500/30 text-white"
            />
            <Button size="icon" variant="outline" onClick={() => copyToClipboard(
              `${typeof window !== 'undefined' ? window.location.origin : ''}/c/register?ref=${customer.referral_code}`
            )}>
              <Copy className="size-4" />
            </Button>
          </div>

          <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black" onClick={shareReferral}>
            <Share2 className="size-4 mr-2" />
            แชร์ลิงก์
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="bg-card/80 backdrop-blur border-border/50">
        <CardContent className="pt-4 space-y-2">
          <Button 
            variant="outline" 
            className="w-full justify-start border-border/50 text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => toast.info('กรุณาติดต่อเจ้าหน้าที่เพื่อเปลี่ยนรหัสผ่าน')}
          >
            <Lock className="size-4 mr-2" />
            เปลี่ยนรหัสผ่าน
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full justify-start text-red-500 hover:text-red-500 hover:bg-red-500/10"
            onClick={handleLogout}
          >
            <LogOut className="size-4 mr-2" />
            ออกจากระบบ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
