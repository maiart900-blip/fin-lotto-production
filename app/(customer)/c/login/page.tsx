'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { User, Lock, Eye, EyeOff, Loader2, Check, Shield, CheckCircle, Headphones, Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface SiteSettings {
  logo_url?: string;
  login_background_url?: string;
  site_name?: string;
  line_id?: string;
  line_url?: string;
  line_qr_url?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CustomerLoginPage() {
  const router = useRouter();
  const { data: siteSettings } = useSWR<SiteSettings>('/api/site-settings', fetcher);
  
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!usernameOrEmail || !password) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/customer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: usernameOrEmail, 
          password,
          username: usernameOrEmail,
          email: usernameOrEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('customer', JSON.stringify(data.customer));
      localStorage.setItem('customer_token', data.token);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const verifyRes = await fetch('/api/customer/me');
      if (!verifyRes.ok) {
        throw new Error('Session verification failed');
      }
      
      toast.success('เข้าสู่ระบบสำเร็จ');
      router.replace('/c');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated Background - Gold Light Arch */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Main golden arch glow - like the reference image */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px]">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/20 via-amber-600/10 to-transparent rounded-[100%] blur-[100px] transform scale-y-75" />
        </div>
        
        {/* Side light beams */}
        <div className="absolute top-0 left-0 w-[400px] h-[800px] bg-gradient-to-br from-amber-500/5 via-transparent to-transparent transform -rotate-45 blur-[60px]" />
        <div className="absolute top-0 right-0 w-[400px] h-[800px] bg-gradient-to-bl from-amber-500/5 via-transparent to-transparent transform rotate-45 blur-[60px]" />
        
        {/* Subtle light streaks */}
        <div className="absolute top-[10%] left-[20%] w-[2px] h-[200px] bg-gradient-to-b from-amber-400/30 via-amber-500/10 to-transparent transform rotate-[15deg] blur-[2px]" />
        <div className="absolute top-[5%] right-[25%] w-[2px] h-[250px] bg-gradient-to-b from-amber-400/20 via-amber-500/10 to-transparent transform -rotate-[20deg] blur-[2px]" />
        <div className="absolute top-[8%] left-[35%] w-[1px] h-[180px] bg-gradient-to-b from-amber-300/25 via-transparent to-transparent transform rotate-[10deg] blur-[1px]" />
        <div className="absolute top-[12%] right-[40%] w-[1px] h-[150px] bg-gradient-to-b from-amber-400/20 via-transparent to-transparent transform -rotate-[8deg] blur-[1px]" />
        
        {/* Sparkle particles */}
        <div className="absolute top-[15%] left-[15%] w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse opacity-60" style={{ animationDelay: '0s', animationDuration: '2s' }} />
        <div className="absolute top-[10%] right-[20%] w-1 h-1 bg-amber-300 rounded-full animate-pulse opacity-50" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }} />
        <div className="absolute top-[20%] left-[30%] w-1 h-1 bg-yellow-400 rounded-full animate-pulse opacity-40" style={{ animationDelay: '1s', animationDuration: '3s' }} />
        <div className="absolute top-[25%] right-[35%] w-0.5 h-0.5 bg-amber-200 rounded-full animate-pulse opacity-60" style={{ animationDelay: '1.5s', animationDuration: '2s' }} />
        <div className="absolute top-[18%] left-[45%] w-1 h-1 bg-amber-400 rounded-full animate-pulse opacity-50" style={{ animationDelay: '2s', animationDuration: '2.5s' }} />
        
        {/* Diamond pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30Z' fill='none' stroke='%23d4af37' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md px-4 py-8">
        
        {/* Crown Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Glow effect behind crown */}
            <div className="absolute inset-0 blur-2xl bg-amber-500/40 rounded-full scale-150" />
            <div className="relative w-20 h-20 flex items-center justify-center">
              <Crown className="w-16 h-16 text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]" strokeWidth={1.5} />
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-300 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Main Glassmorphism Card */}
        <div className="relative">
          {/* Gold border glow */}
          <div className="absolute -inset-[1px] bg-gradient-to-b from-amber-400/50 via-amber-600/30 to-amber-400/50 rounded-2xl blur-[1px]" />
          
          {/* Card */}
          <div className="relative bg-black/80 backdrop-blur-xl rounded-2xl border border-amber-500/20 p-6 sm:p-8 shadow-[0_0_60px_rgba(251,191,36,0.15)]">
            
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 mb-2">
                เข้าสู่ระบบ
              </h1>
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-amber-500/50" />
                <Sparkles className="w-4 h-4 text-amber-500/60" />
                <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-amber-500/50" />
              </div>
              <p className="text-neutral-400 text-sm">ยินดีต้อนรับกลับสู่ระบบ</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username or Email Input */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                  <User className="w-4 h-4" />
                  ชื่อผู้ใช้ หรือ อีเมล
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้หรืออีเมล"
                    className="w-full h-14 px-4 bg-black/60 border border-neutral-700/50 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                  <Lock className="w-4 h-4" />
                  รหัสผ่าน
                </label>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    className="w-full h-14 px-4 pr-12 bg-black/60 border border-neutral-700/50 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-amber-400 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors py-2"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-amber-500 border-amber-500' : 'border-neutral-600 hover:border-amber-500/50'}`}>
                    {rememberMe && <Check className="w-3 h-3 text-black" />}
                  </div>
                  <span>จดจำฉัน</span>
                </button>
                <Link 
                  href="/c/forgot-password" 
                  className="text-sm text-amber-400/70 hover:text-amber-400 transition-colors py-2"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>

              {/* Login Button - Brushed Gold */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 rounded-xl font-bold text-lg relative overflow-hidden group disabled:opacity-70 transition-all active:scale-[0.98]"
              >
                {/* Gold gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {/* Shadow glow */}
                <div className="absolute inset-0 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)]" />
                {/* Text */}
                <span className="relative z-10 text-black font-bold drop-shadow-sm">
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  ) : (
                    'เข้าสู่ระบบ'
                  )}
                </span>
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
              <span className="text-neutral-500 text-xs uppercase tracking-wider">หรือ</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button className="h-12 rounded-xl bg-black/60 border border-neutral-700/50 flex items-center justify-center gap-2 text-white hover:bg-neutral-800/80 hover:border-neutral-600 transition-all active:scale-95">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm">Google</span>
              </button>
              <button className="h-12 rounded-xl bg-[#1877F2] flex items-center justify-center gap-2 text-white hover:bg-[#166FE5] transition-all active:scale-95">
                <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span className="text-sm">Facebook</span>
              </button>
            </div>

            {/* Register Link */}
            <div className="text-center mt-6 pt-6 border-t border-neutral-800">
              <span className="text-neutral-400 text-sm">ยังไม่มีบัญชี? </span>
              <Link 
                href="/c/register" 
                className="text-amber-400 font-semibold hover:text-amber-300 transition-colors text-sm"
              >
                สมัครสมาชิก
              </Link>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-black/40 border border-neutral-800/50">
            <Shield className="w-6 h-6 text-amber-400 mb-2" />
            <span className="text-amber-400 text-[10px] font-semibold">ปลอดภัย มั่นใจ</span>
            <span className="text-neutral-500 text-[9px]">เข้ารหัส 256-bit</span>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-black/40 border border-neutral-800/50">
            <CheckCircle className="w-6 h-6 text-amber-400 mb-2" />
            <span className="text-amber-400 text-[10px] font-semibold">เชื่อถือได้</span>
            <span className="text-neutral-500 text-[9px]">จ่ายจริง 100%</span>
          </div>
          <div className="flex flex-col items-center text-center p-3 rounded-xl bg-black/40 border border-neutral-800/50">
            <Headphones className="w-6 h-6 text-amber-400 mb-2" />
            <span className="text-amber-400 text-[10px] font-semibold">24 ชม.</span>
            <span className="text-neutral-500 text-[9px]">ทีมงานมืออาชีพ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
