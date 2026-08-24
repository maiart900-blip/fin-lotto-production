'use client';

// Main layout for authenticated pages - v2
import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/use-auth';
// ปิด 2FA ชั่วคราวจนกว่า login จะนิ่ง
// import { TwoFactorGuard } from '@/components/two-factor-guard';
import { Loader2 } from 'lucide-react';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // Guard to prevent multiple redirects
  const hasRedirectedRef = useRef(false);
  
  // Public routes that don't require auth (for testing)
  const isPublicRoute = pathname === '/agents' || pathname.startsWith('/agents/') || pathname === '/agent-members' || pathname === '/admin/key';
  
  // Sub-agent allowed routes
  const subAgentAllowedRoutes = ['/sub-agent', '/manual-key', '/customers', '/entries', '/reports'];
  const isSubAgentRoute = pathname && subAgentAllowedRoutes.some(route => pathname.startsWith(route));

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirectedRef.current) return;
    
    // Redirect to login if not authenticated (skip for public routes)
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      hasRedirectedRef.current = true;
      router.replace('/login');
      return;
    }
    
    // Redirect sub_agent to their portal if trying to access other routes
    if (!isLoading && isAuthenticated && user?.role === 'sub_agent' && !isSubAgentRoute && !isPublicRoute) {
      hasRedirectedRef.current = true;
      router.replace('/sub-agent');
      return;
    }
  }, [isAuthenticated, isLoading, router, isPublicRoute, pathname, user, isSubAgentRoute]);

  // Show loading while checking auth (skip for public routes)
  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]" suppressHydrationWarning>
        <Loader2 className="size-8 animate-spin text-[#EAB308]" />
      </div>
    );
  }

  // Show loading while redirecting to login (skip for public routes)
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]" suppressHydrationWarning>
        <Loader2 className="size-8 animate-spin text-[#EAB308]" />
      </div>
    );
  }

  // ปิด TwoFactorGuard ชั่วคราว - แสดง content โดยตรง
  //
  // ===================================================================
  // โครงสร้าง Layout หลักของหลังบ้าน (Admin Backend Shell)
  // -------------------------------------------------------------------
  // SidebarProvider  : จัดการสถานะ เปิด/ปิด ของ Sidebar (กว้าง/ยุบ/มือถือ)
  //  ├─ AppSidebar   : เมนูนำทางด้านซ้าย (components/layout/app-sidebar.tsx)
  //  │                 - แสดงเมนูตามสิทธิ์ (role) ของผู้ใช้
  //  └─ SidebarInset : พื้นที่เนื้อหาหลักทางด้านขวาของ Sidebar
  //       ├─ HEADER  : <Topbar /> = แถบบนสุด (sticky) ของทุกหน้า
  //       │            - ปุ่มยุบ Sidebar, โลโก้ (มือถือ), กระดิ่งแจ้งเตือน,
  //       │              ปุ่มรีเฟรช, ยอดวันนี้, ข้อมูลผู้ใช้, ปุ่มออกจากระบบ
  //       │            - โค้ดอยู่ที่ components/layout/topbar.tsx
  //       ├─ MAIN    : <main> = พื้นที่แสดงเนื้อหาของแต่ละหน้า ({children})
  //       └─ FOOTER  : (ยังไม่มีในปัจจุบัน) หากต้องการเพิ่มส่วนท้าย เช่น
  //                    ลิขสิทธิ์/เวอร์ชันระบบ ให้วาง <Footer /> ต่อจาก <main>
  //                    ภายใน SidebarInset เพื่อให้อยู่ล่างสุดของพื้นที่เนื้อหา
  // Toaster          : ระบบแจ้งเตือนแบบ popup (วางนอก Inset ให้ลอยทั่วจอ)
  // ===================================================================
  return (
    <SidebarProvider className="admin-shell">
      {/* เมนูนำทางด้านซ้าย - แสดงเมนูตามสิทธิ์ผู้ใช้ */}
      <AppSidebar />

      {/* พื้นที่เนื้อหาหลัก (ด้านขวาของ Sidebar) */}
      <SidebarInset className="bg-[#F8FAFC]">
        {/* HEADER: แถบบนสุดแบบ sticky ของทุกหน้า */}
        <Topbar />

        {/* MAIN: เนื้อหาของแต่ละหน้าจะถูก render ตรงนี้ */}
        <main className="flex-1 p-4 md:p-6">{children}</main>

        {/* FOOTER: เพิ่มส่วนท้ายตรงนี้ได้ในอนาคต (เช่น <Footer />) */}
      </SidebarInset>

      {/* ระบบแจ้งเตือนแบบ Toast (ลอยอยู่กึ่งกลางบนของหน้าจอ) */}
      <Toaster position="top-center" richColors />
    </SidebarProvider>
  );
}

