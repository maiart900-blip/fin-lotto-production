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
import { 
  getUserTypeFromRole, 
  getSourceTableFromRole, 
  isAgentRole, 
  isMemberRole, 
  isCustomerRole,
  type UserType,
  type SourceTable 
} from './identity';

export interface AuthenticatedUser {
  id: string;
  username?: string;
  role: UserRole;
  user_type: UserType;
  source_table: SourceTable;
  is_active: boolean;
  // Tenant context
  tenant_id?: string | null;
  // For hierarchy-based access
  parent_id?: string | null;
  agent_level?: string | null;
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
    
    // Check for main 'session' cookie (used by login flow)
    const mainSessionCookie = cookieStore.get('session')?.value;
    
    console.log('Auth cookies:', { adminId: !!adminId, adminRole, customerId: !!customerId, sessionCookie: !!sessionCookie, mainSessionCookie: !!mainSessionCookie });
    
    let userId: string | null = null;
    let userRole: UserRole = 'customer';
    
    // Priority: admin > customer > session cookie > main session
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
    } else if (mainSessionCookie) {
      try {
        const session = JSON.parse(decodeURIComponent(mainSessionCookie));
        userId = session.userId || session.id;
        userRole = (session.role as UserRole) || 'customer';
      } catch {
        // Invalid main session cookie
      }
    }
    
    console.log('Resolved auth:', { userId, userRole });
    
    if (!userId) {
      return { authenticated: false, user: null, error: 'No session found' };
    }
    
    // Verify user exists and is active
    const supabase = await createClient();
    
    // Check in users table first (for admin/super_admin/owner/staff)
    const adminRoles = ['super_admin', 'admin', 'owner', 'staff', 'master_admin'];
    if (adminRoles.includes(userRole)) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, username, role, is_active')
        .eq('id', userId)
        .single();
      
      console.log('User lookup:', { found: !!user, error: userError?.message });
      
      if (user && user.is_active) {
        return {
          authenticated: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role as UserRole,
            user_type: getUserTypeFromRole(user.role),
            source_table: 'users',
            is_active: user.is_active,
          },
        };
      }
    }
    
    // Check in agents table (for agent/partner/sub_agent/master_agent roles)
    if (userRole === 'agent' || userRole === 'partner' || userRole === 'agent_key' || userRole === 'sub_agent' || userRole === 'master_agent') {
      const { data: agent } = await supabase
        .from('agents')
        .select('id, code, role, status, parent_agent_id')
        .eq('id', userId)
        .single();
      
      if (agent && agent.status === 'active') {
        return {
          authenticated: true,
          user: {
            id: agent.id,
            username: agent.code,
            role: (agent.role || 'agent') as UserRole,
            user_type: 'agent',
            source_table: 'agents',
            is_active: true,
            parent_id: agent.parent_agent_id,
          },
        };
      }
    }
    
    // Check in customers table (for customer/member/staff)
    const { data: customer } = await supabase
      .from('customers')
      .select('id, username, is_active, agent_level, parent_agent_id')
      .eq('id', userId)
      .single();
    
    if (customer && customer.is_active) {
      // Determine role from agent_level
      let customerRole: UserRole = 'customer';
      let customerUserType: UserType = 'customer';
      if (customer.agent_level === 'agent') {
        customerRole = 'agent';
        customerUserType = 'agent';
      } else if (customer.agent_level === 'member') {
        customerRole = 'member';
        customerUserType = 'member';
      }
      
      return {
        authenticated: true,
        user: {
          id: customer.id,
          username: customer.username,
          role: customerRole,
          user_type: customerUserType,
          source_table: 'customers',
          is_active: customer.is_active,
          parent_id: customer.parent_agent_id,
          agent_level: customer.agent_level,
        },
      };
    }
    
    // Also check users table as fallback for any role
    const { data: fallbackUser } = await supabase
      .from('users')
      .select('id, username, role, is_active')
      .eq('id', userId)
      .single();
    
    if (fallbackUser && fallbackUser.is_active) {
      return {
        authenticated: true,
        user: {
          id: fallbackUser.id,
          username: fallbackUser.username,
          role: fallbackUser.role as UserRole,
          is_active: fallbackUser.is_active,
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
  master_agent: 60,  // Master agent
  agent: 50,
  agent_key: 50,  // Same level as agent
  sub_agent: 45,  // Sub-agent (under agent)
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
 * API Auth Guard - require agent or higher (includes sub_agent, master_agent)
 */
export async function requireAgentOrHigher(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  return requireRole(['super_admin', 'admin', 'agent', 'agent_key', 'sub_agent', 'master_agent', 'partner']);
}

/**
 * API Auth Guard - require member role (staff/member)
 * Used for member-only operations
 */
export async function requireMember(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth();
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  // Members or higher can access
  if (isMemberRole(user.role) || isAgentRole(user.role) || user.role === 'admin' || user.role === 'super_admin') {
    return { user };
  }
  
  return NextResponse.json(
    { 
      success: false, 
      error: 'Forbidden - member access required',
      code: 'FORBIDDEN',
    },
    { status: 403 }
  );
}

/**
 * API Auth Guard - require customer role
 * Used for customer-only operations (betting, wallet, etc.)
 */
export async function requireCustomer(): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth();
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  // Customers or admin/super_admin can access
  if (isCustomerRole(user.role) || user.role === 'admin' || user.role === 'super_admin') {
    return { user };
  }
  
  return NextResponse.json(
    { 
      success: false, 
      error: 'Forbidden - customer access required',
      code: 'FORBIDDEN',
    },
    { status: 403 }
  );
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
