/**
 * Role-Based Access Control (RBAC) System
 *
 * User Types:
 * - customer: ลูกค้าแทงหวย
 * - member: พนักงาน/ทีมงาน
 * - agent: เอเย่นต์
 * - admin: ผู้ดูแลระบบ
 */

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'master_agent'
  | 'agent'
  | 'agent_key'
  | 'sub_agent'
  | 'partner'
  | 'staff'
  | 'member'
  | 'customer';

export type UserType = 'customer' | 'member' | 'agent' | 'admin';

export function getUserTypeFromRole(role: UserRole): UserType {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return 'admin';

    case 'master_agent':
    case 'agent':
    case 'agent_key':
    case 'sub_agent':
    case 'partner':
      return 'agent';

    case 'staff':
    case 'member':
      return 'member';

    case 'customer':
    default:
      return 'customer';
  }
}

export function isStaffRole(role: UserRole): boolean {
  return role === 'staff' || role === 'member';
}

export function isCustomerRole(role: UserRole): boolean {
  return role === 'customer';
}

export function isAgentRole(role: UserRole): boolean {
  return (
    role === 'master_agent' ||
    role === 'agent' ||
    role === 'agent_key' ||
    role === 'sub_agent' ||
    role === 'partner'
  );
}

export function isAdminRole(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin';
}

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

const agentPermissions: Permission[] = [
  'view_own_entries',
  'create_entries',
  'edit_entries',
  'view_own_users',
  'view_own_reports',
  'view_credit_history',
  'view_realtime_bets',
];

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

  // Keep legacy Master Agent compatible without granting platform-only access.
  master_agent: [...agentPermissions],

  agent: [...agentPermissions],

  agent_key: [...agentPermissions],

  // Sub-Agent gets the same operational permissions as an Agent,
  // while data-scope rules still determine which records it can see.
  sub_agent: [...agentPermissions],

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

  customer: [],
};

export function hasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function canAccessUserData(
  currentRole: UserRole,
  currentUserId: string,
  targetUserId: string
): boolean {
  if (currentRole === 'super_admin' || currentRole === 'admin') {
    return true;
  }

  return currentUserId === targetUserId;
}

export function isMaster(role: UserRole): boolean {
  return (
    role === 'super_admin' ||
    role === 'admin' ||
    role === 'master_agent'
  );
}

/**
 * Exact Agent check kept for backward compatibility.
 * Use isAgentRole() when you want the whole agent family.
 */
export function isAgent(role: UserRole): boolean {
  return role === 'agent';
}

export function getDataFilter(
  role: UserRole,
  userId: string
): {
  filterByUser: boolean;
  userId: string | null;
} {
  if (isMaster(role)) {
    return { filterByUser: false, userId: null };
  }

  return { filterByUser: true, userId };
}

/**
 * Role hierarchy for comparison.
 * Mother/Admin > Master Agent > Agent > Sub-Agent > Partner > Staff > Member > Customer
 */
const roleHierarchy: Record<UserRole, number> = {
  super_admin: 100,
  admin: 90,
  master_agent: 70,
  agent: 50,
  agent_key: 50,
  sub_agent: 45,
  partner: 40,
  staff: 30,
  member: 20,
  customer: 10,
};

export function isHigherRole(
  role1: UserRole,
  role2: UserRole
): boolean {
  return roleHierarchy[role1] > roleHierarchy[role2];
}

export function canManageUser(
  managerRole: UserRole,
  targetRole: UserRole
): boolean {
  return isHigherRole(managerRole, targetRole);
}

export function unauthorizedResponse(
  message = 'Unauthorized access'
) {
  return {
    success: false,
    error: message,
    code: 'UNAUTHORIZED',
  };
}

export function forbiddenResponse(
  message = 'Forbidden - insufficient permissions'
) {
  return {
    success: false,
    error: message,
    code: 'FORBIDDEN',
  };
}

export async function validateSession(
  request: Request
): Promise<{
  valid: boolean;
  user?: {
    id: string;
    role: UserRole;
    branchId?: string;
  };
  error?: string;
}> {
  const sessionHeader = request.headers.get('x-session-user');

  if (!sessionHeader) {
    return { valid: false, error: 'No session found' };
  }

  try {
    const user = JSON.parse(sessionHeader) as {
      id?: unknown;
      role?: unknown;
      branch_id?: unknown;
    };

    if (
      typeof user.id !== 'string' ||
      typeof user.role !== 'string'
    ) {
      return { valid: false, error: 'Invalid session' };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        role: user.role as UserRole,
        branchId:
          typeof user.branch_id === 'string'
            ? user.branch_id
            : undefined,
      },
    };
  } catch {
    return { valid: false, error: 'Invalid session' };
  }
}