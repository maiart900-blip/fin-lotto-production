/**
 * API Authentication Guard
 * 
 * ใช้สำหรับ protect API routes
 * รองรับ role-based access control
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from './rbac';

export interface AuthenticatedUser {
  id: string;
  username?: string;
  role: UserRole;
  is_active: boolean;
}

export interface AuthResult {
  authenticated: boolean;
  user: AuthenticatedUser | null;
  error?: string;
}

/**
 * Get current authenticated user from session
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    
    // Check for admin session
    const adminId = cookieStore.get('admin_id')?.value;
    const adminRole = cookieStore.get('admin_role')?.value;
    
    // Check for customer session
    const customerId = cookieStore.get('customer_id')?.value;
    
    // Check for lottery_session (localStorage backup in cookie)
    const sessionCookie = cookieStore.get('lottery_session')?.value;
    
    let userId: string | null = null;
    let userRole: UserRole = 'customer';
    
    // Priority: admin > customer > session cookie
    if (adminId) {
      userId = adminId;
      userRole = (adminRole as UserRole) || 'admin';
    } else if (customerId) {
      userId = customerId;
      userRole = 'customer';
    } else if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie);
        userId = session.id;
        userRole = session.role || 'customer';
      } catch {
        // Invalid session cookie
      }
    }
    
    if (!userId) {
      return { authenticated: false, user: null, error: 'No session found' };
    }
    
    // Verify user exists and is active
    const supabase = await createClient();
    
    // Check in users table first (for admin/agent)
    if (userRole !== 'customer') {
      const { data: user } = await supabase
        .from('users')
        .select('id, username, role, is_active')
        .eq('id', userId)
        .single();
      
      if (user && user.is_active) {
        return {
          authenticated: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role as UserRole,
            is_active: user.is_active,
          },
        };
      }
    }
    
    // Check in customers table
    const { data: customer } = await supabase
      .from('customers')
      .select('id, username, is_active')
      .eq('id', userId)
      .single();
    
    if (customer && customer.is_active) {
      return {
        authenticated: true,
        user: {
          id: customer.id,
          username: customer.username,
          role: 'customer',
          is_active: customer.is_active,
        },
      };
    }
    
    return { authenticated: false, user: null, error: 'User not found or inactive' };
  } catch (error) {
    console.error('[API Auth] Error:', error);
    return { authenticated: false, user: null, error: 'Authentication error' };
  }
}

/**
 * Role hierarchy for comparison
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  admin: 90,
  agent: 50,
  partner: 40,
  staff: 30,
  member: 20,
  customer: 10,
};

/**
 * Check if user has required role or higher
 */
export function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user role is in allowed list
 */
export function isRoleAllowed(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole) || userRole === 'super_admin';
}

/**
 * API Auth Guard - require authentication
 * Returns 401 if not authenticated
 */
export async function requireAuth(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const result = await getAuthenticatedUser();
  
  if (!result.authenticated || !result.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  
  return { user: result.user };
}

/**
 * API Auth Guard - require specific role(s)
 * Returns 401 if not authenticated, 403 if insufficient role
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth();
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  if (!isRoleAllowed(user.role, allowedRoles)) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Forbidden - insufficient permissions',
        code: 'FORBIDDEN',
        required_roles: allowedRoles,
        your_role: user.role,
      },
      { status: 403 }
    );
  }
  
  return { user };
}

/**
 * API Auth Guard - require admin role (super_admin or admin)
 */
export async function requireAdmin(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  return requireRole(['super_admin', 'admin']);
}

/**
 * API Auth Guard - require super_admin role only
 */
export async function requireSuperAdmin(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  return requireRole(['super_admin']);
}

/**
 * API Auth Guard - require agent or higher
 */
export async function requireAgentOrHigher(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  return requireRole(['super_admin', 'admin', 'agent', 'partner']);
}

/**
 * Verify CRON secret for scheduled jobs
 */
export function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET not configured');
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * CRON Auth Guard
 */
export function requireCronAuth(request: Request): NextResponse | null {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized - Invalid CRON secret', code: 'CRON_UNAUTHORIZED' },
      { status: 401 }
    );
  }
  return null;
}
