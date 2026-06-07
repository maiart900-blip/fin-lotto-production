'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, LogIn } from 'lucide-react';
import Link from 'next/link';

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Customer Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#0D1321] border-amber-500/20">
        <CardHeader className="text-center">
          <div className="mx-auto size-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="size-8 text-red-400" />
          </div>
          <CardTitle className="text-xl text-white">เกิดข้อผิดพลาด</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-[#94A3B8]">
            ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง
          </p>
          
          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black">
              <RefreshCw className="size-4 mr-2" />
              ลองใหม่
            </Button>
            <Link href="/c" className="flex-1">
              <Button variant="outline" className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <Home className="size-4 mr-2" />
                หน้าหลัก
              </Button>
            </Link>
          </div>
          
          <div className="pt-4 border-t border-white/10">
            <Link href="/c/login">
              <Button variant="ghost" className="w-full text-[#64748B] hover:text-white hover:bg-white/5">
                <LogIn className="size-4 mr-2" />
                เข้าสู่ระบบใหม่
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
