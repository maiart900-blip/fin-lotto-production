'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[v0] Main Error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center p-4 min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto size-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">เกิดข้อผิดพลาด</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-mono text-destructive break-all">
                {error.message}
              </p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              <RefreshCw className="size-4 mr-2" />
              ลองใหม่
            </Button>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                <Home className="size-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
