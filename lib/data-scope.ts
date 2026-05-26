/**
 * Data Scope Guard - Centralized data isolation for multi-tenant agent system
 * 
 * CORE RULES:
 * - Agents inherit STRUCTURE (menus, features, UI) from parent platform
 * - Agents NEVER inherit DATA (customers, entries, bets, transactions)
 * - Data is always scoped by tenant_id + agent_id/downline
 * 
 * Structure vs Data:
 * - STRUCTURE = menus, routes, feature flags, labels, UI layout, permissions
 * - DATA = customers, entries, bets, transactions, wallets, ledgers, reports
 */

import { createClient } from '@/lib/supabase/server';

// Explicit inheritance model constants
export const INHERIT_STRUCTURE_ONLY = true;
export const NEVER_INHERIT_DATA = true;

// User types that require data scoping
export const SCOPED_USER_TYPES = ['agent', 'agent_key', 'partner', 'member', 'staff'];
export const ADMIN_USER_TYPES = ['super_admin', 'admin', 'tenant_owner'];

// Tables that contain tenant/agent-scoped data
export const SCOPED_DATA_TABLES = [
  'customers',
  'entries', 
  'auto_entries',
  'manual_entries',
  'transactions',
  'credit_transactions',
  'deposits',
  'withdrawals',
  'betting_history',
  'ledger_entries',
  'agent_settlements',
  'customer_banks',
  'network_members',
];

export interface DataScope {
  // User identity
  userId: string;
  userType: string;
  role: string;
  
  // Scope parameters
  tenantId: string | null;
  agentId: string | null;
  downlineAgentIds: string[];
  
  // Flags
  isGlobalAdmin: boolean;
  isTenantOwner: boolean;
  isAgent: boolean;
  requiresTenantScope: boolean;
  requiresAgentScope: boolean;
  canAccessGlobalData: boolean;
  
  // For debugging
  scopeReason: string;
}

export interface SessionForScope {
  id: string;
  role?: string;
  user_type?: string;
  tenant_id?: string | null;
  agent_id?: string;
  downline_agent_ids?: string[];
}

/**
 * Get data scope for current user session
 * This determines what data the user can access
 */
export async function getDataScope(session: SessionForScope): Promise<DataScope> {
  const userType = session.user_type || session.role || 'unknown';
  const role = session.role || 'unknown';
  
  // Check user type categories
  const isGlobalAdmin = role === 'super_admin';
  const isTenantOwner = role === 'tenant_owner' || role === 'admin';
  const isAgent = SCOPED_USER_TYPES.includes(role) || 
                  ['agent', 'agent_key', 'partner'].includes(userType);
  const isMemberOrStaff = role === 'member' || role === 'staff';
  
  // Get downline agent IDs for agents
  let downlineAgentIds: string[] = [];
  if (isAgent && session.id) {
    downlineAgentIds = session.downline_agent_ids || 
                       await getAgentDownlineIds(session.id);
  }
  
  // Determine scope requirements
  const requiresTenantScope = !isGlobalAdmin;
  const requiresAgentScope = isAgent || isMemberOrStaff;
  const canAccessGlobalData = isGlobalAdmin;
  
  // Build scope reason for debugging
  let scopeReason = '';
  if (isGlobalAdmin) {
    scopeReason = 'Super admin - full global access';
  } else if (isTenantOwner) {
    scopeReason = `Tenant owner - access to tenant ${session.tenant_id}`;
  } else if (isAgent) {
    scopeReason = `Agent - access to own data and downline (${downlineAgentIds.length} agents)`;
  } else if (isMemberOrStaff) {
    scopeReason = 'Member/Staff - access to assigned agent scope only';
  } else {
    scopeReason = 'Unknown user type - no data access';
  }
  
  return {
    userId: session.id,
    userType,
    role,
    tenantId: session.tenant_id || null,
    agentId: isAgent ? session.id : (session.agent_id || null),
    downlineAgentIds,
    isGlobalAdmin,
    isTenantOwner,
    isAgent,
    requiresTenantScope,
    requiresAgentScope,
    canAccessGlobalData,
    scopeReason,
  };
}

/**
 * Get all agent IDs in downline (recursive)
 */
export async function getAgentDownlineIds(agentId: string): Promise<string[]> {
  const supabase = await createClient();
  const allIds: string[] = [agentId];
  
  // Get direct children
  const { data: children } = await supabase
    .from('agents')
    .select('id')
    .eq('parent_agent_id', agentId)
    .eq('is_active', true);
  
  if (children && children.length > 0) {
    for (const child of children) {
      const childDownline = await getAgentDownlineIds(child.id);
      allIds.push(...childDownline);
    }
  }
  
  return [...new Set(allIds)]; // Remove duplicates
}

/**
 * Require tenant scope - throws if no tenant_id
 * Used to block global data access for non-admin users
 */
export function requireTenantScope(scope: DataScope): void {
  if (scope.canAccessGlobalData) return;
  
  if (!scope.tenantId) {
    throw new DataScopeError(
      'MISSING_TENANT_SCOPE',
      'ไม่สามารถเข้าถึงข้อมูลได้ - ไม่มี tenant_id ในเซสชัน'
    );
  }
}

/**
 * Require agent scope - throws if no agent_id for agent users
 */
export function requireAgentScope(scope: DataScope): void {
  if (scope.canAccessGlobalData || scope.isTenantOwner) return;
  
  if (scope.isAgent && !scope.agentId) {
    throw new DataScopeError(
      'MISSING_AGENT_SCOPE',
      'ไม่สามารถเข้าถึงข้อมูลได้ - ไม่มี agent_id ในเซสชัน'
    );
  }
}

/**
 * Assert no global fallback - used to verify we never fall back to global data
 */
export function assertNoGlobalFallback(scope: DataScope): void {
  if (scope.isAgent && !scope.tenantId && !scope.agentId) {
    throw new DataScopeError(
      'GLOBAL_FALLBACK_BLOCKED',
      'ปฏิเสธการเข้าถึง - เอเย่นต์ไม่สามารถเข้าถึงข้อมูล global ได้'
    );
  }
}

/**
 * Apply tenant scope to a Supabase query
 * Filters by tenant_id for non-admin users
 */
export function applyTenantScope<T extends { eq: (col: string, val: any) => T }>(
  query: T,
  scope: DataScope
): T {
  if (scope.canAccessGlobalData) {
    return query; // Super admin sees all
  }
  
  if (scope.tenantId) {
    return query.eq('tenant_id', scope.tenantId);
  }
  
  // No tenant_id - return impossible filter to prevent global data
  return query.eq('tenant_id', '__NO_ACCESS__');
}

/**
 * Apply agent downline scope to a Supabase query
 * Filters by agent_id IN downline for agent users
 */
export function applyAgentDownlineScope<T extends { 
  eq: (col: string, val: any) => T;
  in: (col: string, vals: any[]) => T;
}>(
  query: T,
  scope: DataScope,
  agentColumn: string = 'agent_id'
): T {
  if (scope.canAccessGlobalData) {
    return query; // Super admin sees all
  }
  
  if (scope.isTenantOwner) {
    // Tenant owner sees all in tenant (already filtered by tenant_id)
    return query;
  }
  
  if (scope.isAgent) {
    const agentIds = scope.downlineAgentIds.length > 0 
      ? scope.downlineAgentIds 
      : (scope.agentId ? [scope.agentId] : []);
    
    if (agentIds.length === 0) {
      // No agent IDs - return impossible filter
      return query.eq(agentColumn, '__NO_ACCESS__');
    }
    
    if (agentIds.length === 1) {
      return query.eq(agentColumn, agentIds[0]);
    }
    
    return query.in(agentColumn, agentIds);
  }
  
  // Unknown user type - block access
  return query.eq(agentColumn, '__NO_ACCESS__');
}

/**
 * Apply full data scope (tenant + agent) to a query
 * This is the primary function for scoping data queries
 */
export function applyFullDataScope<T extends { 
  eq: (col: string, val: any) => T;
  in: (col: string, vals: any[]) => T;
  or: (filter: string) => T;
  not: (col: string, operator: string, val: any) => T;
}>(
  query: T,
  scope: DataScope,
  options: {
    tenantColumn?: string;
    agentColumn?: string;
    excludeNullTenant?: boolean;
    excludeNullAgent?: boolean;
  } = {}
): T {
  const {
    tenantColumn = 'tenant_id',
    agentColumn = 'agent_id',
    excludeNullTenant = true,
    excludeNullAgent = true,
  } = options;
  
  // Super admin sees all
  if (scope.canAccessGlobalData) {
    return query;
  }
  
  // Apply tenant filter
  if (scope.tenantId) {
    query = query.eq(tenantColumn, scope.tenantId);
  } else if (excludeNullTenant && scope.requiresTenantScope) {
    // Block access to null tenant data for scoped users
    query = query.not(tenantColumn, 'is', null);
  }
  
  // Apply agent filter for agent users
  // NOTE: Agents can see:
  //   1. Records assigned to them or their downline (agent_id IN agentIds)
  //   2. Unassigned records in their tenant (agent_id IS NULL)
  // This allows agents to work with customers not yet assigned to any agent.
  if (scope.isAgent) {
    const agentIds = scope.downlineAgentIds.length > 0 
      ? scope.downlineAgentIds 
      : (scope.agentId ? [scope.agentId] : []);
    
    if (agentIds.length > 0) {
      // Include both assigned (in downline) and unassigned (NULL) records
      const agentIdList = agentIds.join(',');
      query = query.or(`${agentColumn}.in.(${agentIdList}),${agentColumn}.is.null`);
    } else if (!excludeNullAgent) {
      // Agent with no downline can only see unassigned records
      query = query.eq(agentColumn, null);
    } else {
      // Block access if no agent IDs and excludeNullAgent is true
      query = query.eq(agentColumn, '__NO_ACCESS__');
    }
  }
  
  return query;
}

/**
 * Check if a specific record is accessible by the current scope
 */
export function isRecordAccessible(
  record: { tenant_id?: string | null; agent_id?: string | null },
  scope: DataScope
): { allowed: boolean; reason: string } {
  // Super admin can access all
  if (scope.canAccessGlobalData) {
    return { allowed: true, reason: 'Super admin access' };
  }
  
  // Check tenant scope
  if (scope.requiresTenantScope) {
    if (!record.tenant_id) {
      return { allowed: false, reason: 'Record has no tenant_id - global data blocked' };
    }
    if (record.tenant_id !== scope.tenantId) {
      return { allowed: false, reason: 'Record belongs to different tenant' };
    }
  }
  
  // Check agent scope
  // NOTE: Agents can access unassigned records (agent_id = NULL) within their tenant
  if (scope.isAgent) {
    // Unassigned records (NULL agent_id) are allowed if in same tenant
    if (record.agent_id === null || record.agent_id === undefined) {
      // Agent can see unassigned customers in their tenant
      return { allowed: true, reason: 'Unassigned record in agent tenant' };
    }
    if (!scope.downlineAgentIds.includes(record.agent_id) && record.agent_id !== scope.agentId) {
      return { allowed: false, reason: 'Record belongs to agent outside downline' };
    }
  }
  
  return { allowed: true, reason: 'Record is within scope' };
}

/**
 * Get empty state message for agent users with no data
 */
export function getEmptyStateMessage(scope: DataScope, dataType: string): string {
  if (scope.isAgent) {
    return `ยังไม่มี${dataType}ในสายงานของคุณ`;
  }
  if (scope.isTenantOwner) {
    return `ยังไม่มี${dataType}ในเว็บไซต์ของคุณ`;
  }
  return `ยังไม่มี${dataType}`;
}

/**
 * Custom error for data scope violations
 */
export class DataScopeError extends Error {
  code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'DataScopeError';
  }
}

/**
 * Verify session has required fields for data scoping
 */
export function validateSessionForScope(session: SessionForScope): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  if (!session.id) missing.push('id');
  if (!session.role && !session.user_type) missing.push('role or user_type');
  
  const isAgent = SCOPED_USER_TYPES.includes(session.role || '') ||
                  ['agent', 'agent_key', 'partner'].includes(session.user_type || '');
  
  if (isAgent) {
    if (!session.tenant_id) warnings.push('tenant_id missing - will block data access');
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}
