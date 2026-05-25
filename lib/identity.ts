/**
 * Identity Model - Centralized user type detection and helpers
 * 
 * Identity Types:
 * - customer: ลูกค้าแทงหวย/ผู้เล่น (customers table, agent_level != 'agent' && != 'member')
 * - member: แมมเบอร์/พนักงาน (customers table, agent_level = 'member')
 * - agent: เอเย่น/agent_key/partner (agents table)
 * - admin: แอดมิน (users table, role = 'admin')
 * - super_admin: ผู้ดูแลระบบ (users table, role = 'super_admin')
 * 
 * Session Storage:
 * - user_type: customer | member | agent | admin | super_admin
 * - role: actual role string (may differ for sub-types like agent_key, partner)
 * - id: UUID from correct source table
 * - source_table: customers | agents | users
 */

export type UserType = 'customer' | 'member' | 'agent' | 'admin' | 'super_admin';
export type SourceTable = 'customers' | 'agents' | 'users';

export type DetailedRole = 
  | 'customer'           // ลูกค้าแทงหวย
  | 'member'             // แมมเบอร์/พนักงาน (staff under agent)
  | 'staff'              // alias for member
  | 'agent'              // เอเย่น
  | 'agent_key'          // เอเย่นต์คีย์
  | 'partner'            // พาร์ทเนอร์
  | 'sub_agent'          // เอเย่นต์ย่อย
  | 'key_staff'          // พนักงานคีย์
  | 'admin'              // แอดมิน
  | 'super_admin';       // ผู้ดูแลระบบ

export interface IdentityInfo {
  user_type: UserType;
  role: DetailedRole;
  id: string;
  source_table: SourceTable;
  username?: string;
  display_name?: string;
}

/**
 * Thai labels for each user type
 */
export const USER_TYPE_LABELS: Record<UserType, string> = {
  customer: 'ลูกค้า',
  member: 'แมมเบอร์',
  agent: 'เอเย่นต์',
  admin: 'แอดมิน',
  super_admin: 'ผู้ดูแลระบบ',
};

/**
 * Thai labels for detailed roles
 */
export const ROLE_LABELS: Record<DetailedRole, string> = {
  customer: 'ลูกค้า',
  member: 'แมมเบอร์',
  staff: 'พนักงาน',
  agent: 'เอเย่นต์',
  agent_key: 'คีย์',
  partner: 'พาร์ทเนอร์',
  sub_agent: 'เอเย่นต์ย่อย',
  key_staff: 'พนักงานคีย์',
  admin: 'แอดมิน',
  super_admin: 'ผู้ดูแลระบบ',
};

/**
 * Determine user_type from role
 */
export function getUserTypeFromRole(role: string): UserType {
  switch (role) {
    case 'super_admin':
      return 'super_admin';
    case 'admin':
      return 'admin';
    case 'agent':
    case 'agent_key':
    case 'partner':
    case 'sub_agent':
    case 'key_staff':
      return 'agent';
    case 'member':
    case 'staff':
      return 'member';
    default:
      return 'customer';
  }
}

/**
 * Determine source_table from role
 */
export function getSourceTableFromRole(role: string): SourceTable {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return 'users';
    case 'agent':
    case 'agent_key':
    case 'partner':
    case 'sub_agent':
    case 'key_staff':
      return 'agents';
    default:
      return 'customers';
  }
}

/**
 * Check if role is a customer type
 */
export function isCustomerRole(role: string): boolean {
  return role === 'customer';
}

/**
 * Check if role is a member/staff type
 */
export function isMemberRole(role: string): boolean {
  return role === 'member' || role === 'staff';
}

/**
 * Check if role is an agent type (includes agent_key, partner, sub_agent, key_staff)
 */
export function isAgentRole(role: string): boolean {
  return ['agent', 'agent_key', 'partner', 'sub_agent', 'key_staff'].includes(role);
}

/**
 * Check if role is admin type
 */
export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

/**
 * Check if role is super_admin
 */
export function isSuperAdminRole(role: string): boolean {
  return role === 'super_admin';
}

/**
 * Get visibility setting source for a role
 * - agents: reads from agents.visible_menus
 * - members: reads from customers.visible_menus where agent_level='member'
 * - customers: no menu visibility (uses fixed customer UI)
 * - admin: full access
 */
export function getVisibilitySource(role: string): 'agents' | 'customers' | 'none' {
  if (isAdminRole(role)) return 'none'; // Full access
  if (isAgentRole(role)) return 'agents';
  if (isMemberRole(role)) return 'customers';
  return 'none'; // Customers have fixed UI
}

/**
 * Get the target_type for menu_permissions table
 */
export function getMenuPermissionTargetType(role: string): 'agent' | 'member' | 'customer' | 'user' {
  if (isSuperAdminRole(role)) return 'user';
  if (isAdminRole(role)) return 'user';
  if (isAgentRole(role)) return 'agent';
  if (isMemberRole(role)) return 'member';
  return 'customer';
}

/**
 * Determine role from customers.agent_level
 */
export function getRoleFromAgentLevel(agentLevel: string | null): DetailedRole {
  if (agentLevel === 'agent') return 'agent';
  if (agentLevel === 'member') return 'member';
  return 'customer';
}

/**
 * Role hierarchy levels for permission comparison
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  admin: 90,
  agent: 60,
  agent_key: 55,
  partner: 55,
  sub_agent: 50,
  key_staff: 45,
  member: 30,
  staff: 30,
  customer: 10,
};

/**
 * Check if userRole has same or higher privileges than requiredRole
 */
export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Build identity info from user data
 */
export function buildIdentityInfo(
  userId: string,
  role: string,
  options?: {
    agentLevel?: string | null;
    username?: string;
    displayName?: string;
  }
): IdentityInfo {
  // For customers table users, check agent_level
  let finalRole = role as DetailedRole;
  if (options?.agentLevel) {
    finalRole = getRoleFromAgentLevel(options.agentLevel);
  }
  
  return {
    id: userId,
    role: finalRole,
    user_type: getUserTypeFromRole(finalRole),
    source_table: getSourceTableFromRole(finalRole),
    username: options?.username,
    display_name: options?.displayName,
  };
}

/**
 * Session data structure for localStorage/cookies
 */
export interface SessionData {
  id: string;
  user_type: UserType;
  role: DetailedRole;
  source_table: SourceTable;
  username?: string;
  displayName?: string;
  visible_menus?: string[];
  hidden_menus?: string[];
  // Additional fields
  can_create_sub_agent?: boolean;
  can_view_reports?: boolean;
  can_key_lottery?: boolean;
  can_approve_transactions?: boolean;
}

/**
 * Create session data from login response
 */
export function createSessionData(
  identity: IdentityInfo,
  permissions?: {
    visible_menus?: string[];
    hidden_menus?: string[];
    can_create_sub_agent?: boolean;
    can_view_reports?: boolean;
    can_key_lottery?: boolean;
    can_approve_transactions?: boolean;
  }
): SessionData {
  return {
    id: identity.id,
    user_type: identity.user_type,
    role: identity.role,
    source_table: identity.source_table,
    username: identity.username,
    displayName: identity.display_name,
    visible_menus: permissions?.visible_menus || [],
    hidden_menus: permissions?.hidden_menus || [],
    can_create_sub_agent: permissions?.can_create_sub_agent || false,
    can_view_reports: permissions?.can_view_reports ?? true,
    can_key_lottery: permissions?.can_key_lottery ?? true,
    can_approve_transactions: permissions?.can_approve_transactions || false,
  };
}
