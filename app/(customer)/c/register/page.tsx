'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Crown, 
  Phone, 
  Lock, 
  Loader2, 
  User,
  Gift,
  ArrowLeft,
  Sparkles,
  Shield,
  CheckCircle2,
  MessageCircle,
  Eye,
  EyeOff,
  Building2,
  CreditCard,
  AlertCircle,
  PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';

// Password strength calculation
const getPasswordStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
  return Math.min(strength, 4);
};

const strengthLabels = ['', 'อ่อน', 'ปานกลาง', 'ดี', 'แข็งแกร่ง'];
const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];

// Thai banks
const banks = [
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย', color: '#138F2D' },
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์', color: '#4E2A82' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย', color: '#1BA5E0' },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ', color: '#1E4598' },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา', color: '#FEC43B' },
  { code: 'TMB', name: 'ธนาคาร TTB', color: '#0066B3' },
  { code: 'GSB', name: 'ธนาคารออมสิน', color: '#EB198D' },
  { code: 'BAAC', name: 'ธนาคาร ธ.ก.ส.', color: '#4CAF50' },
];

interface SiteSettings {
  logo_url?: string;
  login_background_url?: string;
  site_name?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  
  // Fetch site settings
  const { data: siteSettings } = useSWR<SiteSettings>('/api/site-settings', fetcher);
  
  // Step 1: Phone verification
  const [phone, setPhone] = useState('');
  
  // Step 2: Account setup
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [referralCode, setReferralCode] = useState(refCode);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [freeCredit, setFreeCredit] = useState(0);
  const [registeredUsername, setRegisteredUsername] = useState('');

  // Check username availability
  useEffect(() => {
    if (username.length >= 4) {
      const timer = setTimeout(async () => {
        setCheckingUsername(true);
        try {
          const res = await fetch(`/api/customer/check-username?username=${username}`);
          const data = await res.json();
          setUsernameAvailable(data.available);
        } catch {
          setUsernameAvailable(null);
        } finally {
          setCheckingUsername(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameAvailable(null);
    }
  }, [username]);

  const passwordStrength = getPasswordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptTerms || !acceptAge) {
      toast.error('กรุณายอมรับเงื่อนไขการใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/customer/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username,
          phone, 
          password, 
          bank_code: bankCode,
          bank_account_number: accountNumber,
          bank_account_name: accountName,
          referral_code: referralCode 
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'สมัครสมาชิกไม่สำเร็จ');
      }

      setFreeCredit(data.free_credit || 0);
      setRegisteredUsername(username);
      setStep(4); // Success step
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'สมัครสมาชิกไม่สำเร็จ';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep1 = () => {
    if (!phone || phone.length !== 10) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์ 10 หลัก');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!username || username.length < 4) {
      toast.error('Username ต้องมีอย่างน้อย 4 ตัวอักษร');
      return false;
    }
    if (usernameAvailable === false) {
      toast.error('Username นี้ถูกใช้งานแล้ว');
      return false;
    }
    if (!password || password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return false;
    }
    if (password !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return false;
    }
    if (!bankCode || !accountNumber || !accountName) {
      toast.error('กรุณากรอกข้อมูลบัญชีธนาคาร');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#060B14] relative overflow-x-hidden"
      style={siteSettings?.login_background_url ? {
        backgroundImage: `url(${siteSettings.login_background_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      } : undefined}
    >
      {/* Animated Background - only show if no custom background */}
      {!siteSettings?.login_background_url && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
      )}
      
      {/* Dark overlay for custom background */}
      {siteSettings?.login_background_url && (
        <div className="fixed inset-0 bg-black/60 pointer-events-none" />
      )}

      {/* Header */}
      <header className="relative z-10 px-4 py-3">
        <Link href="/c/login" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="size-5" />
          <span className="text-sm">กลับ</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-4 pb-8">
        {/* Logo Section */}
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center mb-3">
            {siteSettings?.logo_url ? (
              <img
                src={siteSettings.logo_url}
                alt={siteSettings?.site_name || 'FIN LOTTO'}
                className="h-16 w-auto drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]"
              />
            ) : (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl blur-lg opacity-50 animate-pulse" />
                <div className="relative size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-2xl border border-white/20">
                  <Crown className="size-7 text-white drop-shadow-lg" />
                </div>
              </div>
            )}
          </div>
          <h1 className="text-xl font-bold text-white">สมัครสมาชิก</h1>
          <p className="text-white/50 text-sm mt-1">{siteSettings?.site_name || 'FIN LOTTO PREMIUM'}</p>
        </div>

        {/* Progress Steps - Hide on success */}
        {step < 4 && (
          <div className="max-w-sm mx-auto mb-6">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`size-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    step >= s 
                      ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white' 
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {step > s ? <CheckCircle2 className="size-4" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`w-8 h-0.5 transition-all ${step > s ? 'bg-emerald-500' : 'bg-white/10'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 px-1 text-[10px]">
              <span className={step >= 1 ? 'text-emerald-400' : 'text-white/50'}>ยืนยันเบอร์</span>
              <span className={step >= 2 ? 'text-emerald-400' : 'text-white/50'}>ตั้งค่าบัญชี</span>
              <span className={step >= 3 ? 'text-emerald-400' : 'text-white/50'}>ยืนยัน</span>
            </div>
          </div>
        )}

        {/* Register Box */}
        <div className="max-w-sm mx-auto mb-6">
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500 rounded-2xl blur opacity-30" />
            <div className="relative rounded-2xl bg-[#111928]/90 backdrop-blur-xl border border-white/10 p-5">
              <form onSubmit={handleRegister} className="space-y-4">
                
                {/* STEP 1: Phone Verification */}
                {step === 1 && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-2 mb-4">
                      <Phone className="size-4 text-emerald-400" />
                      <span className="text-sm text-white/80">ยืนยันเบอร์โทรศัพท์</span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-white/60">เบอร์โทรศัพท์</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                        <Input
                          type="tel"
                          placeholder="0812345678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 text-lg tracking-wider"
                        />
                      </div>
                      <p className="text-xs text-white/40">ใช้สำหรับเข้าสู่ระบบและรับ OTP</p>
                    </div>

                    <Button 
                      type="button"
                      onClick={nextStep}
                      disabled={phone.length !== 10}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-500/90 hover:to-green-500/90 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                    >
                      ยืนยันเบอร์โทร
                    </Button>
                  </div>
                )}

                {/* STEP 2: Account Setup */}
                {step === 2 && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="size-4 text-emerald-400" />
                      <span className="text-sm text-white/80">ตั้งค่าบัญชีผู้ใช้</span>
                    </div>

                    {/* Username */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">Username (ใช้ภาษาอังกฤษ ตัวเลข หรือ _ เท่านั้น)</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                        <Input
                          type="text"
                          placeholder="ตั้ง username ข��งคุณ"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className="pl-10 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
                        />
                        {checkingUsername && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-white/40 animate-spin" />
                        )}
                        {!checkingUsername && usernameAvailable === true && (
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-400" />
                        )}
                        {!checkingUsername && usernameAvailable === false && (
                          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-red-400" />
                        )}
                      </div>
                      {usernameAvailable === false && (
                        <p className="text-xs text-red-400">Username นี้ถูกใช้งานแล้ว</p>
                      )}
                      {usernameAvailable === true && (
                        <p className="text-xs text-emerald-400">Username นี้ใช้งานได้</p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">รหัสผ่าน</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="อย่างน้อย 6 ตัวอักษร"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {/* Password Strength Meter */}
                      {password && (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full transition-all ${
                                  passwordStrength >= level ? strengthColors[passwordStrength] : 'bg-white/10'
                                }`}
                              />
                            ))}
                          </div>
                          <p className={`text-xs ${passwordStrength >= 3 ? 'text-emerald-400' : passwordStrength >= 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                            ความแข็งแกร่ง: {strengthLabels[passwordStrength]}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">ยืนยันรหัสผ่าน</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="กรอกรหัสผ่านอีกครั้ง"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                        >
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {confirmPassword && (
                        <p className={`text-xs ${password === confirmPassword ? 'text-emerald-400' : 'text-red-400'}`}>
                          {password === confirmPassword ? 'รหัสผ่านตรงกัน' : 'รหัสผ่านไม่ตรงกัน'}
                        </p>
                      )}
                    </div>

                    {/* Bank Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">ธนาคาร</label>
                      <div className="grid grid-cols-4 gap-2">
                        {banks.map((bank) => (
                          <button
                            key={bank.code}
                            type="button"
                            onClick={() => setBankCode(bank.code)}
                            className={`p-2 rounded-lg border transition-all ${
                              bankCode === bank.code
                                ? 'border-emerald-500 bg-emerald-500/20'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div 
                              className="size-8 mx-auto rounded-lg flex items-center justify-center text-white text-[8px] font-bold"
                              style={{ backgroundColor: bank.color }}
                            >
                              {bank.code.slice(0, 3)}
                            </div>
                            <p className="text-[8px] text-white/60 mt-1 truncate">{bank.name.replace('ธนาคาร', '')}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Account Number */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">เลขบัญชี</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                        <Input
                          type="text"
                          placeholder="กรอกเลขบัญชีธนาคาร"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                          className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20 tracking-wider"
                        />
                      </div>
                    </div>

                    {/* Account Name - รองรับภาษาไทย */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">ชื่อบัญชี (ภาษาไทยหรืออังกฤษ)</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                        <Input
                          type="text"
                          placeholder="เช่น สมชาย ใจดี หรือ Somchai Jaidee"
                          value={accountName}
                          onChange={(e) => {
                            // รองรับภาษาไทย อังกฤษ ตัวเลข และเว้นวรรค
                            const value = e.target.value;
                            // ยอมรับ Unicode (รวมภาษาไทย), ตัวเลข, เว้นวรรค, และเครื่องหมาย .-
                            const cleaned = value.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.\-]/g, '');
                            setAccountName(cleaned);
                          }}
                          className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    {/* Referral Code */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/60">รหัสแนะนำ (ถ้ามี)</label>
                      <div className="relative">
                        <Gift className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-amber-400/60" />
                        <Input
                          type="text"
                          placeholder="รหัสแนะนำ"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          className="pl-10 h-11 bg-white/5 border-amber-500/20 text-white placeholder:text-white/40 rounded-xl focus:border-amber-500 focus:ring-amber-500/20"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        type="button"
                        onClick={() => setStep(1)}
                        variant="outline"
                        className="flex-1 h-11 rounded-xl border-white/10 text-white hover:bg-white/10"
                      >
                        ย้อนกลับ
                      </Button>
                      <Button 
                        type="button"
                        onClick={nextStep}
                        className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-500/90 hover:to-green-500/90 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all"
                      >
                        ถัดไป
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Confirm */}
                {step === 3 && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="size-4 text-emerald-400" />
                      <span className="text-sm text-white/80">���ืนยันข้อมูล</span>
                    </div>

                    {/* Summary */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">เบอร์โทร</span>
                        <span className="text-white font-medium">{phone}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Username</span>
                        <span className="text-emerald-400 font-medium">{username}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">ธนาคาร</span>
                        <span className="text-white">{banks.find(b => b.code === bankCode)?.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">เลขบัญชี</span>
                        <span className="text-white font-mono">{accountNumber}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">ชื่อบัญชี</span>
                        <span className="text-white">{accountName}</span>
                      </div>
                      {referralCode && (
                        <div className="flex justify-between text-sm">
                          <span className="text-white/60">รหัสแนะนำ</span>
                          <span className="text-amber-400 font-medium">{referralCode}</span>
                        </div>
                      )}
                    </div>

                    {/* Terms & Conditions */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="terms"
                          checked={acceptTerms}
                          onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                          className="mt-0.5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <label htmlFor="terms" className="text-xs text-white/60 cursor-pointer">
                          ข้าพเจ้ายอมรับ{' '}
                          <span className="text-emerald-400 underline">เงื่อนไขการใช้งาน</span>
                          {' '}และ{' '}
                          <span className="text-emerald-400 underline">นโยบายความเป็นส่วนตัว</span>
                        </label>
                      </div>

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="age"
                          checked={acceptAge}
                          onCheckedChange={(checked) => setAcceptAge(checked === true)}
                          className="mt-0.5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <label htmlFor="age" className="text-xs text-white/60 cursor-pointer">
                          ข้าพเจ้ามีอายุ 20 ปีขึ้นไป และยินยอมให้ใช้บริการ
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        type="button"
                        onClick={() => setStep(2)}
                        variant="outline"
                        className="flex-1 h-11 rounded-xl border-white/10 text-white hover:bg-white/10"
                      >
                        ย้อนกลับ
                      </Button>
                      <Button 
                        type="submit"
                        disabled={isLoading || !acceptTerms || !acceptAge}
                        className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-500/90 hover:to-green-500/90 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            กำลังสมัคร...
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4 mr-2" />
                            สมัครสมาชิก
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Success */}
                {step === 4 && (
                  <div className="space-y-6 animate-fade-in text-center py-4">
                    {/* Success Icon */}
                    <div className="relative inline-flex">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full blur-xl opacity-50 animate-pulse" />
                      <div className="relative size-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                        <PartyPopper className="size-10 text-white" />
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">สมัครสำเร็จ!</h2>
                      <p className="text-white/60 text-sm">ยินดีต้อนรับ��ู่ FIN LOTTO PREMIUM</p>
                    </div>

                    {/* Info Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-white/60 mb-1">Username ของคุณ</p>
                          <p className="text-lg font-bold text-emerald-400">{registeredUsername}</p>
                        </div>
                        {freeCredit > 0 && (
                          <div className="pt-2 border-t border-white/10">
                            <p className="text-xs text-white/60 mb-1">เครดิตฟรีที่ได้รับ</p>
                            <p className="text-2xl font-bold text-amber-400">
                              <Gift className="inline size-5 mr-1" />
                              {freeCredit.toLocaleString()} บาท
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button 
                      type="button"
                      onClick={() => router.push('/c/login')}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-[#1D9BF0] to-blue-500 hover:from-[#1D9BF0]/90 hover:to-blue-500/90 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all"
                    >
                      เข้าสู่ระบบ
                    </Button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Benefits - Hide on success */}
        {step < 4 && (
          <div className="max-w-sm mx-auto mb-6">
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Shield, text: 'ปลอดภัย 100%', color: 'text-blue-400' },
                { icon: Gift, text: 'โบนัสสมัครใหม่', color: 'text-amber-400' },
                { icon: MessageCircle, text: 'ซัพพอร์ต 24 ชม.', color: 'text-green-400' },
                { icon: CheckCircle2, text: 'ฝากถอนไว', color: 'text-emerald-400' },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                  <item.icon className={`size-4 ${item.color}`} />
                  <span className="text-xs text-white/70">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="max-w-sm mx-auto text-center">
          <p className="text-white/40 text-xs">
            มีบัญชีแล้ว?{' '}
            <Link href="/c/login" className="text-[#1D9BF0] hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function CustomerRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060B14] flex items-center justify-center">
        <Loader2 className="size-8 text-emerald-500 animate-spin" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
