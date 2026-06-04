'use client';

import { usePathname } from 'next/navigation';
import { Construction, Home, ArrowLeft } from 'lucide-react';
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

  // ดึงชื่อหน้าจาก pathname เช่น /topup-requests -> คำขอเติมเงิน
  const pageNames: Record<string, string> = {
    '/topup-requests': 'คำขอเติมเงิน',
    '/withdraw-requests': 'คำขอถอนเงิน',
    '/prize-payout': 'จ่ายรางวัลลูกค้าคีย์',
    '/credits': 'ปรับยอดเครดิต',
    '/deposit-issues': 'แจ้งปัญหาฝากเงิน',
    '/pending-review': 'รายการรอตรวจสอบ',
    '/customer-history': 'ประวัติสมาชิก',
    '/customer-banks': 'ธนาคารลูกค้า',
    '/member-summary': 'สรุปแมมเบอร์',
    '/payment-gateway': 'จัดการ Payment Gateway',
    '/wallet-manager': 'จัดการกระเป๋าเงิน',
    '/bank-settings': 'ตั้งค่าธนาคาร',
    '/payment-accounts': 'บัญชีรับเงิน',
    '/withdraw-accounts': 'บัญชีถอนเงิน',
    '/scb-maemanee': 'SCB แม่มณี',
    '/transactions': 'ประวัติธุรกรรม',
    '/finance-reports': 'รายงานการเงิน',
    '/promotions': 'จัดการโปรโมชั่น',
    '/referrals': 'แนะนำลูกค้า',
    '/lead-users': 'ยูสนำแทง',
    '/member-links': 'ลิงก์สมาชิก',
    '/notifications': 'การแจ้งเตือน',
    '/content-pages': 'คู่มือ/กติกา',
    '/marketing-center': 'ลิงก์ทั้งหมด',
    '/users': 'จัดการผู้ใช้',
    '/roles-permissions': 'สิทธิ์การใช้งาน',
    '/payroll': 'สรุปเงินเดือน',
    '/security-dashboard': 'Security Dashboard',
    '/audit-logs': 'ประวัติการใช้งาน',
    '/backup': 'สำรองข้อมูล',
    '/health-check': 'Health Check',
    '/master-credit': 'เครดิตแม่',
    '/partners': 'หุ้นส่วน',
    '/web-theme': 'ตั้งค่าธีม',
    '/manage-images': 'จัดการรูปภาพ',
    '/desktop-settings': 'ตั้งค่าหน้าเว็บ',
    '/profit-loss': 'กำไร/ขาดทุน',
  };

  const pageName = pageNames[pathname] || pathname.replace(/\//g, ' ').trim();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-3xl blur-xl" />
        
        {/* Card */}
        <div className="relative p-8 rounded-3xl backdrop-blur-xl bg-gradient-to-b from-black/60 to-black/40 border border-amber-500/20 shadow-[0_0_60px_rgba(212,175,55,0.1)]">
          <div className="text-center space-y-6">
            {/* Icon */}
            <div className="mx-auto size-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
              <Construction className="size-10 text-amber-400" />
            </div>
            
            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
                Coming Soon
              </h1>
              <p className="text-slate-400">
                หน้านี้กำลังอยู่ในระหว่างการพัฒนา
              </p>
            </div>
            
            {/* Page Info */}
            <div className="py-4 px-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <p className="text-xs text-slate-500 mb-2">หน้าที่ต้องการ:</p>
              <p className="text-lg text-amber-400 font-semibold">{pageName}</p>
              <p className="text-xs text-slate-500 mt-1 font-mono">{pathname}</p>
            </div>
            
            {/* Status */}
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="size-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-sm text-blue-300">
                อยู่ระหว่างพัฒนา
              </span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
