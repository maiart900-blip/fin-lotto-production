'use client';

import { useState, useEffect } from 'react';
import { Smartphone, X, Share, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

interface TenantSettings {
  brand_name?: string;
  brand_logo_url?: string;
  brand_primary_color?: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function InstallAppButton({ 
  variant = 'menu',
  className 
}: { 
  variant?: 'menu' | 'banner' | 'button';
  className?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  
  // Fetch tenant settings for dynamic branding
  const { data: tenantSettings } = useSWR<TenantSettings>('/api/tenant-settings', fetcher);
  
  const brandName = tenantSettings?.brand_name || 'FIN LOTTO';
  const brandLogo = tenantSettings?.brand_logo_url;
  const brandColor = tenantSettings?.brand_primary_color || '#D4AF37';

  useEffect(() => {
    // Check if already installed (standalone mode)
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);
    
    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    
    // Listen for beforeinstallprompt (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    // Android: Use native prompt
    if (deferredPrompt) {
      setIsInstalling(true);
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      }
      setIsInstalling(false);
      return;
    }
    
    // iOS: Show instruction modal
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    
    // Fallback: Show iOS modal for unsupported browsers
    setShowIOSModal(true);
  };

  // Don't show if already installed
  if (isStandalone) {
    return null;
  }

  // Menu item variant (for sidebar)
  if (variant === 'menu') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className={cn(
            'flex items-center gap-3 px-3 py-3 rounded-xl transition-all w-full',
            'bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30',
            'text-amber-400 hover:from-amber-500/30 hover:to-amber-600/20',
            className
          )}
        >
          <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Smartphone className="size-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-white">ดาวน์โหลดแอป</p>
            <p className="text-xs text-amber-400/70">ติดตั้งบนมือถือ</p>
          </div>
          <ChevronRight className="size-4 text-amber-400/60" />
        </button>
        
        {/* iOS Install Modal */}
        <IOSInstallModal 
          isOpen={showIOSModal} 
          onClose={() => setShowIOSModal(false)}
          brandName={brandName}
          brandLogo={brandLogo}
          brandColor={brandColor}
        />
      </>
    );
  }

  // Banner variant (for bottom of page)
  if (variant === 'banner') {
    return (
      <>
        <div className={cn(
          'fixed bottom-20 left-4 right-4 z-30',
          'bg-gradient-to-r from-[#0D1321] to-[#1a1a2e] rounded-2xl',
          'border border-amber-500/30 shadow-2xl shadow-amber-500/10',
          'p-4 flex items-center gap-4',
          className
        )}>
          <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
            <Smartphone className="size-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">ติดตั้งแอป {brandName}</p>
            <p className="text-sm text-neutral-400">เข้าถึงได้รวดเร็วจากหน้าจอ</p>
          </div>
          <Button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-4"
          >
            {isInstalling ? 'กำลังติดตั้ง...' : 'ติดตั้ง'}
          </Button>
        </div>
        
        <IOSInstallModal 
          isOpen={showIOSModal} 
          onClose={() => setShowIOSModal(false)}
          brandName={brandName}
          brandLogo={brandLogo}
          brandColor={brandColor}
        />
      </>
    );
  }

  // Button variant (standalone)
  return (
    <>
      <Button
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={cn(
          'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500',
          'text-black font-bold shadow-lg shadow-amber-500/20',
          'border border-amber-400/50',
          className
        )}
      >
        <Smartphone className="size-4 mr-2" />
        {isInstalling ? 'กำลังติดตั้ง...' : 'ดาวน์โหลดแอป'}
      </Button>
      
      <IOSInstallModal 
        isOpen={showIOSModal} 
        onClose={() => setShowIOSModal(false)}
        brandName={brandName}
        brandLogo={brandLogo}
        brandColor={brandColor}
      />
    </>
  );
}

// iOS Install Instructions Modal
function IOSInstallModal({ 
  isOpen, 
  onClose,
  brandName,
  brandLogo,
  brandColor,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  brandName: string;
  brandLogo?: string;
  brandColor: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md mx-4 mb-4 bg-gradient-to-br from-[#0D1321] to-[#1a1a2e] rounded-3xl border border-amber-500/30 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="relative p-6 pb-4 text-center border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 size-8 rounded-full bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/20 transition-all"
          >
            <X className="size-4" />
          </button>
          
          {/* App Icon */}
          <div className="mx-auto mb-4 size-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/30 border-2 border-amber-400/50">
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} className="size-12 object-contain" />
            ) : (
              <Smartphone className="size-10 text-white" />
            )}
          </div>
          
          <h2 className="text-xl font-bold text-white mb-1">ติดตั้งแอป {brandName}</h2>
          <p className="text-sm text-neutral-400">เพิ่มไอคอนลงหน้าจอเพื่อเข้าถึงได้รวดเร็ว</p>
        </div>
        
        {/* Instructions */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-amber-400 font-medium text-center mb-4">
            ทำตามขั้นตอนง่ายๆ ดังนี้
          </p>
          
          {/* Step 1 */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="size-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 text-white font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium text-white mb-1">กดปุ่ม Share</p>
              <p className="text-sm text-neutral-400">
                กดไอคอน{' '}
                <span className="inline-flex items-center justify-center size-6 rounded bg-blue-500/20 mx-1">
                  <Share className="size-4 text-blue-400" />
                </span>
                {' '}ที่แถบด้านล่างของ Safari
              </p>
            </div>
          </div>
          
          {/* Step 2 */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="size-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 text-white font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="font-medium text-white mb-1">เลือก &quot;Add to Home Screen&quot;</p>
              <p className="text-sm text-neutral-400">
                เลื่อนลงและกด{' '}
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-white/10 mx-1 text-xs">
                  <Plus className="size-3 mr-1" />
                  เพิ่มไปหน้าจอหลัก
                </span>
              </p>
            </div>
          </div>
          
          {/* Step 3 */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="size-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0 text-white font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium text-white mb-1">กด &quot;เพิ่ม&quot;</p>
              <p className="text-sm text-neutral-400">
                ยืนยันการติดตั้งโดยกดปุ่ม &quot;เพิ่ม&quot; ที่มุมขวาบน
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-6 pt-2">
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold h-12 rounded-xl"
          >
            เข้าใจแล้ว
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InstallAppButton;
