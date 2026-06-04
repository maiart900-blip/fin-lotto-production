'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { Phone, Lock, Eye, EyeOff, Loader2, Check } from 'lucide-react';
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
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !password) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/customer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
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
    <div 
      className="min-h-screen bg-black flex flex-col premium-bg-pattern overflow-x-hidden" 
      style={{ 
        fontFamily: "'Kanit', sans-serif",
        ...(siteSettings?.login_background_url ? {
          backgroundImage: `url(${siteSettings.login_background_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        } : {})
      }}
    >
      {/* Animated Background Effects - only show if no custom background */}
      {!siteSettings?.login_background_url && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {/* Radial glow effects */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-20 right-0 w-[300px] h-[300px] bg-amber-600/5 rounded-full blur-[80px]" />
          <div className="absolute bottom-40 left-0 w-[250px] h-[250px] bg-amber-400/5 rounded-full blur-[60px]" />
          
          {/* Sparkle particles */}
          <div className="absolute top-20 left-[10%] w-1 h-1 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
          <div className="absolute top-32 right-[15%] w-1.5 h-1.5 bg-amber-300 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-48 left-[20%] w-1 h-1 bg-amber-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-60 right-[25%] w-1 h-1 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-16 right-[30%] w-0.5 h-0.5 bg-amber-200 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
      )}
      
      {/* Dark overlay for custom background */}
      {siteSettings?.login_background_url && (
        <div className="fixed inset-0 bg-black/60 pointer-events-none" />
      )}
      
      {/* Hero Section with Logo and Welcome */}
      <div className="relative flex-shrink-0 z-10">
        <div className="relative px-4 sm:px-6 pt-8 sm:pt-10 pb-4 sm:pb-6 text-center">
          {/* Logo with Glow */}
          <div className="flex justify-center mb-4 sm:mb-6 float-animation">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-amber-500/30 rounded-full scale-75" />
              {siteSettings?.logo_url ? (
                <img
                  src={siteSettings.logo_url}
                  alt={siteSettings?.site_name || 'FIN LOTTO'}
                  className="relative h-[70px] sm:h-[90px] w-auto drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]"
                />
              ) : (
                <Image
                  src="/images/fin-lotto-logo.png"
                  alt="FIN LOTTO P+"
                  width={200}
                  height={90}
                  className="relative h-[70px] sm:h-[90px] w-auto drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]"
                  priority
                />
              )}
            </div>
          </div>
          
          {/* Welcome Text with Shimmer */}
          <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">
            <span className="text-white">ยินดีต้อนรับสู่ </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 shimmer-gold">FIN LOTTO</span>
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm mb-2">ระบบหวยออนไลน์ที่ดีที่สุด</p>
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-amber-400 text-[10px] sm:text-xs font-medium">จ่ายจริง โอนไว มั่นคง 100%</p>
          </div>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="flex-1 px-4 sm:px-6 pb-6 sm:pb-8 z-10">
        {/* Premium Card Container */}
        <div className="premium-card p-4 sm:p-6 glow-pulse max-w-md mx-auto w-full">
          {/* Form Header */}
          <div className="text-center mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-white">เข้าสู่ระบบ</h2>
            <div className="w-16 h-1 mx-auto mt-2 rounded-full bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
          </div>

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            {/* Phone Input */}
            <div className="relative group">
              <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-amber-500 transition-all group-focus-within:text-amber-400">
                <Phone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เบอร์โทรศัพท์"
                className="input-premium w-full h-12 sm:h-14 pl-11 sm:pl-12 pr-4 text-white placeholder:text-neutral-500 text-sm sm:text-base"
              />
            </div>

            {/* Password Input */}
            <div className="relative group">
              <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-amber-500 transition-all group-focus-within:text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="input-premium w-full h-12 sm:h-14 pl-11 sm:pl-12 pr-12 text-white placeholder:text-neutral-500 text-sm sm:text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-amber-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Remember Me & Forgot Password - Larger Touch Targets */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors min-h-[44px] py-2"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${rememberMe ? 'bg-amber-500 border-amber-500' : 'border-neutral-600 hover:border-amber-500/50'}`}>
                  {rememberMe && <Check className="w-3 h-3 text-black" />}
                </div>
                <span className="text-xs sm:text-sm">จดจำฉัน</span>
              </button>
              <Link href="/c/forgot-password" className="text-xs sm:text-sm text-amber-400 hover:text-amber-300 transition-colors hover:underline min-h-[44px] flex items-center py-2 px-1">
                ลืมรหัสผ่าน?
              </Link>
            </div>

            {/* Login Button - Luxury Style */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-luxury w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg disabled:opacity-70 relative overflow-hidden"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : (
                'เข้าสู่ระบบ'
              )}
            </button>
          </form>

          {/* Social Login Divider */}
          <div className="flex items-center gap-3 sm:gap-4 my-4 sm:my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
            <span className="text-neutral-500 text-[10px] sm:text-xs uppercase tracking-wider">หรือ</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
          </div>

          {/* Social Login Buttons - Larger Touch Targets */}
          <div className="flex gap-2 sm:gap-3">
            <button className="flex-1 h-12 sm:h-14 rounded-xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center gap-2 text-white hover:bg-neutral-700 hover:border-neutral-600 transition-all active:scale-95">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-xs sm:text-sm">Google</span>
            </button>
            <a 
              href={siteSettings?.line_url || (siteSettings?.line_id ? `https://line.me/ti/p/~${siteSettings.line_id}` : '#')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-12 sm:h-14 rounded-xl bg-[#00B900] flex items-center justify-center gap-2 text-white hover:bg-[#00A000] transition-all active:scale-95"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
              </svg>
              <span className="text-xs sm:text-sm">LINE</span>
            </a>
          </div>
        </div>

        {/* Register Link - Larger Touch Target */}
        <div className="text-center mt-4 sm:mt-6">
          <span className="text-neutral-400 text-sm">ยังไม่มีบัญชี? </span>
          <Link href="/c/register" className="text-amber-400 font-semibold hover:text-amber-300 transition-colors hover:underline text-sm inline-flex items-center min-h-[44px] py-2 px-1">
            สมัครสมาชิก
          </Link>
        </div>
      </div>
    </div>
  );
}
