/**
 * Agent Permission Resolver - Client-safe exports
 * 
 * Constants and client-side helper functions for resolving agent permissions.
 * Used by sidebar and other client components.
 * 
 * 4-TIER HIERARCHY: Mother Web -> Master -> Agent -> Sub-Agent
 * - Mother Web (Super Admin): 100% authority, controls all tiers
 * - Master: Can manage Agents and Sub-Agents
 * - Agent: Can manage Sub-Agents only
 * - Sub-Agent: No management capabilities
 * 
 * NOTE: Server-side functions are in lib/agent-permissions.server.ts
 */

// =====================================================
// TYPES
// =====================================================

export type TenantMode = 'auto_only' | 'manual_key_only' | 'hybrid' | 'both';
export type SystemType = 'auto' | 'manual_key' | 'both' | 'hybrid';

// 4-Tier Agent Hierarchy Types
export type AgentTier = 'mother_web' | 'master' | 'agent' | 'sub_agent';

export interface AgentTierConfig {
  tier: AgentTier;
  label: string;
  labelTh: string;
  color: string;
  bgColor: string;
  borderColor: string;
  level: number; // 0 = Mother Web, 1 = Master, 2 = Agent, 3 = Sub-Agent
  canManage: AgentTier[]; // Which tiers can this tier manage
  canView: AgentTier[]; // Which tiers can this tier view
}

export interface AgentSession {
  id: string;
  user_type: 'agent';
  role: string;
  source_table: 'agents' | 'customers';
  tenant_id?: string | null;
  agent_id?: string | null;
  package_id?: string | null;
  system_type?: SystemType;
  tenant_mode?: TenantMode;
  visible_menus?: string[];
  hidden_menus?: string[];
  feature_flags?: string[];
  permissions?: Record<string, MenuPermission>;
  enable_manual_key?: boolean;
  enable_auto?: boolean;
  // Tier-based fields
  agent_tier?: AgentTier;
  agent_level?: number;
}

export interface MenuPermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_payout: boolean;
}

export interface EffectiveAgentPermissions {
  // Identity
  user_id: string;
  user_type: 'agent';
  tenant_id: string | null;
  agent_id: string | null;
  
  // Mode & Features
  tenant_mode: TenantMode;
  system_type: SystemType;
  package: string | null;
  
  // Tier
  agent_tier: AgentTier;
  agent_level: number;
  
  // Menus
  visible_menus: string[];
  blocked_menus: string[];
  effective_menus: string[];
  
  // Features
  enabled_features: string[];
  disabled_features: string[];
  
  // Quick flags
  can_key_lottery: boolean;
  can_auto_system: boolean;
  can_create_sub_agent: boolean;
  can_view_reports: boolean;
  can_approve_transactions: boolean;
  can_manage_members: boolean;
  can_manage_finances: boolean;
  can_manage_agents: boolean;
}

// =====================================================
// 4-TIER AGENT HIERARCHY CONFIGURATION
// =====================================================

export const AGENT_TIER_CONFIG: Record<AgentTier, AgentTierConfig> = {
  mother_web: {
    tier: 'mother_web',
    label: 'Mother Web',
    labelTh: 'เว็บแม่',
    color: 'text-red-600',
    bgColor: 'bg-red-600',
    borderColor: 'border-red-600',
    level: 0,
    canManage: ['master', 'agent', 'sub_agent'],
    canView: ['master', 'agent', 'sub_agent'],
  },
  master: {
    tier: 'master',
    label: 'Master',
    labelTh: 'มาสเตอร์',
    color: 'text-purple-600',
    bgColor: 'bg-purple-600',
    borderColor: 'border-purple-600',
    level: 1,
    canManage: ['agent', 'sub_agent'],
    canView: ['agent', 'sub_agent'],
  },
  agent: {
    tier: 'agent',
    label: 'Agent',
    labelTh: 'เอเย่นต์',
    color: 'text-blue-600',
    bgColor: 'bg-blue-600',
    borderColor: 'border-blue-600',
    level: 2,
    canManage: ['sub_agent'],
    canView: ['sub_agent'],
  },
  sub_agent: {
    tier: 'sub_agent',
    label: 'Sub-Agent',
    labelTh: 'ซับเอเย่นต์',
    color: 'text-green-600',
    bgColor: 'bg-green-600',
    borderColor: 'border-green-600',
    level: 3,
    canManage: [],
    canView: [],
  },
};

// Get tier config by level or role
export function getTierConfig(tierOrRole: AgentTier | string | number): AgentTierConfig {
  if (typeof tierOrRole === 'number') {
    const tier = Object.values(AGENT_TIER_CONFIG).find(t => t.level === tierOrRole);
    return tier || AGENT_TIER_CONFIG.sub_agent;
  }
  
  // Map legacy role names to tiers
  const roleMapping: Record<string, AgentTier> = {
    mother_web: 'mother_web',
    super_admin: 'mother_web',
    master_admin: 'mother_web',
    master: 'master',
    senior_agent: 'master',
    master_agent: 'master',
    agent: 'agent',
    agent_key: 'agent',
    sub_agent: 'sub_agent',
    key_staff: 'sub_agent',
  };
  
  const mappedTier = roleMapping[tierOrRole as string] || 'sub_agent';
  return AGENT_TIER_CONFIG[mappedTier];
}

// Check if a tier can manage another tier
export function canTierManage(managerTier: AgentTier, targetTier: AgentTier): boolean {
  const config = AGENT_TIER_CONFIG[managerTier];
  return config.canManage.includes(targetTier);
}

// Get all tiers that a tier can manage
export function getManagedTiers(tier: AgentTier): AgentTier[] {
  return AGENT_TIER_CONFIG[tier].canManage;
}

// =====================================================
// TIER-SPECIFIC MENUS
// =====================================================

// Menus only visible to Master tier and above
export const MASTER_ONLY_MENUS = [
  'agent-system', '/agent-system',
  'agent-system/commission', '/agent-system/commission',
  'agent-system/bank-settings', '/agent-system/bank-settings',
  'agent-system/site-settings', '/agent-system/site-settings',
  'agent-system/settlement', '/agent-system/settlement',
  'sub-sites', '/sub-sites',
  'master-rates', '/master-rates',
  'risk-management', '/risk-management',
];

// Menus visible to Agent tier and above
export const AGENT_TIER_MENUS = [
  'agent-members', '/agent-members',
  'agent/commission', '/agent/commission',
  'agent-profit-loss', '/agent-profit-loss',
  'agent-withdraw-history', '/agent-withdraw-history',
];

// Menus visible to Sub-Agent tier (minimal)
export const SUB_AGENT_MENUS = [
  'dashboard', '/',
  'member/summary', '/member/summary',
  'member/finance', '/member/finance',
  'member/slip-upload', '/member/slip-upload',
  'results', '/results',
];

// =====================================================
// PLATFORM-ONLY MENUS (agents should NOT see)
// =====================================================

export const PLATFORM_ONLY_MENUS = [
  // Super Admin
  'super-admin', '/super-admin',
  'master-control', '/master-control',
  'tenant-manager', '/tenant-manager',
  'site-manager', '/site-manager',
  
  // Multi-Tenant / Financial Hub
  'multi-tenant', '/multi-tenant',
  'financial-hub', '/financial-hub',
  'enterprise-summary', '/enterprise-summary',
  'billion-dashboard', '/billion-dashboard',
  'vip-dashboard', '/vip-dashboard',
  
  // System Security
  'security-dashboard', '/security-dashboard',
  'backup', '/backup',
  'health-check', '/health-check',
  'audit-logs', '/audit-logs',
  
  // User Management
  'users', '/users',
  'roles-permissions', '/roles-permissions',
  
  // Platform Settings
  'settings/system', '/settings/system',
  'settings', '/settings',
  'master-rates', '/master-rates',
  'risk-control', '/risk-control',
  
  // Sub-sites
  'sub-sites', '/sub-sites',
  
  // Platform Finance
  'payment-gateway', '/payment-gateway',
  'scb-maemanee', '/scb-maemanee',
  'wallet-manager', '/wallet-manager',
  'bank-settings', '/bank-settings',
  'payment-accounts', '/payment-accounts',
  'withdraw-accounts', '/withdraw-accounts',
  'finance/transactions', '/finance/transactions',
  'finance-reports', '/finance-reports',
  
  // Admin Operations (agents should not see platform operations)
  'topup-requests', '/topup-requests',
  'withdraw-requests', '/withdraw-requests',
  'credits', '/credits',
  'deposit-issues', '/deposit-issues',
  'pending-review', '/pending-review',
  
  // Customers (platform-level customer management)
  'customers', '/customers',
  'customer-history', '/customer-history',
  'customer-banks', '/customer-banks',
  'member-summary', '/member-summary',
  
  // Betting History (platform-level)
  'betting/history', '/betting/history',
  'betting/reports', '/betting/reports',
  
  // Lottery Management (platform-level)
  'lotteries', '/lotteries',
  'entries', '/entries',
  
  // Promotions (platform-level)
  'promotions', '/promotions',
  'referrals', '/referrals',
  'affiliate', '/affiliate',
  
  // Marketing (platform-level)
  'marketing-dashboard', '/marketing-dashboard',
  'campaigns', '/campaigns',
  'banners', '/banners',
  'notification-center', '/notification-center',
  'social-marketing', '/social-marketing',
  
  // Reports (platform-level)
  'reports/overview', '/reports/overview',
  'reports/summary', '/reports/summary',
  'reports/profit-loss', '/reports/profit-loss',
  'reports/vip-risk', '/reports/vip-risk',
  'number-analysis', '/number-analysis',
  
  // Staff Management (platform-level)
  'staff-management', '/staff-management',
  'attendance', '/attendance',
  
  // Site Settings (platform-level)
  'site-settings', '/site-settings',
  'theme-settings', '/theme-settings',
  'maintenance', '/maintenance',
  'export-data', '/export-data',
  
  // Live Feed (platform-level)
  'live-feed', '/live-feed',
  'live-broadcast', '/live-broadcast',
  'stream-settings', '/stream-settings',
  
  // Risk Control (platform-level)
  'risk-dashboard', '/risk-dashboard',
  'smart-risk', '/smart-risk',
  'number-limits', '/number-limits',
  'number-ban', '/number-ban',
  
  // Auto System (platform-level unless enabled)
  'auto-system', '/auto-system',
  'auto-system/entries', '/auto-system/entries',
  'auto-system/customers', '/auto-system/customers',
  'auto-marketing', '/auto-marketing',
  
  // Members under downline (platform-level)
  'downline-members', '/downline-members',
  'member-tree', '/member-tree',
];

// =====================================================
// MANUAL KEY MENUS (show when manual_key enabled)
// =====================================================

export const MANUAL_KEY_MENUS = [
  'manual-key', '/manual-key',
  'admin/key', '/admin/key',
  'manual-key/entries', '/manual-key/entries',
  'manual-key/customers', '/manual-key/customers',
  'manual-key/rates', '/manual-key/rates',
  'manual-downline', '/manual-downline',
  'manual-key-agents', '/manual-key-agents',
  'manual-key-marketing', '/manual-key-marketing',
  'prize-payout', '/prize-payout',
];

// =====================================================
// AUTO SYSTEM MENUS (show when auto enabled)
// =====================================================

export const AUTO_SYSTEM_MENUS = [
  'auto-system', '/auto-system',
  'auto-system/entries', '/auto-system/entries',
  'auto-system/customers', '/auto-system/customers',
  'auto-marketing', '/auto-marketing',
];

// =====================================================
// AGENT DEFAULT MENUS (always visible for agents)
// =====================================================

export const AGENT_DEFAULT_MENUS = [
  // Dashboard
  'dashboard', '/', '/agent-dashboard',
  
  // Results
  'results', '/results',
  
  // Reports (agent's own profit/loss)
  'reports', '/reports', '/agent-reports',
  'profit-loss', '/profit-loss', '/agent-profit-loss',
  'agent-summary', '/agent-summary',
  
  // Finance (agent's own)
  'agent/commission', '/agent/commission',
  'agent-withdraw-history', '/agent-withdraw-history',
  'member/summary', '/member/summary',
  'member/finance', '/member/finance',
  'member/slip-upload', '/member/slip-upload',
  
  // Downline management
  'agent-members', '/agent-members',
  
  // Agent system - สายงานเอเย่นต์ (manage sub-agents and staff)
  'agent-system', '/agent-system',
  'agent-system/members', '/agent-system/members', // จัดการพนักงาน/ทีมงาน
  'agent-system/commission', '/agent-system/commission', // คอมมิชชั่น
  
  // Credit management (distribute credit to sub-agents)
  'agent-credit', '/agent-credit', // กระจายเครดิต
  'agent-credit-transfer', '/agent-credit-transfer',
];

// =====================================================
// CLIENT-SIDE HELPER FUNCTIONS
// =====================================================

/**
 * Get effective menus for agent (client-side, uses session data)
 * Respects 4-tier hierarchy: Mother Web -> Master -> Agent -> Sub-Agent
 */
export function getEffectiveAgentMenus(session: AgentSession): string[] {
  let effectiveMenus = [...AGENT_DEFAULT_MENUS];
  
  // Determine agent tier
  const tierConfig = getTierConfig(session.agent_tier || session.role || 'agent');
  
  // Add tier-specific menus
  if (tierConfig.level <= 1) {
    // Master tier and above get master menus
    effectiveMenus = [...effectiveMenus, ...MASTER_ONLY_MENUS];
  }
  
  if (tierConfig.level <= 2) {
    // Agent tier and above get agent menus
    effectiveMenus = [...effectiveMenus, ...AGENT_TIER_MENUS];
  }
  
  // Sub-agents only get minimal menus
  if (tierConfig.level >= 3) {
    effectiveMenus = [...SUB_AGENT_MENUS];
  }
  
  // Add from session visible_menus
  if (session.visible_menus && session.visible_menus.length > 0) {
    effectiveMenus = [...effectiveMenus, ...session.visible_menus];
  }
  
  // Add manual key menus if enabled
  const tenantMode = session.tenant_mode || 'hybrid';
  const canManualKey = session.enable_manual_key !== false &&
    (tenantMode === 'manual_key_only' || tenantMode === 'hybrid' || tenantMode === 'both');
  if (canManualKey) {
    effectiveMenus = [...effectiveMenus, ...MANUAL_KEY_MENUS];
  }
  
  // Add auto system menus if enabled
  const canAutoSystem = session.enable_auto === true &&
    (tenantMode === 'auto_only' || tenantMode === 'hybrid' || tenantMode === 'both');
  if (canAutoSystem) {
    effectiveMenus = [...effectiveMenus, ...AUTO_SYSTEM_MENUS];
  }
  
  // Remove platform-only menus
  effectiveMenus = effectiveMenus.filter(m => !PLATFORM_ONLY_MENUS.includes(m));
  
  // Remove hidden menus
  if (session.hidden_menus && session.hidden_menus.length > 0) {
    effectiveMenus = effectiveMenus.filter(m => !session.hidden_menus!.includes(m));
  }
  
  // Deduplicate
  return [...new Set(effectiveMenus)];
}

/**
 * Get effective features for agent
 */
export function getEffectiveAgentFeatures(session: AgentSession): string[] {
  const features: string[] = [];
  const tenantMode = session.tenant_mode || 'hybrid';
  
  // Manual key
  const canManualKey = session.enable_manual_key !== false &&
    (tenantMode === 'manual_key_only' || tenantMode === 'hybrid' || tenantMode === 'both');
  if (canManualKey) features.push('manual_key', 'can_key_lottery');
  
  // Auto system
  const canAutoSystem = session.enable_auto === true &&
    (tenantMode === 'auto_only' || tenantMode === 'hybrid' || tenantMode === 'both');
  if (canAutoSystem) features.push('auto_system');
  
  // Add from session feature_flags
  if (session.feature_flags) {
    features.push(...session.feature_flags);
  }
  
  return [...new Set(features)];
}

/**
 * Check if agent has a specific feature
 */
export function requireAgentFeature(session: AgentSession, feature: string): boolean {
  const features = getEffectiveAgentFeatures(session);
  return features.includes(feature);
}

/**
 * Check if a menu is allowed for agent
 */
export function isMenuAllowedForAgent(session: AgentSession, menuHref: string): boolean {
  // Block platform-only menus
  if (PLATFORM_ONLY_MENUS.some(m => menuHref === m || menuHref.startsWith(m + '/'))) {
    return false;
  }
  
  // Get effective menus
  const effectiveMenus = getEffectiveAgentMenus(session);
  
  // Check if menu is in effective list
  // Normalize href (remove leading slash for comparison)
  const normalizedHref = menuHref.replace(/^\//, '');
  
  return effectiveMenus.some(m => {
    const normalizedMenu = m.replace(/^\//, '');
    return normalizedHref === normalizedMenu || 
           normalizedHref.startsWith(normalizedMenu + '/') ||
           m === menuHref;
  });
}

/**
 * Check if agent can see a specific sidebar menu item
 */
export function canAgentSeeMenuItem(
  session: AgentSession,
  menuHref: string,
  menuKey?: string
): boolean {
  // First check if menu is blocked
  if (PLATFORM_ONLY_MENUS.some(m => menuHref === m || menuHref.startsWith(m + '/'))) {
    return false;
  }
  
  // Check permissions map if available
  if (session.permissions && menuKey) {
    const perm = session.permissions[menuKey];
    if (perm && !perm.can_view) {
      return false;
    }
  }
  
  // Check against effective menus
  return isMenuAllowedForAgent(session, menuHref);
}
