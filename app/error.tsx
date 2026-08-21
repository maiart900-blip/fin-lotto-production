'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Loader2, Headphones } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const maxRetries = 3;

  useEffect(() => {
    console.error('[v0] App Error:', error);
    
    // Auto-retry mechanism
    if (retryCount < maxRetries) {
      const timer = setTimeout(() => {
        setIsRetrying(true);
        setRetryCount(prev => prev + 1);
        reset();
      }, 3000 + (retryCount * 2000)); // Exponential backoff
      
      return () => clearTimeout(timer);
    }
  }, [error, retryCount, reset]);

  const handleManualRetry = () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    reset();
  };

  return (
    <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 -top-48 -right-48 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-64 h-64 top-1/2 -left-32 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute w-80 h-80 bottom-0 right-1/4 bg-amber-400/5 rounded-full blur-3xl" />
      </div>
      
      <div className="relative w-full max-w-md">
        {/* Premium Card */}
        <div className="relative p-8 rounded-3xl backdrop-blur-xl bg-gradient-to-b from-black/60 to-black/40 border border-amber-500/20 shadow-[0_0_60px_rgba(212,175,55,0.1)]">
          {/* Glow Effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
          
          <div className="relative text-center space-y-6">
            {/* Icon */}
            <div className="mx-auto size-20 rounded-full bg-gradient-to-br from-amber-500/20 to-red-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <AlertTriangle className="size-10 text-amber-400" />
            </div>
            
            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                เกิดข้อผิดพลาดชั่วคราว
              </h1>
              <p className="text-slate-400">
                ระบบกำลังพยายามแก้ไขปัญหาให้อัตโนมัติ
              </p>
            </div>
            
            {/* Auto Retry Status */}
            {retryCount < maxRetries && (
              <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Loader2 className="size-4 animate-spin text-amber-400" />
                <span className="text-sm text-amber-300">
                  กำลังลองใหม่อัตโนมัติ... ({retryCount + 1}/{maxRetries})
                </span>
              </div>
            )}
            
            {/* Error Details (Dev only) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-left">
                <p className="text-xs font-mono text-red-400 break-all">
                  {error.message}
                </p>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleManualRetry} 
                disabled={isRetrying}
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.3)] transition-all duration-300"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="size-5 mr-2 animate-spin" />
                    กำลังลองใหม่...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-5 mr-2" />
                    ลองใหม่ทันที
                  </>
                )}
              </Button>
              
              <div className="grid grid-cols-2 gap-3">
                <Link href="/dashboard" className="w-full">
                  <Button variant="outline" className="w-full h-11 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-xl">
                    <Home className="size-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <a href="https://line.me/R/ti/p/@finlotto" target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button variant="outline" className="w-full h-11 border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-xl">
                    <Headphones className="size-4 mr-2" />
                    ติดต่อซัพพอร์ต
                  </Button>
                </a>
              </div>
            </div>
            
            {/* Help Text */}
            <p className="text-xs text-slate-500">
              หากปัญหายังคงอยู่ กรุณาติดต่อฝ่ายบริการลูกค้า 24 ชม.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
