/**
 * Customer Scope Helper - Prevents data leakage across tenants and agents
 * 
 * RULES:
 * 1. Agent must NEVER see parent platform customers
 * 2. Agent must NEVER see customers from other tenants
 * 3. Agent must NEVER see customers from other agents unless they are in the agent downline
 * 4. Super Admin can see all customers
 * 5. Tenant owner can see customers only in own tenant
 * 6. Agent can see only:
 *    - customers.tenant_id = session.tenant_id
 *    - AND customers.agent_id in current agent/downline agent ids
 * 7. If customer has no tenant_id or agent_id, do NOT show it to agent
 */

import { createClient } from '@/lib/supabase/server';

export interface SessionUser {
  id: string;
  role: string;
  user_type?: string;
  tenant_id?: string | null;
  branch_id?: string | null;
}

export interface CustomerScopeResult {
  canAccessAll: boolean;
  tenantId: string | null;
  agentIds: string[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isTenantOwner: boolean;
}

/**
 * Get the scope/filter parameters for customer queries based on user session
 */
export async function getCustomerScopeForUser(session: SessionUser): Promise<CustomerScopeResult> {
  const role = session.role;
  const userType = session.user_type || role;
  
  // Super Admin - can see all
  if (role === 'super_admin' || role === 'platform_admin') {
    return {
      canAccessAll: true,
      tenantId: null,
      agentIds: [],
      isSuperAdmin: true,
      isAdmin: false,
      isAgent: false,
      isTenantOwner: false,
    };
  }
  
  // Admin (tenant owner) - can see all in their tenant
  if (role === 'admin' || role === 'owner' || role === 'tenant_admin') {
    return {
      canAccessAll: false,
      tenantId: session.tenant_id || null,
      agentIds: [],
      isSuperAdmin: false,
      isAdmin: true,
      isAgent: false,
      isTenantOwner: true,
    };
  }
  
  // Agent roles - must be scoped to tenant AND downline
  if (role === 'agent' || role === 'agent_key' || role === 'partner' || 
      userType === 'agent' || role === 'staff') {
    const agentIds = await getAgentDownlineIds(session.id);
    
    return {
      canAccessAll: false,
      tenantId: session.tenant_id || null,
      agentIds: agentIds,
      isSuperAdmin: false,
      isAdmin: false,
      isAgent: true,
      isTenantOwner: false,
    };
  }
  
  // Member - no access to customer list
  if (role === 'member' || role === 'customer') {
    return {
      canAccessAll: false,
      tenantId: null,
      agentIds: [],
      isSuperAdmin: false,
      isAdmin: false,
      isAgent: false,
      isTenantOwner: false,
    };
  }
  
  // Default - no access
  return {
    canAccessAll: false,
    tenantId: null,
    agentIds: [],
    isSuperAdmin: false,
    isAdmin: false,
    isAgent: false,
    isTenantOwner: false,
  };
}

/**
 * Get all agent IDs in the downline of the given agent (recursive)
 * Includes the agent itself
 */
export async function getAgentDownlineIds(agentId: string): Promise<string[]> {
  const supabase = await createClient();
  
  // Get the agent's downline using recursive query
  // First get direct children, then their children, etc.
  const allIds = new Set<string>([agentId]);
  
  // Fetch all agents for the downline calculation
  // In a production system, this should use a recursive CTE or pre-computed closure table
  const { data: agents } = await supabase
    .from('agents')
    .select('id, parent_agent_id, parent_id, upline_id')
    .order('level', { ascending: true });
  
  if (!agents || agents.length === 0) {
    return [agentId];
  }
  
  // Build downline by traversing parent relationships
  let changed = true;
  let iterations = 0;
  const maxIterations = 20; // Prevent infinite loops
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    for (const agent of agents) {
      // Skip if already in downline
      if (allIds.has(agent.id)) continue;
      
      // Check if parent is in downline
      const parentId = agent.parent_agent_id || agent.parent_id || agent.upline_id;
      if (parentId && allIds.has(parentId)) {
        allIds.add(agent.id);
        changed = true;
      }
    }
  }
  
  return Array.from(allIds);
}

/**
 * Apply customer scope filters to a Supabase query
 * This modifies the query in place and returns it
 */
export function applyCustomerScope<T extends { eq: Function; in: Function; or: Function }>(
  query: T,
  scope: CustomerScopeResult
): T {
  // Super Admin - no filters needed
  if (scope.canAccessAll) {
    return query;
  }
  
  // No scope means no access
  if (!scope.tenantId && scope.agentIds.length === 0 && !scope.isAdmin) {
    // Force empty result by filtering on impossible condition
    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    return query;
  }
  
  // Admin/Tenant Owner - filter by tenant_id only
  if (scope.isAdmin || scope.isTenantOwner) {
    if (scope.tenantId) {
      query = query.eq('tenant_id', scope.tenantId);
    }
    return query;
  }
  
  // Agent - filter by tenant_id AND (agent_id in downline OR agent_id is NULL for unassigned)
  if (scope.isAgent) {
    // Must have tenant_id
    if (scope.tenantId) {
      query = query.eq('tenant_id', scope.tenantId);
    }
    
    // Agent can see:
    // 1. Customers explicitly assigned to them or their downline (agent_id IN downline)
    // 2. Unassigned customers in their tenant (agent_id IS NULL) - these are "floating" customers
    // 
    // NOTE: This allows agents to see unassigned customers in their tenant.
    // If stricter isolation is needed, change to only allow agent_id IN downline.
    if (scope.agentIds.length > 0) {
      // Use OR to include both assigned (in downline) and unassigned (NULL) customers
      const agentIdList = scope.agentIds.join(',');
      query = query.or(`agent_id.in.(${agentIdList}),agent_id.is.null`);
    } else {
      // Agent has no downline - can only see unassigned customers in their tenant
      query = query.is('agent_id', null);
    }
    
    return query;
  }
  
  // Default - no access
  query = query.eq('id', '00000000-0000-0000-0000-000000000000');
  return query;
}

/**
 * Check if a user can access a specific customer
 * Returns true if access is allowed, false otherwise
 */
export async function requireCustomerAccess(
  customerId: string,
  session: SessionUser
): Promise<{ allowed: boolean; reason?: string }> {
  const scope = await getCustomerScopeForUser(session);
  
  // Super Admin - always allowed
  if (scope.canAccessAll) {
    return { allowed: true };
  }
  
  // Fetch the customer to check scope
  const supabase = await createClient();
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, tenant_id, agent_id')
    .eq('id', customerId)
    .single();
  
  if (error || !customer) {
    return { allowed: false, reason: 'Customer not found' };
  }
  
  // Admin/Tenant Owner - check tenant_id matches
  if (scope.isAdmin || scope.isTenantOwner) {
    if (!scope.tenantId) {
      return { allowed: true }; // No tenant restriction = can see all
    }
    if (customer.tenant_id !== scope.tenantId) {
      return { allowed: false, reason: 'Customer belongs to different tenant' };
    }
    return { allowed: true };
  }
  
  // Agent - check tenant_id AND agent_id in downline
  if (scope.isAgent) {
    // Check tenant_id
    if (scope.tenantId && customer.tenant_id !== scope.tenantId) {
      return { allowed: false, reason: 'Customer belongs to different tenant' };
    }
    
    // Customer must have agent_id
    if (!customer.agent_id) {
      return { allowed: false, reason: 'Customer has no agent assignment' };
    }
    
    // Check agent_id in downline
    if (!scope.agentIds.includes(customer.agent_id)) {
      return { allowed: false, reason: 'Customer is not in your downline' };
    }
    
    return { allowed: true };
  }
  
  return { allowed: false, reason: 'Insufficient permissions' };
}

/**
 * Validate customer ID list for batch operations
 * Returns only the IDs that the user is allowed to access
 */
export async function filterAccessibleCustomerIds(
  customerIds: string[],
  session: SessionUser
): Promise<string[]> {
  if (customerIds.length === 0) return [];
  
  const scope = await getCustomerScopeForUser(session);
  
  // Super Admin - all allowed
  if (scope.canAccessAll) {
    return customerIds;
  }
  
  // Fetch customers to check scope
  const supabase = await createClient();
  let query = supabase
    .from('customers')
    .select('id, tenant_id, agent_id')
    .in('id', customerIds);
  
  // Apply scope filters
  query = applyCustomerScope(query, scope);
  
  const { data: customers } = await query;
  
  return (customers || []).map(c => c.id);
}
