/**
 * Agent Permission Resolver - Server-side exports
 * 
 * Server-side functions for resolving agent permissions.
 * Requires database access.
 * 
 * For client-side constants and helpers, use lib/agent-permissions.client.ts
 */

import { createClient } from '@/lib/supabase/server';

// Re-export client-safe types and constants
export type {
  TenantMode,
  SystemType,
  AgentSession,
  MenuPermission,
  EffectiveAgentPermissions,
} from './agent-permissions.client';

export {
  PLATFORM_ONLY_MENUS,
  MANUAL_KEY_MENUS,
  AUTO_SYSTEM_MENUS,
  AGENT_DEFAULT_MENUS,
  getEffectiveAgentMenus,
  getEffectiveAgentFeatures,
  requireAgentFeature,
  isMenuAllowedForAgent,
  canAgentSeeMenuItem,
} from './agent-permissions.client';

import type { TenantMode, SystemType, MenuPermission, EffectiveAgentPermissions } from './agent-permissions.client';
import { PLATFORM_ONLY_MENUS, MANUAL_KEY_MENUS, AUTO_SYSTEM_MENUS, AGENT_DEFAULT_MENUS } from './agent-permissions.client';

// =====================================================
// SERVER-SIDE RESOLVER FUNCTIONS
// =====================================================

/**
 * Resolve effective agent permissions by merging:
 * 1. Tenant feature flags
 * 2. Package features/limits
 * 3. Agent visible_menus from agent_permissions
 * 4. Explicit menu_permissions from parent platform
 * 5. Tenant mode (auto_only / manual_key_only / hybrid)
 */
export async function resolveAgentPermissions(
  agentId: string,
  tenantId?: string | null
): Promise<EffectiveAgentPermissions> {
  const supabase = await createClient();
  
  // 1. Fetch agent data
  const { data: agent } = await supabase
    .from('agents')
    .select('*, tenant:tenants(*)')
    .eq('id', agentId)
    .single();
  
  if (!agent) {
    throw new Error('Agent not found');
  }
  
  // 2. Fetch agent_permissions
  const { data: agentPerms } = await supabase
    .from('agent_permissions')
    .select('*')
    .eq('agent_id', agentId);
  
  // 3. Fetch tenant feature flags
  const effectiveTenantId = tenantId || agent.tenant_id;
  let tenantFeatures: string[] = [];
  let tenantMode: TenantMode = 'hybrid';
  let packageName: string | null = null;
  
  if (effectiveTenantId) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*, package:packages(*)')
      .eq('id', effectiveTenantId)
      .single();
    
    if (tenant) {
      tenantFeatures = tenant.feature_flags || [];
      tenantMode = (tenant.mode as TenantMode) || 'hybrid';
      packageName = tenant.package?.name || null;
    }
  }
  
  // 4. Build visible menus from agent_permissions
  let visibleMenus: string[] = [];
  const permissionsMap: Record<string, MenuPermission> = {};
  
  if (agentPerms && agentPerms.length > 0) {
    agentPerms.forEach((p) => {
      if (p.can_view) {
        visibleMenus.push(p.menu_key);
      }
      permissionsMap[p.menu_key] = {
        can_view: p.can_view ?? false,
        can_create: p.can_create ?? false,
        can_edit: p.can_edit ?? false,
        can_delete: p.can_delete ?? false,
        can_approve: p.can_approve ?? false,
        can_payout: p.can_payout ?? false,
      };
    });
  } else {
    // Fallback to agent.visible_menus
    try {
      visibleMenus = typeof agent.visible_menus === 'string'
        ? JSON.parse(agent.visible_menus)
        : agent.visible_menus || [];
    } catch {
      visibleMenus = [];
    }
  }
  
  // 5. Determine system type
  const systemType: SystemType = agent.system_type || 
    (agent.enable_manual_key && agent.enable_auto ? 'both' : 
     agent.enable_manual_key ? 'manual_key' : 
     agent.enable_auto ? 'auto' : 'manual_key');
  
  // 6. Build effective menus
  let effectiveMenus = [...AGENT_DEFAULT_MENUS, ...visibleMenus];
  
  // Add manual key menus if enabled
  const canManualKey = agent.enable_manual_key !== false && 
    (tenantMode === 'manual_key_only' || tenantMode === 'hybrid' || tenantMode === 'both');
  if (canManualKey) {
    effectiveMenus = [...effectiveMenus, ...MANUAL_KEY_MENUS];
  }
  
  // Add auto system menus if enabled
  const canAutoSystem = agent.enable_auto === true &&
    (tenantMode === 'auto_only' || tenantMode === 'hybrid' || tenantMode === 'both');
  if (canAutoSystem) {
    effectiveMenus = [...effectiveMenus, ...AUTO_SYSTEM_MENUS];
  }
  
  // 7. Remove platform-only menus
  effectiveMenus = effectiveMenus.filter(m => !PLATFORM_ONLY_MENUS.includes(m));
  
  // Deduplicate
  effectiveMenus = [...new Set(effectiveMenus)];
  
  // 8. Build enabled features
  const enabledFeatures: string[] = [];
  if (canManualKey) enabledFeatures.push('manual_key');
  if (canAutoSystem) enabledFeatures.push('auto_system');
  if (agent.can_create_sub_agent) enabledFeatures.push('create_sub_agent');
  if (agent.can_view_reports !== false) enabledFeatures.push('view_reports');
  
  return {
    user_id: agentId,
    user_type: 'agent',
    tenant_id: effectiveTenantId,
    agent_id: agentId,
    
    tenant_mode: tenantMode,
    system_type: systemType,
    package: packageName,
    
    visible_menus: visibleMenus,
    blocked_menus: PLATFORM_ONLY_MENUS,
    effective_menus: effectiveMenus,
    
    enabled_features: enabledFeatures,
    disabled_features: tenantFeatures.filter(f => !enabledFeatures.includes(f)),
    
    can_key_lottery: canManualKey,
    can_auto_system: canAutoSystem,
    can_create_sub_agent: agent.can_create_sub_agent ?? false,
    can_view_reports: agent.can_view_reports ?? true,
    can_approve_transactions: permissionsMap['financial']?.can_approve ?? false,
    can_manage_members: permissionsMap['member-visibility']?.can_view ?? true,
    can_manage_finances: permissionsMap['financial']?.can_view ?? false,
  };
}
