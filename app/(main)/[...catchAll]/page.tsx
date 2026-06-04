'use client';

import { usePathname } from 'next/navigation';
import { AlertTriangle, Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';

export default function CatchAllPage() {
  const router = useRouter();
  const pathname = usePathname();

  // EXCLUSION RULE: ห้าม intercept routes ที่เป็น /agent/*
  // ปล่อยให้ Next.js route ไปยัง app/agent/* ตามปกติ
  if (pathname.startsWith('/agent/') || pathname === '/agent') {
    notFound();
  }

  // ดึงชื่อหน้าจาก pathname
  const pageName = pathname.replace(/\//g, ' ').trim() || 'Unknown';

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-3xl blur-xl" />
        
        {/* Card */}
        <div className="relative p-8 rounded-3xl backdrop-blur-xl bg-gradient-to-b from-black/60 to-black/40 border border-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.1)]">
          <div className="text-center space-y-6">
            {/* Icon */}
            <div className="mx-auto size-20 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/30">
              <AlertTriangle className="size-10 text-red-400" />
            </div>
            
            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-red-200 to-red-400 bg-clip-text text-transparent">
                404 - ไม่พบหน้านี้
              </h1>
              <p className="text-slate-400">
                หน้าที่คุณกำลังค้นหาไม่มีอยู่ในระบบ
              </p>
            </div>
            
            {/* Page Info */}
            <div className="py-4 px-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-2">URL ที่ร้องขอ:</p>
              <p className="text-sm text-red-400 font-mono break-all">{pathname}</p>
            </div>
            
            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={() => router.back()}
                variant="outline"
                className="h-11 border-slate-600 text-slate-300 hover:bg-slate-800 rounded-xl"
              >
                <ArrowLeft className="size-4 mr-2" />
                ย้อนกลับ
              </Button>
              <Link href="/">
                <Button className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-xl">
                  <Home className="size-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            </div>
            
            {/* Help text */}
            <p className="text-xs text-slate-500">
              หากคุณเชื่อว่านี่คือข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
