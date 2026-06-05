'use client';

import { DynamicThemeProvider } from '@/lib/dynamic-theme';
import { PWAProvider } from '@/components/pwa-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DynamicThemeProvider>
      <PWAProvider>
        {children}
      </PWAProvider>
    </DynamicThemeProvider>
  );
}
