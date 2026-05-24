import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// =====================================================
// LEGACY TYPES (backward compatible)
// =====================================================

export type Permission = 
  | 'view_dashboard' | 'manage_dashboard'
  | 'view_customers' | 'manage_customers' | 'adjust_credit'
  | 'view_entries' | 'manage_entries' | 'cancel_entries'
  | 'view_lotteries' | 'manage_lotteries' | 'submit_results'
  | 'view_topups' | 'approve_topups'
  | 'view_withdraws' | 'approve_withdraws'
  | 'view_reports' | 'export_reports'
  | 'view_promotions' | 'manage_promotions'
  | 'view_settings' | 'manage_settings'
  | 'view_admins' | 'manage_admins'
  | 'view_security' | 'manage_security'
  | 'view_audit_logs'
  | 'super_admin';

export type Role = 'super_admin' | 'admin' | 'operator' | 'viewer';

// =====================================================
// NEW PERMISSION SYSTEM - รองรับทุก Role
// =====================================================

export type UserRole = 
  | 'super_admin'      // Super Admin - เข้าถึงทุกอย่าง
  | 'master_admin'     // Master Admin - เจ้าของเว็บกลาง
  | 'admin'            // Admin - ผู้ดูแลระบบ
  | 'agent_auto'       // Agent Auto - เอเย่นต์ระบบออโต้
  | 'agent_key'        // Agent Key - เอเย่นต์คีย์หวย
  | 'agent'            // Agent - เอเย่นต์ทั่วไป (backward compatible)
  | 'key_branch'       // Key Branch - สาขาคีย์หวย
  | 'staff'            // Staff - พนักงาน
  | 'member';          // Member - ลูกค้า/สมาชิก

export interface MenuPermissionConfig {
  target_id: string;
  target_type: 'user' | 'agent' | 'member' | 'sub_site' | 'branch' | 'role';
  owner_id?: string | null;
  sub_site_id?: string | null;
  branch_id?: string | null;
  visible_menus: string[];
  hidden_menus: string[];
  enabled_features: string[];
  disabled_features: string[];
  can_create_sub_agent: boolean;
  can_view_reports: boolean;
  can_key_lottery: boolean;
  can_approve_transactions: boolean;
  can_manage_members: boolean;
  can_manage_finances: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// MEMBER MENUS - เมนูสำหรับสมาชิก/ลูกค้า
// =====================================================

export interface MemberMenuItem {
  id: string;
  title: string;
  href: string;
  icon: string;
  category: 'main' | 'betting' | 'finance' | 'promotion' | 'other' | 'vip' | 'games';
  defaultEnabled: boolean;
}

export const MEMBER_MENUS: MemberMenuItem[] = [
  // Main
  { id: 'member-home', title: 'หน้าหลัก', href: '/member', icon: 'home', category: 'main', defaultEnabled: true },
  { id: 'member-profile', title: 'โปรไฟล์', href: '/member/profile', icon: 'user', category: 'main', defaultEnabled: true },
  { id: 'member-announcements', title: 'ข่าวประกาศ', href: '/member/announcements', icon: 'bell', category: 'main', defaultEnabled: true },
  
  // Betting
  { id: 'member-bet', title: 'หน้าแทงหวย', href: '/member/bet', icon: 'ticket', category: 'betting', defaultEnabled: true },
  { id: 'member-bet-slip', title: 'โพยของฉัน', href: '/member/bet-slip', icon: 'list', category: 'betting', defaultEnabled: true },
  { id: 'member-results', title: 'ผลหวย', href: '/member/results', icon: 'trophy', category: 'betting', defaultEnabled: true },
  { id: 'member-history', title: 'ประวัติรายการ', href: '/member/history', icon: 'history', category: 'betting', defaultEnabled: true },
  
  // Finance
  { id: 'member-deposit', title: 'ฝากเงิน', href: '/member/deposit', icon: 'upload', category: 'finance', defaultEnabled: true },
  { id: 'member-withdraw', title: 'ถอนเงิน', href: '/member/withdraw', icon: 'download', category: 'finance', defaultEnabled: true },
  { id: 'member-transactions', title: 'ประวัติธุรกรรม', href: '/member/transactions', icon: 'receipt', category: 'finance', defaultEnabled: true },
  
  // Promotion
  { id: 'member-promotions', title: 'โปรโมชั่น', href: '/member/promotions', icon: 'gift', category: 'promotion', defaultEnabled: true },
  { id: 'member-bonus', title: 'หน้าโบนัส', href: '/member/bonus', icon: 'sparkles', category: 'promotion', defaultEnabled: true },
  { id: 'member-referral', title: 'ระบบแนะนำเพื่อน', href: '/member/referral', icon: 'users', category: 'promotion', defaultEnabled: true },
  { id: 'member-leaderboard', title: 'หน้าอันดับสมาชิก', href: '/member/leaderboard', icon: 'crown', category: 'promotion', defaultEnabled: false },
  
  // Communication
  { id: 'member-live-chat', title: 'Live Chat', href: '/member/live-chat', icon: 'message', category: 'other', defaultEnabled: true },
  { id: 'member-line-group', title: 'กลุ่ม LINE', href: '/member/line-group', icon: 'link', category: 'other', defaultEnabled: true },
  
  // Games
  { id: 'member-casino', title: 'คาสิโน', href: '/member/casino', icon: 'dice', category: 'games', defaultEnabled: false },
  { id: 'member-sports', title: 'กีฬา', href: '/member/sports', icon: 'soccer', category: 'games', defaultEnabled: false },
  { id: 'member-mini-games', title: 'มินิเกม', href: '/member/mini-games', icon: 'gamepad', category: 'games', defaultEnabled: false },
  
  // VIP & Special
  { id: 'member-vip-lottery', title: 'หวย VIP', href: '/member/vip-lottery', icon: 'star', category: 'vip', defaultEnabled: false },
  { id: 'member-auto-system', title: 'ระบบออโต้', href: '/member/auto', icon: 'zap', category: 'vip', defaultEnabled: false },
];

// หวยบางประเภท (สามารถเปิด/ปิดแยกได้)
export const LOTTERY_TYPE_PERMISSIONS: MemberMenuItem[] = [
  { id: 'lottery-thai', title: 'หวยรัฐบาลไทย', href: '/member/bet/thai', icon: 'flag', category: 'betting', defaultEnabled: true },
  { id: 'lottery-laos', title: 'หวยลาว', href: '/member/bet/laos', icon: 'flag', category: 'betting', defaultEnabled: true },
  { id: 'lottery-vietnam', title: 'หวยเวียดนาม', href: '/member/bet/vietnam', icon: 'flag', category: 'betting', defaultEnabled: true },
  { id: 'lottery-hanoi', title: 'หวยฮานอย', href: '/member/bet/hanoi', icon: 'flag', category: 'betting', defaultEnabled: true },
  { id: 'lottery-yeekee', title: 'หวยยี่กี', href: '/member/bet/yeekee', icon: 'clock', category: 'betting', defaultEnabled: true },
  { id: 'lottery-stock', title: 'หวยหุ้น', href: '/member/bet/stock', icon: 'trending-up', category: 'betting', defaultEnabled: false },
  { id: 'lottery-pingpong', title: 'หวยปิงปอง', href: '/member/bet/pingpong', icon: 'target', category: 'betting', defaultEnabled: false },
  { id: 'lottery-vip', title: 'หวย VIP', href: '/member/bet/vip', icon: 'crown', category: 'vip', defaultEnabled: false },
];

// =====================================================
// AGENT MENUS - เมนูสำหรับเอเย่นต์
// =====================================================

export const AGENT_MENUS: MemberMenuItem[] = [
  { id: 'agent-dashboard', title: 'Dashboard', href: '/agent', icon: 'layout-dashboard', category: 'main', defaultEnabled: true },
  { id: 'agent-summary', title: 'สรุปรายได้', href: '/agent/summary', icon: 'bar-chart', category: 'main', defaultEnabled: true },
  { id: 'agent-finance', title: 'ศูนย์การเงิน', href: '/agent/finance', icon: 'wallet', category: 'finance', defaultEnabled: true },
  { id: 'agent-slip-upload', title: 'อัปโหลดสลิป/ถอนเงิน', href: '/agent/slip-upload', icon: 'upload', category: 'finance', defaultEnabled: true },
  { id: 'agent-transactions', title: 'ประวัติธุรกรรม', href: '/agent/transactions', icon: 'receipt', category: 'finance', defaultEnabled: true },
  { id: 'agent-members', title: 'ลูกค้าใต้สาย', href: '/agent/members', icon: 'users', category: 'main', defaultEnabled: true },
  { id: 'agent-sub-agents', title: 'เอเย่นต์ใต้สาย', href: '/agent/sub-agents', icon: 'git-branch', category: 'main', defaultEnabled: false },
  { id: 'agent-commission', title: 'คอมมิชชั่น', href: '/agent/commission', icon: 'dollar-sign', category: 'finance', defaultEnabled: true },
  { id: 'agent-profit-loss', title: 'รายงานแพ้ชนะ', href: '/agent/profit-loss', icon: 'pie-chart', category: 'main', defaultEnabled: true },
  { id: 'agent-withdraw-commission', title: 'ถอนคอมมิชชั่น', href: '/agent/withdraw-commission', icon: 'download', category: 'finance', defaultEnabled: true },
  { id: 'agent-key-entry', title: 'คีย์โพย', href: '/agent/key', icon: 'pen-line', category: 'betting', defaultEnabled: true },
  { id: 'agent-entries', title: 'รายการโพย', href: '/agent/entries', icon: 'list', category: 'betting', defaultEnabled: true },
  { id: 'agent-results', title: 'ผลหวย', href: '/agent/results', icon: 'trophy', category: 'betting', defaultEnabled: true },
  { id: 'agent-reports', title: 'รายงาน', href: '/agent/reports', icon: 'file-text', category: 'other', defaultEnabled: true },
  { id: 'agent-settlement', title: 'ส่งยอดเข้าเว็บกลาง', href: '/agent/settlement', icon: 'send', category: 'finance', defaultEnabled: false },
];

// =====================================================
// DEFAULT PERMISSIONS BY ROLE
// =====================================================

export function getDefaultMenusForRole(role: UserRole): string[] {
  switch (role) {
    case 'super_admin':
    case 'master_admin':
      return [...MEMBER_MENUS.map(m => m.id), ...AGENT_MENUS.map(m => m.id), ...LOTTERY_TYPE_PERMISSIONS.map(m => m.id)];
    case 'admin':
      return [...MEMBER_MENUS.filter(m => m.category !== 'vip').map(m => m.id), ...AGENT_MENUS.map(m => m.id), ...LOTTERY_TYPE_PERMISSIONS.filter(m => m.category !== 'vip').map(m => m.id)];
    case 'agent_auto':
      return AGENT_MENUS.filter(m => ['agent-dashboard', 'agent-summary', 'agent-finance', 'agent-transactions', 'agent-members', 'agent-commission', 'agent-profit-loss', 'agent-withdraw-commission', 'agent-reports'].includes(m.id)).map(m => m.id);
    case 'agent_key':
    case 'agent':
      return AGENT_MENUS.filter(m => m.defaultEnabled).map(m => m.id);
    case 'key_branch':
      return AGENT_MENUS.filter(m => ['agent-dashboard', 'agent-summary', 'agent-key-entry', 'agent-entries', 'agent-results', 'agent-members', 'agent-reports'].includes(m.id)).map(m => m.id);
    case 'staff':
      return ['member-home', 'member-announcements', 'agent-dashboard', 'agent-entries', 'agent-results'];
    case 'member':
      return MEMBER_MENUS.filter(m => m.defaultEnabled).map(m => m.id);
    default:
      return ['member-home'];
  }
}

export function getDefaultFeaturesForRole(role: UserRole): string[] {
  switch (role) {
    case 'super_admin':
    case 'master_admin':
      return ['can_create_sub_agent', 'can_view_reports', 'can_key_lottery', 'can_approve_transactions', 'can_manage_members', 'can_manage_finances', 'can_manage_settings', 'can_manage_permissions', 'can_access_vip'];
    case 'admin':
      return ['can_view_reports', 'can_key_lottery', 'can_approve_transactions', 'can_manage_members', 'can_manage_finances'];
    case 'agent_auto':
      return ['can_view_reports', 'can_manage_members'];
    case 'agent_key':
    case 'agent':
      return ['can_view_reports', 'can_key_lottery', 'can_manage_members'];
    case 'key_branch':
      return ['can_key_lottery', 'can_view_reports'];
    case 'staff':
      return ['can_view_reports'];
    case 'member':
      return [];
    default:
      return [];
  }
}

// =====================================================
// PERMISSION INHERITANCE - role + sub_site + agent + individual
// =====================================================

export function getEffectivePermissions(
  userRole: UserRole,
  userPermissions?: MenuPermissionConfig | null,
  agentPermissions?: MenuPermissionConfig | null,
  subSitePermissions?: MenuPermissionConfig | null,
): MenuPermissionConfig {
  const defaultMenus = getDefaultMenusForRole(userRole);
  const defaultFeatures = getDefaultFeaturesForRole(userRole);
  
  let visibleMenus = [...defaultMenus];
  let hiddenMenus: string[] = [];
  let enabledFeatures = [...defaultFeatures];
  let disabledFeatures: string[] = [];
  
  // Apply sub-site restrictions
  if (subSitePermissions) {
    visibleMenus = visibleMenus.filter(m => subSitePermissions.visible_menus.length === 0 || subSitePermissions.visible_menus.includes(m));
    hiddenMenus = [...hiddenMenus, ...subSitePermissions.hidden_menus];
    enabledFeatures = enabledFeatures.filter(f => subSitePermissions.enabled_features.length === 0 || subSitePermissions.enabled_features.includes(f));
    disabledFeatures = [...disabledFeatures, ...subSitePermissions.disabled_features];
  }
  
  // Apply agent restrictions
  if (agentPermissions) {
    visibleMenus = visibleMenus.filter(m => agentPermissions.visible_menus.length === 0 || agentPermissions.visible_menus.includes(m));
    hiddenMenus = [...hiddenMenus, ...agentPermissions.hidden_menus];
    enabledFeatures = enabledFeatures.filter(f => agentPermissions.enabled_features.length === 0 || agentPermissions.enabled_features.includes(f));
    disabledFeatures = [...disabledFeatures, ...agentPermissions.disabled_features];
  }
  
  // Apply user permissions
  if (userPermissions) {
    if (userPermissions.visible_menus.length > 0) {
      visibleMenus = visibleMenus.filter(m => userPermissions.visible_menus.includes(m));
    }
    hiddenMenus = [...hiddenMenus, ...userPermissions.hidden_menus];
    if (userPermissions.enabled_features.length > 0) {
      enabledFeatures = enabledFeatures.filter(f => userPermissions.enabled_features.includes(f));
    }
    disabledFeatures = [...disabledFeatures, ...userPermissions.disabled_features];
  }
  
  // Remove duplicates and apply hidden
  visibleMenus = [...new Set(visibleMenus)].filter(m => !hiddenMenus.includes(m));
  enabledFeatures = [...new Set(enabledFeatures)].filter(f => !disabledFeatures.includes(f));
  
  return {
    target_id: userPermissions?.target_id || '',
    target_type: userPermissions?.target_type || 'user',
    owner_id: userPermissions?.owner_id,
    sub_site_id: subSitePermissions?.target_id,
    branch_id: agentPermissions?.branch_id,
    visible_menus: visibleMenus,
    hidden_menus: [...new Set(hiddenMenus)],
    enabled_features: enabledFeatures,
    disabled_features: [...new Set(disabledFeatures)],
    can_create_sub_agent: userPermissions?.can_create_sub_agent ?? agentPermissions?.can_create_sub_agent ?? false,
    can_view_reports: userPermissions?.can_view_reports ?? agentPermissions?.can_view_reports ?? true,
    can_key_lottery: userPermissions?.can_key_lottery ?? agentPermissions?.can_key_lottery ?? true,
    can_approve_transactions: userPermissions?.can_approve_transactions ?? agentPermissions?.can_approve_transactions ?? false,
    can_manage_members: userPermissions?.can_manage_members ?? agentPermissions?.can_manage_members ?? false,
    can_manage_finances: userPermissions?.can_manage_finances ?? agentPermissions?.can_manage_finances ?? false,
    created_at: userPermissions?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// =====================================================
// PERMISSION CHECKER CLASS
// =====================================================

export class PermissionChecker {
  private config: MenuPermissionConfig;
  private role: UserRole;
  
  constructor(config: MenuPermissionConfig, role: UserRole) {
    this.config = config;
    this.role = role;
  }
  
  canSeeMenu(menuId: string): boolean {
    if (this.role === 'super_admin' || this.role === 'master_admin') return true;
    if (this.config.hidden_menus.includes(menuId)) return false;
    return this.config.visible_menus.includes(menuId);
  }
  
  hasFeature(featureId: string): boolean {
    if (this.role === 'super_admin' || this.role === 'master_admin') return true;
    if (this.config.disabled_features.includes(featureId)) return false;
    return this.config.enabled_features.includes(featureId);
  }
  
  canAccessRoute(route: string): boolean {
    const allMenus = [...MEMBER_MENUS, ...AGENT_MENUS, ...LOTTERY_TYPE_PERMISSIONS];
    const menu = allMenus.find(m => m.href === route || route.startsWith(m.href + '/'));
    if (!menu) return true;
    return this.canSeeMenu(menu.id);
  }
  
  getVisibleMenus(): string[] {
    if (this.role === 'super_admin' || this.role === 'master_admin') {
      return [...MEMBER_MENUS.map(m => m.id), ...AGENT_MENUS.map(m => m.id), ...LOTTERY_TYPE_PERMISSIONS.map(m => m.id)];
    }
    return this.config.visible_menus.filter(id => !this.config.hidden_menus.includes(id));
  }
}

// =====================================================
// RESTRICTED ROUTES
// =====================================================

export const RESTRICTED_ROUTES: Record<string, UserRole[]> = {
  '/super-admin': ['super_admin'],
  '/master-control': ['super_admin', 'master_admin'],
  '/settings/system': ['super_admin', 'master_admin'],
  '/users': ['super_admin', 'master_admin', 'admin'],
  '/roles-permissions': ['super_admin', 'master_admin', 'admin'],
  '/security-dashboard': ['super_admin', 'master_admin', 'admin'],
  '/multi-tenant': ['super_admin', 'master_admin'],
  '/sub-sites': ['super_admin', 'master_admin'],
  '/tenant-manager': ['super_admin', 'master_admin'],
};

export function getRequiredRolesForRoute(route: string): UserRole[] | null {
  for (const [path, roles] of Object.entries(RESTRICTED_ROUTES)) {
    if (route === path || route.startsWith(path + '/')) {
      return roles;
    }
  }
  return null;
}

// =====================================================
// MENU CATEGORIES FOR UI
// =====================================================

export const MEMBER_MENU_CATEGORIES = [
  { id: 'main', title: 'หน้าหลัก', icon: 'home' },
  { id: 'betting', title: 'แทงหวย', icon: 'ticket' },
  { id: 'finance', title: 'การเงิน', icon: 'wallet' },
  { id: 'promotion', title: 'โปรโมชั่น', icon: 'gift' },
  { id: 'games', title: 'เกม', icon: 'gamepad' },
  { id: 'vip', title: 'VIP', icon: 'crown' },
  { id: 'other', title: 'อื่นๆ', icon: 'more-horizontal' },
];

export const AGENT_MENU_CATEGORIES = [
  { id: 'main', title: 'หน้าหลัก', icon: 'layout-dashboard' },
  { id: 'finance', title: 'การเงิน', icon: 'wallet' },
  { id: 'betting', title: 'คีย์หวย', icon: 'pen-line' },
  { id: 'other', title: 'อื่นๆ', icon: 'more-horizontal' },
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'super_admin',
    'view_dashboard', 'manage_dashboard',
    'view_customers', 'manage_customers', 'adjust_credit',
    'view_entries', 'manage_entries', 'cancel_entries',
    'view_lotteries', 'manage_lotteries', 'submit_results',
    'view_topups', 'approve_topups',
    'view_withdraws', 'approve_withdraws',
    'view_reports', 'export_reports',
    'view_promotions', 'manage_promotions',
    'view_settings', 'manage_settings',
    'view_admins', 'manage_admins',
    'view_security', 'manage_security',
    'view_audit_logs',
  ],
  admin: [
    'view_dashboard',
    'view_customers', 'manage_customers', 'adjust_credit',
    'view_entries', 'manage_entries', 'cancel_entries',
    'view_lotteries', 'manage_lotteries', 'submit_results',
    'view_topups', 'approve_topups',
    'view_withdraws', 'approve_withdraws',
    'view_reports', 'export_reports',
    'view_promotions', 'manage_promotions',
    'view_audit_logs',
  ],
  operator: [
    'view_dashboard',
    'view_customers',
    'view_entries', 'manage_entries',
    'view_lotteries',
    'view_topups', 'approve_topups',
    'view_withdraws',
    'view_reports',
    'view_promotions',
  ],
  viewer: [
    'view_dashboard',
    'view_customers',
    'view_entries',
    'view_lotteries',
    'view_topups',
    'view_withdraws',
    'view_reports',
  ],
};

interface AdminUser {
  id: string;
  username: string;
  role: Role;
  permissions?: Permission[];
  is_active: boolean;
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies();
    const adminId = cookieStore.get('admin_id')?.value;
    
    if (!adminId) return null;
    
    const supabase = await createClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, username, role, permissions, is_active')
      .eq('id', adminId)
      .single();
    
    if (!user || !user.is_active) return null;
    
    return user as AdminUser;
  } catch {
    return null;
  }
}

export function hasPermission(user: AdminUser | null, permission: Permission): boolean {
  if (!user) return false;
  
  // Super admin has all permissions
  if (user.role === 'super_admin') return true;
  
  // Check custom permissions first
  if (user.permissions && user.permissions.includes(permission)) {
    return true;
  }
  
  // Check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return rolePermissions.includes(permission);
}

export function hasAnyPermission(user: AdminUser | null, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(user, p));
}

export function hasAllPermissions(user: AdminUser | null, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(user, p));
}

export async function checkPermission(permission: Permission): Promise<{ allowed: boolean; user: AdminUser | null }> {
  const user = await getCurrentAdmin();
  const allowed = hasPermission(user, permission);
  return { allowed, user };
}

export async function requirePermission(permission: Permission): Promise<AdminUser> {
  const { allowed, user } = await checkPermission(permission);
  
  if (!allowed || !user) {
    throw new Error('Permission denied');
  }
  
  return user;
}
