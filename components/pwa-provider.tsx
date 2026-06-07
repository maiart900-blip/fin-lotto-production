'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

// Service Worker and PWA utilities
export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Handle chunk load errors gracefully
    const handleChunkError = (event: ErrorEvent) => {
      if (
        event.message.includes('ChunkLoadError') ||
        event.message.includes('Loading chunk') ||
        event.message.includes('Failed to fetch dynamically imported module')
      ) {
        event.preventDefault();
        console.warn('ChunkLoadError detected, attempting recovery...');
        
        // Show user-friendly message
        toast.error('กำลังอัปเดตแอป กรุณารอสักครู่...', {
          duration: 3000,
        });
        
        // Clear cache and reload after short delay
        setTimeout(() => {
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => caches.delete(name));
            });
          }
          window.location.reload();
        }, 1500);
      }
    };

    // Listen for unhandled errors
    window.addEventListener('error', handleChunkError);

    // Handle unhandled promise rejections (for dynamic imports)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.message?.includes('ChunkLoadError') ||
        event.reason?.message?.includes('Loading chunk') ||
        event.reason?.message?.includes('Failed to fetch')
      ) {
        event.preventDefault();
        console.warn('Dynamic import failed, recovering...');
        
        toast.error('กำลังโหลดใหม่...', { duration: 2000 });
        
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Register service worker for offline support
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    }

    // Detect standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    
    if (isStandalone) {
      document.documentElement.classList.add('pwa-standalone');
      console.log('Running in PWA standalone mode');
    }

    // Handle app visibility change (for cache refresh)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isStandalone) {
        // Check for updates when app comes back to foreground
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return <>{children}</>;
}

// Hook to detect PWA mode
export function usePWAMode() {
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );

  const isFullscreen = typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: fullscreen)').matches;

  return {
    isStandalone,
    isFullscreen,
    isPWA: isStandalone || isFullscreen,
  };
}
