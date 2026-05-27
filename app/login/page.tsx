'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  
  // Get redirect URL from query params
  const redirectUrl = searchParams.get('redirect') || '/';
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Guard to prevent multiple redirects
  const hasRedirectedRef = useRef(false);

  // If already authenticated, redirect to intended page (only once)
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    
    if (!authLoading && isAuthenticated) {
      console.log('[v0] Login: Already authenticated, redirecting to:', redirectUrl);
      hasRedirectedRef.current = true;
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, authLoading, router, redirectUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(username, password);
      
      console.log('[v0] Login success:', user?.displayName, 'redirecting to:', redirectUrl);
      toast.success('เข้าสู่ระบบสำเร็จ');
      
      // Redirect to intended page or user's default page
      const finalRedirect = redirectUrl !== '/' ? redirectUrl : (user?.redirectTo || '/');
      router.replace(finalRedirect);
    } catch (error: any) {
      console.error('[v0] Login error:', error);
      
      // Handle 2FA redirects
      if (error.requires2FASetup || error.requires2FA) {
        toast.info(error.message || 'กรุณาตั้งค่า 2FA');
        router.push(error.redirectTo);
        return;
      }
      
      toast.error(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Already authenticated - show loading while redirecting
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="size-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-neutral-400">กำลังเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-amber-600/5 rounded-full blur-[80px]" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-4">
            <Shield className="size-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">ระบบหลังบ้าน</h1>
          <p className="text-neutral-400 mt-2">เข้าสู่ระบบสำหรับผู้ดูแล / เอเย่นต์</p>
        </div>

        {/* Form Card */}
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm text-neutral-400">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-neutral-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ชื่อผู้ใช้"
                  className="w-full h-12 pl-12 pr-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm text-neutral-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-neutral-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                  className="w-full h-12 pl-12 pr-12 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link 
                href="/forgot-password" 
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-neutral-500 text-sm">
            สำหรับลูกค้าทั่วไป{' '}
            <Link href="/c/login" className="text-amber-400 hover:text-amber-300 transition-colors">
              เข้าสู่ระบบที่นี่
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
