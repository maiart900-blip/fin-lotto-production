'use client';

import { DynamicThemeProvider } from '@/lib/dynamic-theme';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DynamicThemeProvider>
      {children}
    </DynamicThemeProvider>
  );
}
