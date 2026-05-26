/**
 * Agent Permission Resolver - Client-safe exports
 * 
 * Constants and client-side helper functions for resolving agent permissions.
 * Used by sidebar and other client components.
 * 
 * NOTE: Server-side functions are in lib/agent-permissions.server.ts
 */

// =====================================================
// TYPES
// =====================================================

export type TenantMode = 'auto_only' | 'manual_key_only' | 'hybrid' | 'both';
export type SystemType = 'auto' | 'manual_key' | 'both' | 'hybrid';

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
}

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
  'master-rates', '/master-rates',
  'risk-control', '/risk-control',
  
  // Sub-sites
  'sub-sites', '/sub-sites',
  
  // Platform Finance
  'payment-gateway', '/payment-gateway',
  'scb-maemanee', '/scb-maemanee',
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
  
  // Reports
  'reports', '/reports', '/agent-reports',
  'profit-loss', '/profit-loss', '/agent-profit-loss',
  
  // Finance (agent's own)
  'agent/commission', '/agent/commission',
  'agent-withdraw-history', '/agent-withdraw-history',
  'member/summary', '/member/summary',
  'member/finance', '/member/finance',
  'member/slip-upload', '/member/slip-upload',
  
  // Downline
  'agent-members', '/agent-members',
];

// =====================================================
// CLIENT-SIDE HELPER FUNCTIONS
// =====================================================

/**
 * Get effective menus for agent (client-side, uses session data)
 */
export function getEffectiveAgentMenus(session: AgentSession): string[] {
  let effectiveMenus = [...AGENT_DEFAULT_MENUS];
  
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
