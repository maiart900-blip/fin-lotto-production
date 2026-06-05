'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { NumericKeypad } from '@/components/customer/numeric-keypad';
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
  Mail,
  Zap,
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [lineId, setLineId] = useState('');
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

  // Validation states
  const [emailValid, setEmailValid] = useState<boolean | null>(null);

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

  // Email validation
  useEffect(() => {
    if (email.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setEmailValid(emailRegex.test(email));
    } else {
      setEmailValid(null);
    }
  }, [email]);

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
          email,
          phone, 
          password, 
          line_id: lineId,
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
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
      {/* Luxury Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Gold Light Streaks */}
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-amber-500/20 to-transparent" />
        <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-yellow-500/15 to-transparent" />
        <div className="absolute top-0 left-2/3 w-px h-full bg-gradient-to-b from-transparent via-amber-400/10 to-transparent" />
        
        {/* Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[100px]" />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-yellow-500/5 rounded-full blur-[80px]" />
        
        {/* Subtle Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4AF37' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-3">
        <Link href="/c/login" className="inline-flex items-center gap-2 text-amber-400/70 hover:text-amber-400 transition-colors">
          <ArrowLeft className="size-5" />
          <span className="text-sm font-medium">กลับ</span>
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
                className="h-16 w-auto drop-shadow-[0_0_20px_rgba(212,175,55,0.5)]"
              />
            ) : (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl blur-lg opacity-60 animate-pulse" />
                <div className="relative size-16 rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/30 border border-amber-400/30">
                  <Crown className="size-8 text-black drop-shadow-lg" />
                </div>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent">
            สมัครสมาชิก
          </h1>
          <p className="text-amber-500/60 text-sm mt-1 font-medium">{siteSettings?.site_name || 'FIN LOTTO PREMIUM'}</p>
        </div>

        {/* Progress Steps - Hide on success */}
        {step < 4 && (
          <div className="max-w-md mx-auto mb-6">
            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`size-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2 ${
                    step >= s 
                      ? 'bg-gradient-to-br from-amber-400 to-yellow-600 border-amber-300 text-black shadow-lg shadow-amber-500/30' 
                      : 'bg-neutral-900 border-neutral-700 text-neutral-500'
                  }`}>
                    {step > s ? <CheckCircle2 className="size-5" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`w-12 h-1 rounded-full transition-all ${step > s ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : 'bg-neutral-800'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 px-2 text-xs font-semibold">
              <span className={step >= 1 ? 'text-amber-400' : 'text-neutral-600'}>ยืนยันเบอร์</span>
              <span className={step >= 2 ? 'text-amber-400' : 'text-neutral-600'}>ตั้งค่าบัญชี</span>
              <span className={step >= 3 ? 'text-amber-400' : 'text-neutral-600'}>ยืนยัน</span>
            </div>
          </div>
        )}

        {/* Main Card - Obsidian Glassmorphism */}
        <div className="max-w-md mx-auto mb-6">
          <div className="relative">
            {/* Gold Border Glow */}
            <div className="absolute -inset-[2px] bg-gradient-to-r from-amber-500/50 via-yellow-400/60 to-amber-500/50 rounded-3xl blur-sm" />
            <div className="absolute -inset-[1px] bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-3xl opacity-40" />
            
            {/* Card */}
            <div className="relative rounded-3xl bg-gradient-to-br from-neutral-900/95 via-black/95 to-neutral-900/95 backdrop-blur-xl border border-amber-500/30 overflow-hidden">
              
              {/* Top Promotion Banner */}
              {step < 4 && (
                <div className="relative bg-gradient-to-r from-amber-500/10 via-yellow-500/15 to-amber-500/10 border-b border-amber-500/20 px-6 py-4">
                  <div className="flex items-center gap-4">
                    {/* 3D Gift Box */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-amber-500/30 rounded-xl blur-lg animate-pulse" />
                      <div className="relative w-16 h-16 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-xl border-2 border-amber-500/50 flex items-center justify-center shadow-xl">
                        <Gift className="w-8 h-8 text-amber-400" />
                        {/* Ribbon */}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-3 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-t-full" />
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div className="flex gap-0.5">
                            <div className="w-2 h-4 bg-gradient-to-b from-amber-400 to-yellow-500 rounded-full transform -rotate-12" />
                            <div className="w-2 h-4 bg-gradient-to-b from-amber-400 to-yellow-500 rounded-full transform rotate-12" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-amber-400 font-bold text-lg leading-tight">
                        สมัครตอนนี้ รับโบนัสทันที
                      </p>
                      <p className="text-yellow-400 font-extrabold text-2xl">
                        100% สูงสุด 5,000 บาท
                      </p>
                    </div>
                    
                    <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Form Content */}
              <div className="p-6">
                <form onSubmit={handleRegister} className="space-y-5">
                  
                  {/* STEP 1: Phone Verification */}
                  {step === 1 && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/30 flex items-center justify-center">
                          <Phone className="size-5 text-amber-400" />
                        </div>
                        <span className="text-lg font-bold text-amber-400">ยืนยันเบอร์โทรศัพท์</span>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-amber-400/80">เบอร์โทรศัพท์</label>
                        {/* Phone Display */}
                        <div className="flex justify-center gap-1.5 py-4">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-8 h-12 rounded-lg flex items-center justify-center text-xl font-bold font-mono transition-all ${
                                phone[i] 
                                  ? 'bg-amber-500/10 border-2 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20' 
                                  : 'bg-neutral-900 border-2 border-neutral-700 text-neutral-600'
                              }`}
                            >
                              {phone[i] || '-'}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-neutral-500 text-center">ใช้สำหรับเข้าสู่ระบบและรับ OTP</p>
                      </div>

                      {/* Numeric Keypad */}
                      <NumericKeypad
                        onInput={(digit) => {
                          if (phone.length < 10) {
                            setPhone(prev => prev + digit);
                          }
                        }}
                        onDelete={() => setPhone(prev => prev.slice(0, -1))}
                        onClear={() => setPhone('')}
                        disabled={phone.length >= 10}
                      />

                      <Button 
                        type="button"
                        onClick={nextStep}
                        disabled={phone.length !== 10}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-500 hover:via-yellow-600 hover:to-amber-600 text-black font-bold text-lg shadow-xl shadow-amber-500/30 transition-all disabled:opacity-50 border border-amber-300/50"
                      >
                        <Zap className="w-5 h-5 mr-2" />
                        ยืนยันเบอร์โทร
                      </Button>
                    </div>
                  )}

                  {/* STEP 2: Account Setup */}
                  {step === 2 && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/30 flex items-center justify-center">
                          <User className="size-5 text-amber-400" />
                        </div>
                        <span className="text-lg font-bold text-amber-400">ตั้งค่าบัญชีผู้ใช้</span>
                      </div>

                      {/* Username */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <User className="size-4" />
                          ชื่อผู้ใช้ (Username)
                        </label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="ตั้ง username ของคุณ"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            className="h-12 bg-neutral-900/80 border-2 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl focus:border-amber-500 focus:ring-amber-500/20 pr-10"
                          />
                          {checkingUsername && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-amber-400 animate-spin" />
                          )}
                          {!checkingUsername && usernameAvailable === true && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-emerald-400" />
                          )}
                          {!checkingUsername && usernameAvailable === false && (
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-red-400" />
                          )}
                        </div>
                        {usernameAvailable === false && (
                          <p className="text-xs text-red-400">Username นี้ถูกใช้งานแล้ว</p>
                        )}
                        {usernameAvailable === true && (
                          <p className="text-xs text-emerald-400">Username นี้ใช้งานได้</p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <Mail className="size-4" />
                          อีเมล (Email)
                        </label>
                        <div className="relative">
                          <Input
                            type="email"
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12 bg-neutral-900/80 border-2 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl focus:border-amber-500 focus:ring-amber-500/20 pr-10"
                          />
                          {emailValid === true && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-emerald-400" />
                          )}
                          {emailValid === false && (
                            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-red-400" />
                          )}
                        </div>
                      </div>

                      {/* Password */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <Lock className="size-4" />
                          รหัสผ่าน (Password)
                        </label>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="อย่างน้อย 6 ตัวอักษร"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-12 bg-neutral-900/80 border-2 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl focus:border-amber-500 focus:ring-amber-500/20 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-amber-400 transition-colors"
                          >
                            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                          </button>
                        </div>
                        {/* Password Strength Meter */}
                        {password && (
                          <div className="space-y-1">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map((level) => (
                                <div
                                  key={level}
                                  className={`h-1.5 flex-1 rounded-full transition-all ${
                                    passwordStrength >= level ? strengthColors[passwordStrength] : 'bg-neutral-700'
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
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <Lock className="size-4" />
                          ยืนยันรหัสผ่าน
                        </label>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="กรอกรหัสผ่านอีกครั้ง"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-12 bg-neutral-900/80 border-2 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl focus:border-amber-500 focus:ring-amber-500/20 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-amber-400 transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                          </button>
                        </div>
                        {confirmPassword && (
                          <div className="flex items-center gap-2">
                            {password === confirmPassword ? (
                              <>
                                <CheckCircle2 className="size-4 text-emerald-400" />
                                <p className="text-xs text-emerald-400">รหัสผ่านตรงกัน</p>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="size-4 text-red-400" />
                                <p className="text-xs text-red-400">รหัสผ่านไม่ตรงกัน</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Phone Display (from Step 1) */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <Phone className="size-4" />
                          เบอร์โทรศัพท์
                        </label>
                        <div className="relative">
                          <Input
                            type="text"
                            value={phone}
                            readOnly
                            className="h-12 bg-neutral-800/50 border-2 border-neutral-700 text-white rounded-xl pr-10"
                          />
                          <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-emerald-400" />
                        </div>
                      </div>

                      {/* Line ID (Optional) */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <MessageCircle className="size-4" />
                          Line ID <span className="text-neutral-500 font-normal">(ไม่บังคับ)</span>
                        </label>
                        <Input
                          type="text"
                          placeholder="@line_id"
                          value={lineId}
                          onChange={(e) => setLineId(e.target.value)}
                          className="h-12 bg-neutral-900/80 border-2 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl focus:border-amber-500 focus:ring-amber-500/20"
                        />
                      </div>

                      {/* Bank Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <Building2 className="size-4" />
                          ธนาคาร
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {banks.map((bank) => (
                            <button
                              key={bank.code}
                              type="button"
                              onClick={() => setBankCode(bank.code)}
                              className={`p-2 rounded-xl border-2 transition-all ${
                                bankCode === bank.code
                                  ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20'
                                  : 'border-neutral-700 bg-neutral-900/50 hover:border-neutral-600'
                              }`}
                            >
                              <div 
                                className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-xs font-bold text-white"
                                style={{ backgroundColor: bank.color }}
                              >
                                {bank.code.slice(0, 3)}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bank Account Number */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <CreditCard className="size-4" />
                          เลขบัญชี
                        </label>
                        <Input
                          type="text"
                          placeholder="กรอกเลขบัญชีธนาคาร"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                          className="h-12 bg-neutral-900/80 border-2 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl focus:border-amber-500 focus:ring-amber-500/20"
                        />
                      </div>

                      {/* Bank Account Name */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <User className="size-4" />
                          ชื่อบัญชี
                        </label>
                        <Input
                          type="text"
                          placeholder="ชื่อ-นามสกุล ตามบัญชีธนาคาร"
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          className="h-12 bg-neutral-900/80 border-2 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl focus:border-amber-500 focus:ring-amber-500/20"
                        />
                      </div>

                      {/* Referral Code */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-amber-400/80 flex items-center gap-2">
                          <Gift className="size-4" />
                          รหัสแนะนำ <span className="text-neutral-500 font-normal">(ถ้ามี)</span>
                        </label>
                        <Input
                          type="text"
                          placeholder="กรอกรหัสแนะนำ"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          className="h-12 bg-neutral-900/80 border-2 border-neutral-700 text-white placeholder:text-neutral-500 rounded-xl focus:border-amber-500 focus:ring-amber-500/20"
                        />
                      </div>

                      {/* Navigation Buttons */}
                      <div className="flex gap-3 pt-2">
                        <Button 
                          type="button"
                          onClick={() => setStep(1)}
                          variant="outline"
                          className="flex-1 h-12 rounded-xl border-2 border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          ย้อนกลับ
                        </Button>
                        <Button 
                          type="button"
                          onClick={nextStep}
                          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-500 hover:via-yellow-600 hover:to-amber-600 text-black font-bold shadow-xl shadow-amber-500/30 border border-amber-300/50"
                        >
                          ถัดไป
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Confirmation */}
                  {step === 3 && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border border-amber-500/30 flex items-center justify-center">
                          <Shield className="size-5 text-amber-400" />
                        </div>
                        <span className="text-lg font-bold text-amber-400">ยืนยันข้อมูล</span>
                      </div>

                      {/* Summary */}
                      <div className="bg-neutral-900/50 rounded-xl p-4 space-y-3 border border-neutral-700/50">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Username:</span>
                          <span className="text-white font-medium">{username}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">อีเมล:</span>
                          <span className="text-white font-medium">{email || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">เบอร์โทร:</span>
                          <span className="text-white font-medium">{phone}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">Line ID:</span>
                          <span className="text-white font-medium">{lineId || '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">ธนาคาร:</span>
                          <span className="text-white font-medium">{banks.find(b => b.code === bankCode)?.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">เลขบัญชี:</span>
                          <span className="text-white font-medium">{accountNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-400">ชื่อบัญชี:</span>
                          <span className="text-white font-medium">{accountName}</span>
                        </div>
                      </div>

                      {/* Terms & Conditions */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="terms"
                            checked={acceptTerms}
                            onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                            className="mt-1 border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                          />
                          <label htmlFor="terms" className="text-sm text-neutral-300 leading-relaxed">
                            ข้าพเจ้ายอมรับ <Link href="/rules" className="text-amber-400 hover:underline">ข้อตกลงและเงื่อนไข</Link> ในการใช้บริการ
                          </label>
                        </div>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="age"
                            checked={acceptAge}
                            onCheckedChange={(checked) => setAcceptAge(checked as boolean)}
                            className="mt-1 border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                          />
                          <label htmlFor="age" className="text-sm text-neutral-300 leading-relaxed">
                            ข้าพเจ้ามีอายุ 18 ปีบริบูรณ์ และยินยอมให้เก็บข้อมูลส่วนบุคคล
                          </label>
                        </div>
                      </div>

                      {/* Navigation Buttons */}
                      <div className="flex gap-3 pt-2">
                        <Button 
                          type="button"
                          onClick={() => setStep(2)}
                          variant="outline"
                          className="flex-1 h-12 rounded-xl border-2 border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          ย้อนกลับ
                        </Button>
                        <Button 
                          type="submit"
                          disabled={!acceptTerms || !acceptAge || isLoading}
                          className="flex-1 h-14 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-500 hover:via-yellow-600 hover:to-amber-600 text-black font-bold text-lg shadow-xl shadow-amber-500/30 border border-amber-300/50 disabled:opacity-50"
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Crown className="w-5 h-5 mr-2" />
                              สมัครสมาชิก
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Success */}
                  {step === 4 && (
                    <div className="text-center py-6 animate-fade-in">
                      <div className="relative inline-block mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full blur-xl opacity-50 animate-pulse" />
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-2xl border-4 border-emerald-300/50">
                          <PartyPopper className="w-12 h-12 text-white" />
                        </div>
                      </div>
                      
                      <h2 className="text-2xl font-bold text-emerald-400 mb-2">สมัครสมาชิกสำเร็จ!</h2>
                      <p className="text-neutral-400 mb-4">ยินดีต้อนรับสู่ FIN LOTTO PREMIUM</p>
                      
                      <div className="bg-gradient-to-br from-amber-500/10 to-yellow-600/10 rounded-xl p-4 mb-6 border border-amber-500/30">
                        <p className="text-amber-400 text-sm mb-1">Username ของคุณ</p>
                        <p className="text-2xl font-bold text-white">{registeredUsername}</p>
                        {freeCredit > 0 && (
                          <div className="mt-3 pt-3 border-t border-amber-500/20">
                            <p className="text-amber-400 text-sm">คุณได้รับเครดิตฟรี</p>
                            <p className="text-3xl font-bold text-amber-400">฿{freeCredit.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        onClick={() => router.push('/c/login')}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-500 hover:via-yellow-600 hover:to-amber-600 text-black font-bold text-lg shadow-xl shadow-amber-500/30 border border-amber-300/50"
                      >
                        เข้าสู่ระบบเลย
                      </Button>
                    </div>
                  )}
                </form>

                {/* Social Login - Only on Step 1 & 2 */}
                {step < 3 && (
                  <div className="mt-6 pt-6 border-t border-neutral-800">
                    <p className="text-center text-neutral-500 text-sm mb-4">หรือสมัครด้วย</p>
                    <div className="flex gap-3">
                      <button className="flex-1 h-12 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-600 flex items-center justify-center gap-2 transition-all">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="text-white text-sm font-medium">Google</span>
                      </button>
                      <button className="flex-1 h-12 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-600 flex items-center justify-center gap-2 transition-all">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        <span className="text-white text-sm font-medium">Facebook</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges Footer */}
        <div className="max-w-md mx-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <Shield className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-amber-400 text-[10px] font-bold mb-0.5">SSL SECURE</p>
              <p className="text-neutral-500 text-[9px]">เข้ารหัส 256-bit</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <CheckCircle2 className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-amber-400 text-[10px] font-bold mb-0.5">มั่นใจได้</p>
              <p className="text-neutral-500 text-[9px]">จ่ายจริง 100%</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-neutral-900/50 border border-neutral-800">
              <Building2 className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-amber-400 text-[10px] font-bold mb-0.5">ทุกธนาคาร</p>
              <p className="text-neutral-500 text-[9px]">ฝาก-ถอน 1 นาที</p>
            </div>
          </div>
        </div>

        {/* Login Link */}
        <p className="text-center text-neutral-500 text-sm mt-6">
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/c/login" className="text-amber-400 font-semibold hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </main>

      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
