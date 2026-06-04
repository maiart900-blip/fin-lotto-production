'use client';

/**
 * CLIENT-SIDE ROUTE GUARD COMPONENT
 * =================================
 * Shows access denied message and redirects unauthorized users
 */

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Shield, AlertTriangle, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Routes that ONLY super_admin can access
const SUPER_ADMIN_ONLY_ROUTES = [
  '/super-admin',
  '/multi-tenant',
  '/sub-sites',
  '/tenant-manager',
  '/master-control',
  '/security-dashboard',
];

// Routes that require at least admin (not staff)
const ADMIN_ONLY_ROUTES = [
  '/users',
  '/roles-permissions',
  '/desktop-settings',
  '/backup',
];

interface RouteGuardProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
  requireAdmin?: boolean;
}

export function RouteGuard({ children, requireSuperAdmin = false, requireAdmin = false }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isSuperAdmin, isAdmin } = useAuth();
  const [accessDenied, setAccessDenied] = useState(false);
  const [denialReason, setDenialReason] = useState<string>('');

  useEffect(() => {
    if (isLoading) return;

    // Check if user is authenticated
    if (!user) {
      router.push('/login?error=unauthorized');
      return;
    }

    // Auto-detect route restrictions
    let needsSuperAdmin = requireSuperAdmin;
    let needsAdmin = requireAdmin;

    // Check route-based restrictions
    for (const route of SUPER_ADMIN_ONLY_ROUTES) {
      if (pathname === route || pathname.startsWith(route + '/')) {
        needsSuperAdmin = true;
        break;
      }
    }

    for (const route of ADMIN_ONLY_ROUTES) {
      if (pathname === route || pathname.startsWith(route + '/')) {
        needsAdmin = true;
        break;
      }
    }

    // Check access
    if (needsSuperAdmin && !isSuperAdmin) {
      setAccessDenied(true);
      setDenialReason('หน้านี้สำหรับ Super Admin เท่านั้น');
      return;
    }

    if (needsAdmin && !isAdmin) {
      setAccessDenied(true);
      setDenialReason('หน้านี้สำหรับผู้ดูแลระบบเท่านั้น');
      return;
    }

    setAccessDenied(false);
  }, [user, isLoading, isSuperAdmin, isAdmin, pathname, requireSuperAdmin, requireAdmin, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // Show access denied
  if (accessDenied) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-3xl blur-xl" />
          
          {/* Card */}
          <div className="relative p-8 rounded-3xl backdrop-blur-xl bg-gradient-to-b from-black/60 to-black/40 border border-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.1)]">
            <div className="text-center space-y-6">
              {/* Icon */}
              <div className="mx-auto size-20 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border border-red-500/30">
                <Shield className="size-10 text-red-400" />
              </div>
              
              {/* Title */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-red-200 to-red-400 bg-clip-text text-transparent">
                  ไม่มีสิทธิ์เข้าถึง
                </h1>
                <p className="text-slate-400">
                  {denialReason}
                </p>
              </div>
              
              {/* Warning */}
              <div className="py-4 px-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="size-4" />
                  <span>การพยายามเข้าถึงหน้านี้ถูกบันทึกไว้ในระบบ</span>
                </div>
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

  return <>{children}</>;
}

/**
 * Hook to check if current user can access sensitive settings
 */
export function useSensitiveSettingsAccess() {
  const { isSuperAdmin, isLoading } = useAuth();
  
  return {
    canModify: isSuperAdmin,
    isLoading,
  };
}
