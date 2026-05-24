'use client';

// Main layout for authenticated pages
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

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirectedRef.current) return;
    
    // Redirect to login if not authenticated (skip for public routes)
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      hasRedirectedRef.current = true;
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router, isPublicRoute, pathname, user]);

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
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#F8FAFC]">
        <Topbar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
      <Toaster position="top-center" richColors />
    </SidebarProvider>
  );
}
