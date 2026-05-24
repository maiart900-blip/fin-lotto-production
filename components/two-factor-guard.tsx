'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';

interface TwoFactorGuardProps {
  children: React.ReactNode;
}

// หน้าที่ไม่ต้องตรวจ 2FA
const EXEMPT_PATHS = [
  '/login',
  '/register',
  '/verify-2fa',
  '/setup-2fa',
  '/forgot-password',
  '/reset-password',
];

export function TwoFactorGuard({ children }: TwoFactorGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  
  useEffect(() => {
    const checkTwoFactor = async () => {
      // ถ้าเป็นหน้าที่ไม่ต้องตรวจ ข้ามไป
      if (EXEMPT_PATHS.some(path => pathname.startsWith(path))) {
        setIsChecking(false);
        setIsVerified(true);
        return;
      }
      
      // ดึงข้อมูล user จาก localStorage
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        // ไม่มี user redirect ไป login
        router.push('/login');
        return;
      }
      
      try {
        const user = JSON.parse(storedUser);
        
        // ถ้ายืนยัน 2FA แล้วใน session นี้
        if (user.twoFactorVerified) {
          setIsVerified(true);
          setIsChecking(false);
          return;
        }
        
        // ตรวจสอบสถานะ 2FA จาก server
        const res = await fetch(`/api/auth/2fa/verify-guard?user_id=${user.id}&user_type=${user.userType === 'customer' ? 'customer' : 'agent'}&role=${user.role}&session_verified=${user.twoFactorVerified || false}`);
        const data = await res.json();
        
        if (data.success) {
          const status = data.status;
          
          // ถ้า 2FA ไม่ required หรือ verified แล้ว
          if (!status.required || status.verified) {
            setIsVerified(true);
            setIsChecking(false);
            return;
          }
          
          // ถ้าต้อง setup 2FA ก่อน
          if (status.needsSetup) {
            router.push(`/setup-2fa?returnTo=${encodeURIComponent(pathname)}`);
            return;
          }
          
          // ถ้าต้อง verify 2FA
          if (status.needsVerify) {
            router.push(`/verify-2fa?returnTo=${encodeURIComponent(pathname)}`);
            return;
          }
          
          // Default: verified
          setIsVerified(true);
        } else {
          // API error, allow access (fail-open for now)
          setIsVerified(true);
        }
      } catch (error) {
        console.error('Error checking 2FA:', error);
        // Error, allow access (fail-open for now)
        setIsVerified(true);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkTwoFactor();
  }, [pathname, router]);
  
  // กำลังตรวจสอบ
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center size-16 rounded-full bg-amber-500/10 border border-amber-500/30 animate-pulse">
            <Shield className="size-8 text-amber-500" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>กำลังตรวจสอบความปลอดภัย...</span>
          </div>
        </div>
      </div>
    );
  }
  
  // ยืนยันแล้ว แสดงเนื้อหา
  if (isVerified) {
    return <>{children}</>;
  }
  
  // รอ redirect
  return null;
}
