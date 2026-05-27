'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { 
  Phone, Lock, User, Eye, EyeOff, Loader2, 
  ArrowLeft, CheckCircle2, Building2, CreditCard,
  Shield, Gift, PartyPopper
} from 'lucide-react';
import { toast } from 'sonner';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
}

const banks = [
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย', color: '#138F2D' },
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์', color: '#4E2A82' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย', color: '#1BA5E0' },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ', color: '#1E4598' },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา', color: '#FEC43B' },
  { code: 'TMB', name: 'ธนาคาร TTB', color: '#0066B3' },
  { code: 'GSB', name: 'ธนาคารออมสิน', color: '#EB198D' },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function TenantRegisterPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  
  const { data: tenant } = useSWR<TenantSettings>(`/api/tenant/${slug}`, fetcher);
  
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registeredUsername, setRegisteredUsername] = useState('');

  const primaryColor = tenant?.primary_color || '#f59e0b';
  const selectedBank = banks.find(b => b.code === bankCode);

  const handleStep1 = () => {
    if (!phone || phone.length !== 10) {
      toast.error('กรุณากรอกเบอร์โทร 10 หลัก');
      return;
    }
    setStep(2);
  };

  const handleStep2 = () => {
    if (!username || username.length < 4) {
      toast.error('Username ต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (!password || password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (!bankCode || !accountNumber || !accountName) {
      toast.error('กรุณากรอกข้อมูลบัญชีธนาคาร');
      return;
    }
    setStep(3);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptTerms || !acceptAge) {
      toast.error('กรุณายอมรับเงื่อนไขการใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username,
          phone, 
          password, 
          bank_code: bankCode,
          bank_account_number: accountNumber,
          bank_account_name: accountName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'สมัครสมาชิกไม่สำเร็จ');

      setRegisteredUsername(username);
      setStep(4);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col">
      {/* Header */}
      <div className="text-center pt-8 pb-4">
        {tenant?.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} className="h-16 mx-auto" />
        ) : (
          <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>
            {tenant?.name || 'Loading...'}
          </h1>
        )}
        <p className="text-white mt-2 text-lg font-bold">สมัครสมาชิก</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 px-4 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s 
                  ? 'text-black' 
                  : 'bg-gray-700 text-gray-400'
              }`}
              style={step >= s ? { backgroundColor: primaryColor } : {}}
            >
              {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
            </div>
            {s < 3 && (
              <div className={`w-12 h-1 rounded ${step > s ? '' : 'bg-gray-700'}`} 
                style={step > s ? { backgroundColor: primaryColor } : {}} 
              />
            )}
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="flex-1 px-4 pb-8">
        <div className="max-w-md mx-auto">
          <form onSubmit={step === 3 ? handleRegister : (e) => e.preventDefault()}>
            <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6">
              
              {/* Step 1: Phone */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-white text-center mb-4">ยืนยันเบอร์โทร</h2>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="เบอร์โทรศัพท์ 10 หลัก"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleStep1}
                    className="w-full py-4 rounded-xl font-bold text-black"
                    style={{ backgroundColor: primaryColor }}
                  >
                    ยืนยันเบอร์โทร
                  </button>
                </div>
              )}

              {/* Step 2: Account Setup */}
              {step === 2 && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>ย้อนกลับ</span>
                  </button>
                  
                  <h2 className="text-lg font-bold text-white text-center">ตั้งค่าบัญชี</h2>
                  
                  {/* Username */}
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Username (อย่างน้อย 4 ตัว)"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none"
                    />
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-gray-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Confirm Password */}
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="ยืนยันรหัสผ่าน"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none"
                    />
                  </div>

                  {/* Bank Selection */}
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">เลือกธนาคาร</label>
                    <div className="grid grid-cols-4 gap-2">
                      {banks.map((bank) => (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => setBankCode(bank.code)}
                          className={`p-2 rounded-lg border-2 transition-all ${
                            bankCode === bank.code 
                              ? 'border-amber-500' 
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                          style={{ backgroundColor: bank.color }}
                        >
                          <span className="text-white text-xs font-bold">{bank.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Account Number */}
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="เลขบัญชี"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none"
                    />
                  </div>

                  {/* Account Name */}
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ชื่อบัญชี"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleStep2}
                    className="w-full py-4 rounded-xl font-bold text-black"
                    style={{ backgroundColor: primaryColor }}
                  >
                    ถัดไป
                  </button>
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === 3 && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>ย้อนกลับ</span>
                  </button>

                  <h2 className="text-lg font-bold text-white text-center flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5" style={{ color: primaryColor }} />
                    ยืนยันข้อมูล
                  </h2>

                  <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">เบอร์โทร</span>
                      <span className="font-bold" style={{ color: primaryColor }}>{phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Username</span>
                      <span className="font-bold" style={{ color: primaryColor }}>{username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ธนาคาร</span>
                      <span className="text-white">{selectedBank?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">เลขบัญชี</span>
                      <span className="text-white">{accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ชื่อบัญชี</span>
                      <span className="text-white">{accountName}</span>
                    </div>
                  </div>

                  {/* Terms */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-800"
                    />
                    <span className="text-gray-400 text-sm">
                      ข้าพเจ้ายอมรับ{' '}
                      <a href="#" className="underline" style={{ color: primaryColor }}>เงื่อนไขการใช้งาน</a>
                      {' '}และ{' '}
                      <a href="#" className="underline" style={{ color: primaryColor }}>นโยบายความเป็นส่วนตัว</a>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptAge}
                      onChange={(e) => setAcceptAge(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-800"
                    />
                    <span className="text-gray-400 text-sm">
                      ข้าพเจ้ามีอายุ 20 ปีขึ้นไป และยินยอมให้ใช้บริการ
                    </span>
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 py-4 rounded-xl font-bold bg-gray-700 text-white"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !acceptTerms || !acceptAge}
                      className="flex-1 py-4 rounded-xl font-bold text-black disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'สมัครสมาชิก'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Success */}
              {step === 4 && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: primaryColor }}>
                    <PartyPopper className="w-10 h-10 text-black" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">สมัครสำเร็จ!</h2>
                  <p className="text-gray-400 mb-4">ยินดีต้อนรับสู่ {tenant?.name}</p>
                  <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
                    <p className="text-gray-400 text-sm">Username ของคุณ</p>
                    <p className="text-xl font-bold" style={{ color: primaryColor }}>{registeredUsername}</p>
                  </div>
                  <Link
                    href={`/t/${slug}/login`}
                    className="block w-full py-4 rounded-xl font-bold text-black text-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    เข้าสู่ระบบ
                  </Link>
                </div>
              )}
            </div>
          </form>

          {step < 4 && (
            <p className="text-center mt-6 text-gray-400">
              มีบัญชีแล้ว?{' '}
              <Link href={`/t/${slug}/login`} className="font-bold" style={{ color: primaryColor }}>
                เข้าสู่ระบบ
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Features */}
      {step < 4 && (
        <div className="grid grid-cols-2 gap-3 px-4 pb-8 max-w-md mx-auto">
          <div className="flex items-center gap-2 bg-gray-900/50 rounded-xl p-3">
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
            <span className="text-gray-400 text-sm">ปลอดภัย 100%</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-900/50 rounded-xl p-3">
            <Gift className="w-5 h-5" style={{ color: primaryColor }} />
            <span className="text-gray-400 text-sm">โบนัสสมัครใหม่</span>
          </div>
        </div>
      )}
    </div>
  );
}
