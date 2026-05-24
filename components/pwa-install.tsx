'use client';

import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Apple } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);
    
    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    
    // Listen for install prompt (Android/Desktop)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 3 seconds if not dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    // Show iOS prompt after delay if not dismissed
    if (ios && !standalone) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[PWA] Service Worker registered:', reg.scope);
      }).catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted install');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed
  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 shadow-2xl border border-amber-500/30">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-white"
        >
          <X className="size-5" />
        </button>
        
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="size-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
            {isIOS ? (
              <Apple className="size-7 text-slate-900" />
            ) : (
              <Smartphone className="size-7 text-slate-900" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base mb-1">
              ติดตั้งแอป FIN LOTTO R+
            </h3>
            <p className="text-slate-400 text-sm mb-3">
              {isIOS 
                ? 'กด Share แล้วเลือก "Add to Home Screen"'
                : 'ติดตั้งแอปเพื่อเข้าถึงได้เร็วขึ้น'
              }
            </p>
            
            {!isIOS && deferredPrompt && (
              <Button
                onClick={handleInstall}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-bold text-sm h-9 px-4"
              >
                <Download className="size-4 mr-2" />
                ติดตั้งเลย
              </Button>
            )}
            
            {isIOS && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <span>กด</span>
                <span className="px-2 py-1 bg-slate-700 rounded">
                  Share
                </span>
                <span>แล้วเลือก</span>
                <span className="px-2 py-1 bg-slate-700 rounded">
                  Add to Home Screen
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Features */}
        <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-center gap-4 text-xs text-slate-500">
          <span>เร็วกว่าเว็บ</span>
          <span className="text-slate-600">|</span>
          <span>แจ้งเตือนผลหวย</span>
          <span className="text-slate-600">|</span>
          <span>ใช้งาน Offline</span>
        </div>
      </div>
    </div>
  );
}

// Install button for menu
export function InstallAppButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
    
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) return;
    
    if (ios) {
      setCanInstall(true);
      return;
    }
    
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      alert('กด Share (ปุ่มแชร์ด้านล่าง) แล้วเลือก "Add to Home Screen" เพื่อติดตั้งแอป');
      return;
    }
    
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
  };

  if (!canInstall) return null;

  return (
    <Button
      onClick={handleInstall}
      variant="outline"
      className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
    >
      <Download className="size-4 mr-2" />
      ติดตั้งแอป
    </Button>
  );
}
