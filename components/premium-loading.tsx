'use client';

import { Loader2, Crown } from 'lucide-react';

interface PremiumLoadingProps {
  message?: string;
  showLogo?: boolean;
}

export function PremiumLoading({ 
  message = 'กำลังโหลดข้อมูล...', 
  showLogo = true 
}: PremiumLoadingProps) {
  return (
    <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 -top-48 -right-48 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute w-64 h-64 top-1/2 -left-32 bg-amber-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute w-80 h-80 bottom-0 right-1/4 bg-amber-300/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      
      <div className="relative text-center space-y-8">
        {/* Logo */}
        {showLogo && (
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="size-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.3)]">
              <Crown className="size-7 text-black" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
              FIN LOTTO
            </span>
          </div>
        )}
        
        {/* Loading Spinner */}
        <div className="relative">
          <div className="size-20 mx-auto rounded-full border-4 border-amber-500/20" />
          <div className="absolute inset-0 size-20 mx-auto rounded-full border-4 border-transparent border-t-amber-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-8 text-amber-400 animate-spin" style={{ animationDirection: 'reverse' }} />
          </div>
        </div>
        
        {/* Message */}
        <div className="space-y-2">
          <p className="text-lg text-amber-300 animate-pulse">{message}</p>
          <p className="text-sm text-slate-500">กรุณารอสักครู่</p>
        </div>
        
        {/* Progress Dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div 
              key={i}
              className="size-2 rounded-full bg-amber-500 animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PremiumLoadingInline({ message = 'กำลังโหลด...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="size-16 rounded-full border-4 border-amber-500/20" />
        <div className="absolute inset-0 size-16 rounded-full border-4 border-transparent border-t-amber-400 animate-spin" />
      </div>
      <p className="text-amber-400 animate-pulse">{message}</p>
    </div>
  );
}

export function PremiumLoadingCard() {
  return (
    <div className="relative p-8 rounded-2xl backdrop-blur-xl bg-gradient-to-b from-black/60 to-black/40 border border-amber-500/20">
      <div className="flex flex-col items-center justify-center gap-4">
        <Loader2 className="size-10 text-amber-400 animate-spin" />
        <p className="text-amber-300 animate-pulse">กำลังโหลดข้อมูล...</p>
      </div>
    </div>
  );
}
