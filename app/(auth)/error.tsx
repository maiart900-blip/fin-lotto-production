'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Auth Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <div className="flex justify-center">
          <AlertTriangle className="h-16 w-16 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">เกิดข้อผิดพลาด</h2>
        <p className="text-muted-foreground max-w-md">
          ไม่สามารถโหลดหน้านี้ได้ กรุณาลองใหม่อีกครั้ง
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>ลองอีกครั้ง</Button>
          <Button variant="outline" onClick={() => window.location.href = '/login'}>
            กลับหน้าเข้าสู่ระบบ
          </Button>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
