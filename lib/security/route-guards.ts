/**
 * SERVER-SIDE ROUTE GUARDS
 * =========================
 * Strict access control for sensitive admin pages
 * 
 * Protected Routes:
 * - /super-admin/* - Super Admin only
 * - /multi-tenant/* - Super Admin only
 * - /sub-sites/* - Super Admin only
 * - Desktop Settings (Token fields) - Super Admin only
 * 
 * Staff/Regular Admin blocked from:
 * - LINE Notify Token
 * - Telegram Bot Token
 * - System security settings
 */

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type ProtectedRole = 'super_admin' | 'master_admin' | 'admin' | 'staff';

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

// Sensitive fields that staff cannot modify (used in API validation)
export const SUPER_ADMIN_ONLY_FIELDS = [
  'line_notify_token',
  'telegram_bot_token',
  'telegram_chat_id',
  'line_notify_enabled',
  'telegram_enabled',
  'scb_client_id',
  'scb_client_secret',
  'payment_gateway_key',
  'payment_gateway_secret',
];

export interface RouteGuardResult {
  allowed: boolean;
  user: {
    id: string;
    username: string;
    role: ProtectedRole;
    is_super_admin: boolean;
  } | null;
  reason?: string;
}

/**
 * Check if current user can access a protected route
 * Call this at the top of protected page components
 */
export async function checkRouteAccess(pathname: string): Promise<RouteGuardResult> {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('admin_id')?.value;
  
  if (!adminId) {
    return {
      allowed: false,
      user: null,
      reason: 'NOT_AUTHENTICATED',
    };
  }
  
  const supabase = await createClient();
  const { data: user } = await supabase
    .from('users')
    .select('id, username, role, is_super_admin')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();
  
  if (!user) {
    return {
      allowed: false,
      user: null,
      reason: 'USER_NOT_FOUND',
    };
  }
  
  const isSuperAdmin = user.role === 'super_admin' || user.is_super_admin === true;
  const isAdmin = isSuperAdmin || user.role === 'admin' || user.role === 'master_admin';
  
  // Check super admin only routes
  for (const route of SUPER_ADMIN_ONLY_ROUTES) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (!isSuperAdmin) {
        return {
          allowed: false,
          user: { ...user, is_super_admin: isSuperAdmin },
          reason: 'SUPER_ADMIN_REQUIRED',
        };
      }
    }
  }
  
  // Check admin only routes (blocks staff)
  for (const route of ADMIN_ONLY_ROUTES) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (!isAdmin) {
        return {
          allowed: false,
          user: { ...user, is_super_admin: isSuperAdmin },
          reason: 'ADMIN_REQUIRED',
        };
      }
    }
  }
  
  return {
    allowed: true,
    user: { ...user, is_super_admin: isSuperAdmin },
  };
}

/**
 * Server component wrapper that redirects unauthorized users
 * Use in page.tsx files for protected routes
 */
export async function requireSuperAdmin(): Promise<{ id: string; username: string; role: string }> {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('admin_id')?.value;
  
  if (!adminId) {
    redirect('/login?error=unauthorized');
  }
  
  const supabase = await createClient();
  const { data: user } = await supabase
    .from('users')
    .select('id, username, role, is_super_admin')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();
  
  if (!user) {
    redirect('/login?error=user_not_found');
  }
  
  const isSuperAdmin = user.role === 'super_admin' || user.is_super_admin === true;
  
  if (!isSuperAdmin) {
    redirect('/?error=access_denied&message=' + encodeURIComponent('คุณไม่มีสิทธิ์เข้าถึงหน้านี้'));
  }
  
  return user;
}

/**
 * Server component wrapper that requires at least admin role
 */
export async function requireAdmin(): Promise<{ id: string; username: string; role: string }> {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('admin_id')?.value;
  
  if (!adminId) {
    redirect('/login?error=unauthorized');
  }
  
  const supabase = await createClient();
  const { data: user } = await supabase
    .from('users')
    .select('id, username, role, is_super_admin')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();
  
  if (!user) {
    redirect('/login?error=user_not_found');
  }
  
  const isAdmin = user.role === 'super_admin' || user.role === 'admin' || user.role === 'master_admin' || user.is_super_admin === true;
  
  if (!isAdmin) {
    redirect('/?error=access_denied&message=' + encodeURIComponent('คุณไม่มีสิทธิ์เข้าถึงหน้านี้'));
  }
  
  return user;
}

/**
 * Check if user can modify sensitive settings
 * Returns true only for super_admin
 */
export async function canModifySensitiveSettings(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminId = cookieStore.get('admin_id')?.value;
  
  if (!adminId) return false;
  
  const supabase = await createClient();
  const { data: user } = await supabase
    .from('users')
    .select('role, is_super_admin')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();
  
  if (!user) return false;
  
  return user.role === 'super_admin' || user.is_super_admin === true;
}

/**
 * Validate API request for sensitive field modification
 * Returns error response if staff tries to modify protected fields
 */
export function validateSensitiveFieldAccess(
  userRole: string,
  isSuperAdmin: boolean,
  fieldsBeingModified: string[]
): { allowed: boolean; blockedFields: string[] } {
  if (userRole === 'super_admin' || isSuperAdmin) {
    return { allowed: true, blockedFields: [] };
  }
  
  const blockedFields = fieldsBeingModified.filter(field => 
    SUPER_ADMIN_ONLY_FIELDS.includes(field)
  );
  
  return {
    allowed: blockedFields.length === 0,
    blockedFields,
  };
}
