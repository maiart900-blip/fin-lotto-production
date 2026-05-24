'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="size-24 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
          <WifiOff className="size-12 text-amber-500" />
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          ไม่มีการเชื่อมต่ออินเทอร์เน็ต
        </h1>
        
        {/* Description */}
        <p className="text-slate-400 mb-6">
          กรุณาตรวจสอบการเชื่อมต่อ Wi-Fi หรือเครือข่ายมือถือของคุณ แล้วลองใหม่อีกครั้ง
        </p>
        
        {/* Retry Button */}
        <Button
          onClick={() => window.location.reload()}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-bold px-8 py-3"
        >
          <RefreshCw className="size-4 mr-2" />
          ลองใหม่อีกครั้ง
        </Button>
        
        {/* Tips */}
        <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400 mb-2">เคล็ดลับ:</p>
          <ul className="text-xs text-slate-500 space-y-1 text-left">
            <li>- ตรวจสอบว่าเปิด Wi-Fi หรือ Mobile Data แล้ว</li>
            <li>- ลองปิด-เปิดโหมดเครื่องบิน</li>
            <li>- รีสตาร์ทแอปหรือเบราว์เซอร์</li>
          </ul>
        </div>
        
        {/* Brand */}
        <div className="mt-8">
          <span className="text-lg font-bold bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">
            FIN LOTTO R+
          </span>
        </div>
      </div>
    </div>
  );
}
