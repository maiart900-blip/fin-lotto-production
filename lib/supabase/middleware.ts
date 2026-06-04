import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ===== ROUTE PROTECTION =====

// Routes ที่ไม่ต้อง auth
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register', 
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/c/login',
  '/c/register',
];

// Routes ที่ต้องการ role เฉพาะ
const ROLE_ROUTES: Record<string, string[]> = {
  '/super-admin': ['super_admin'],
  '/billion-dashboard': ['super_admin', 'master_admin'],
  '/site-manager': ['super_admin', 'master_admin'],
  '/financial-hub': ['super_admin', 'master_admin'],
  '/production-audit': ['super_admin', 'master_admin'],
  '/dashboard': ['super_admin', 'master_admin', 'admin', 'agent'],
  '/master-dashboard': ['super_admin', 'master_admin', 'admin'],
  '/results': ['super_admin', 'master_admin', 'admin'],
  '/agents': ['super_admin', 'master_admin', 'admin'],
  '/customers': ['super_admin', 'master_admin', 'admin', 'agent', 'sub_agent'],
  '/settings': ['super_admin', 'master_admin', 'admin', 'agent'],
  '/manual-key': ['super_admin', 'master_admin', 'admin', 'agent', 'sub_agent', 'key_staff', 'staff'],
  '/key-entry': ['super_admin', 'master_admin', 'admin', 'agent', 'sub_agent', 'key_staff', 'staff'],
  '/auto-system': ['super_admin', 'master_admin', 'admin', 'agent', 'sub_agent', 'key_staff', 'staff'],
  '/c': ['customer', 'super_admin', 'master_admin'],
};

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  let supabaseResponse = NextResponse.next({ request });
  
  // Skip public routes - ไม่ต้อง auth
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  // Skip API auth routes และ public API routes
  const isAuthApi = pathname.startsWith('/api/auth');
  const isPublicApi = ['/api/bet-summary', '/api/lotteries'].some(api => pathname.startsWith(api));
  
  if (isPublicRoute || isAuthApi || isPublicApi) {
    return supabaseResponse;
  }
  
  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    }
  );
  
  // Get user - IMPORTANT: ต้องเรียกเพื่อ refresh session
  const { data: { user } } = await supabase.auth.getUser();
  
  // ===== CHECK AUTH =====
  // Note: Auth system ใช้ localStorage (client-side) ไม่ใช่ cookies
  // ดังนั้น middleware ไม่สามารถตรวจสอบ auth ได้
  // ให้ client-side guards (MainLayout, useAuth) จัดการ redirect แทน
  // และให้ API routes ตรวจ auth ภายในตัวเองถ้าต้องการ
  
  // API routes - อนุญาตให้ผ่านทั้งหมด (ตรวจ auth ภายใน API แต่ละตัวแทน)
  if (pathname.startsWith('/api/')) {
    return supabaseResponse;
  }
  
  // Page routes - อนุญาตให้ผ่านและให้ client-side redirect
  // เพราะ auth ใช้ localStorage ซึ่ง middleware ไม่เห็น
  if (!user) {
    return supabaseResponse;
  }
  
  // ===== CHECK ROLE =====
  // Note: ถ้า route ไม่ได้อยู่ใน ROLE_ROUTES จะอนุญาตให้เข้าถึงได้ (ถ้า login แล้ว)
  // redirect ไป dashboard เฉพาะเมื่อ route ถูกกำหนดใน ROLE_ROUTES และ user ไม่มี role ที่ต้องการ
  const role = user.user_metadata?.role || 'customer';
  
  // Super Admin เข้าได้ทุก route
  if (role === 'super_admin') {
    supabaseResponse.headers.set('x-user-id', user.id);
    supabaseResponse.headers.set('x-user-role', role);
    return supabaseResponse;
  }
  
  // ตรวจสอบ role-based routes
  for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      if (!allowedRoles.includes(role)) {
        // API routes return 403
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ 
            error: 'Forbidden',
            message: 'คุณไม่มีสิทธิ์เข้าถึง',
            required_roles: allowedRoles,
            your_role: role,
          }, { status: 403 });
        }
        
        // Redirect to appropriate dashboard
        if (role === 'customer') {
          return NextResponse.redirect(new URL('/c/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      break;
    }
  }
  
  // Routes ที่ไม่ได้อยู่ใน ROLE_ROUTES ให้อนุญาตทุก role ที่ login แล้ว (ยกเว้น customer)
  // Admin, Agent, Staff, Member สามารถเข้าถึง routes ที่ไม่ได้ protect เฉพาะได้
  
  // Add user info to response headers
  supabaseResponse.headers.set('x-user-id', user.id);
  supabaseResponse.headers.set('x-user-role', role);
  
  return supabaseResponse;
}
