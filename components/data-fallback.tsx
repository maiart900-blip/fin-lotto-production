'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Loader2, Database, Wifi, WifiOff } from 'lucide-react';

interface DataFallbackProps {
  onRetry: () => void;
  message?: string;
  autoRetry?: boolean;
  autoRetryInterval?: number;
  maxAutoRetries?: number;
}

export function DataFallback({
  onRetry,
  message = 'ไม่สามารถโหลดข้อมูลได้',
  autoRetry = true,
  autoRetryInterval = 5000,
  maxAutoRetries = 3,
}: DataFallbackProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!autoRetry || retryCount >= maxAutoRetries) return;

    setCountdown(Math.ceil(autoRetryInterval / 1000));
    
    const countdownTimer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    const retryTimer = setTimeout(() => {
      setIsRetrying(true);
      setRetryCount(prev => prev + 1);
      onRetry();
      setTimeout(() => setIsRetrying(false), 1000);
    }, autoRetryInterval);

    return () => {
      clearInterval(countdownTimer);
      clearTimeout(retryTimer);
    };
  }, [retryCount, autoRetry, autoRetryInterval, maxAutoRetries, onRetry]);

  const handleManualRetry = () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    onRetry();
    setTimeout(() => setIsRetrying(false), 1000);
  };

  return (
    <div className="relative p-8 rounded-2xl backdrop-blur-xl bg-gradient-to-b from-black/60 to-black/40 border border-amber-500/20 shadow-[0_0_40px_rgba(212,175,55,0.1)]">
      {/* Glow Effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
      
      <div className="relative text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto size-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
          {isRetrying ? (
            <Loader2 className="size-8 text-amber-400 animate-spin" />
          ) : (
            <Database className="size-8 text-amber-400" />
          )}
        </div>
        
        {/* Message */}
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">{message}</h3>
          <p className="text-sm text-slate-400">
            กำลังพยายามเชื่อมต่อใหม่อัตโนมัติ
          </p>
        </div>
        
        {/* Auto Retry Status */}
        {autoRetry && retryCount < maxAutoRetries && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Wifi className="size-4 text-amber-400 animate-pulse" />
            <span className="text-sm text-amber-300">
              {isRetrying 
                ? 'กำลังเชื่อมต่อ...' 
                : `ลองใหม่อัตโนมัติใน ${countdown} วินาที (${retryCount}/${maxAutoRetries})`
              }
            </span>
          </div>
        )}
        
        {retryCount >= maxAutoRetries && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <WifiOff className="size-4 text-red-400" />
            <span className="text-sm text-red-300">
              ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่ด้วยตนเอง
            </span>
          </div>
        )}
        
        {/* Manual Retry Button */}
        <Button 
          onClick={handleManualRetry}
          disabled={isRetrying}
          className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.3)]"
        >
          {isRetrying ? (
            <>
              <Loader2 className="size-5 mr-2 animate-spin" />
              กำลังโหลด...
            </>
          ) : (
            <>
              <RefreshCw className="size-5 mr-2" />
              ลองใหม่ทันที
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Inline version for use within cards/sections
export function DataFallbackInline({
  onRetry,
  message = 'ไม่สามารถโหลดข้อมูลได้',
}: {
  onRetry: () => void;
  message?: string;
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    onRetry();
    setTimeout(() => setIsRetrying(false), 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center">
        <AlertCircle className="size-6 text-amber-400" />
      </div>
      <p className="text-sm text-slate-400">{message}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRetry}
        disabled={isRetrying}
        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
      >
        {isRetrying ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="size-4 mr-2" />
        )}
        ลองใหม่
      </Button>
    </div>
  );
}
