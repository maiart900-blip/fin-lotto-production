import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 -top-48 -right-48 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute w-64 h-64 top-1/2 -left-32 bg-blue-500/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative text-center max-w-md">
        {/* 404 Number */}
        <div className="mb-8">
          <h1 className="text-[150px] font-bold leading-none bg-gradient-to-b from-amber-400 to-amber-600 bg-clip-text text-transparent">
            404
          </h1>
        </div>
        
        {/* Message */}
        <h2 className="text-2xl font-bold text-white mb-3">
          ไม่พบหน้าที่คุณต้องการ
        </h2>
        <p className="text-[#94A3B8] mb-8">
          หน้านี้อาจถูกย้าย ลบ หรือไม่มีอยู่จริง กรุณาตรวจสอบ URL อีกครั้ง
        </p>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-black font-semibold">
              <Home className="size-4 mr-2" />
              กลับหน้าหลัก
            </Button>
          </Link>
          <Link href="/c">
            <Button variant="outline" className="w-full sm:w-auto border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
              <ArrowLeft className="size-4 mr-2" />
              หน้าลูกค้า
            </Button>
          </Link>
        </div>
        
        {/* Help text */}
        <p className="text-xs text-[#64748B] mt-8">
          หากคุณคิดว่านี่เป็นข้อผิดพลาด กรุณาติดต่อฝ่ายบริการลูกค้า
        </p>
      </div>
    </div>
  );
}
