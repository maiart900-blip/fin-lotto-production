/**
 * Role-Based Access Control (RBAC) System
 * 
 * Roles:
 * - super_admin: Full system access, can manage all users and settings
 * - admin: Same as super_admin but cannot create other admins
 * - agent: Can view own data, place bets, manage own customers
 * - partner: Can view aggregate data for their network
 * - staff: Limited access, can only view and create entries
 * - member: End user, can only view own bets
 */

export type UserRole = 'super_admin' | 'admin' | 'agent' | 'partner' | 'staff' | 'member';

export type Permission = 
  | 'view_all_entries'
  | 'view_own_entries'
  | 'create_entries'
  | 'edit_entries'
  | 'delete_entries'
  | 'view_all_users'
  | 'view_own_users'
  | 'manage_users'
  | 'manage_agents'
  | 'view_all_reports'
  | 'view_own_reports'
  | 'manage_settings'
  | 'manage_system'
  | 'view_credit_history'
  | 'manage_credit'
  | 'view_realtime_bets'
  | 'access_master_panel';

// Role-Permission mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  super_admin: [
    'view_all_entries',
    'view_own_entries',
    'create_entries',
    'edit_entries',
    'delete_entries',
    'view_all_users',
    'view_own_users',
    'manage_users',
    'manage_agents',
    'view_all_reports',
    'view_own_reports',
    'manage_settings',
    'manage_system',
    'view_credit_history',
    'manage_credit',
    'view_realtime_bets',
    'access_master_panel',
  ],
  admin: [
    'view_all_entries',
    'view_own_entries',
    'create_entries',
    'edit_entries',
    'delete_entries',
    'view_all_users',
    'view_own_users',
    'manage_users',
    'manage_agents',
    'view_all_reports',
    'view_own_reports',
    'manage_settings',
    'view_credit_history',
    'manage_credit',
    'view_realtime_bets',
    'access_master_panel',
  ],
  agent: [
    'view_own_entries',
    'create_entries',
    'edit_entries',
    'view_own_users',
    'view_own_reports',
    'view_credit_history',
    'view_realtime_bets',
  ],
  partner: [
    'view_own_entries',
    'view_own_users',
    'view_own_reports',
    'view_credit_history',
  ],
  staff: [
    'view_own_entries',
    'create_entries',
    'view_own_reports',
  ],
  member: [
    'view_own_entries',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Check if user can access data for a specific target user
 */
export function canAccessUserData(
  currentRole: UserRole,
  currentUserId: string,
  targetUserId: string
): boolean {
  // Super admin and admin can access all
  if (currentRole === 'super_admin' || currentRole === 'admin') {
    return true;
  }
  
  // Others can only access their own data
  return currentUserId === targetUserId;
}

/**
 * Check if user is a Master (can see all agents)
 */
export function isMaster(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin';
}

/**
 * Check if user is an Agent (limited view)
 */
export function isAgent(role: UserRole): boolean {
  return role === 'agent';
}

/**
 * Get data filter based on role
 * Returns filter conditions for database queries
 */
export function getDataFilter(role: UserRole, userId: string): {
  filterByUser: boolean;
  userId: string | null;
} {
  if (isMaster(role)) {
    return { filterByUser: false, userId: null };
  }
  
  return { filterByUser: true, userId };
}

/**
 * Role hierarchy for comparison
 */
const roleHierarchy: Record<UserRole, number> = {
  super_admin: 100,
  admin: 90,
  agent: 50,
  partner: 40,
  staff: 30,
  member: 10,
};

/**
 * Check if role1 is higher than role2
 */
export function isHigherRole(role1: UserRole, role2: UserRole): boolean {
  return roleHierarchy[role1] > roleHierarchy[role2];
}

/**
 * Check if user can manage another user
 */
export function canManageUser(managerRole: UserRole, targetRole: UserRole): boolean {
  // Can only manage users of lower rank
  return isHigherRole(managerRole, targetRole);
}

/**
 * API Response helpers for RBAC
 */
export function unauthorizedResponse(message = 'Unauthorized access') {
  return {
    success: false,
    error: message,
    code: 'UNAUTHORIZED',
  };
}

export function forbiddenResponse(message = 'Forbidden - insufficient permissions') {
  return {
    success: false,
    error: message,
    code: 'FORBIDDEN',
  };
}

/**
 * Validate session and return user info
 * Use this in API routes
 */
export async function validateSession(request: Request): Promise<{
  valid: boolean;
  user?: {
    id: string;
    role: UserRole;
    branchId?: string;
  };
  error?: string;
}> {
  // In a real app, this would validate JWT or session token
  // For now, we'll extract from headers or cookies
  
  const sessionHeader = request.headers.get('x-session-user');
  
  if (!sessionHeader) {
    return { valid: false, error: 'No session found' };
  }
  
  try {
    const user = JSON.parse(sessionHeader);
    return {
      valid: true,
      user: {
        id: user.id,
        role: user.role as UserRole,
        branchId: user.branch_id,
      },
    };
  } catch {
    return { valid: false, error: 'Invalid session' };
  }
}
