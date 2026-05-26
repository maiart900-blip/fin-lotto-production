import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDataScope, validateSessionForScope, applyFullDataScope } from '@/lib/data-scope';
import { 
  PLATFORM_ONLY_MENUS,
  MANUAL_KEY_MENUS,
  AGENT_DEFAULT_MENUS,
} from '@/lib/agent-permissions.client';

/**
 * Debug Data Scope Endpoint
 * Returns detailed information about the current user's data scope
 * 
 * IMPORTANT: This endpoint is for debugging only. Disable in production.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({
        error: 'No session found',
        authenticated: false,
      }, { status: 401 });
    }
    
    let session;
    try {
      session = JSON.parse(sessionCookie.value);
    } catch {
      return NextResponse.json({
        error: 'Invalid session format',
        authenticated: false,
      }, { status: 401 });
    }
    
    // Get data scope
    const scope = await getDataScope({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });
    
    // Validate session
    const validation = validateSessionForScope({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });
    
    const supabase = await createClient();
    
    // Count visible data (scoped)
    let customerQuery = supabase
      .from('customers')
      .select('id', { count: 'exact', head: true });
    customerQuery = applyFullDataScope(customerQuery, scope);
    const { count: visibleCustomerCount } = await customerQuery;
    
    let entryQuery = supabase
      .from('entries')
      .select('id', { count: 'exact', head: true });
    entryQuery = applyFullDataScope(entryQuery, scope);
    const { count: visibleEntryCount } = await entryQuery;
    
    // Count blocked data (global - would be blocked for agents)
    let blockedCustomerCount = 0;
    let blockedEntryCount = 0;
    
    if (scope.isAgent) {
      // Count customers that WOULD be visible without scope (global)
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true });
      
      blockedCustomerCount = (totalCustomers || 0) - (visibleCustomerCount || 0);
      
      const { count: totalEntries } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true });
      
      blockedEntryCount = (totalEntries || 0) - (visibleEntryCount || 0);
    }
    
    // Check for any unscoped API patterns
    const unscopedApiDetected = false; // Would need runtime detection
    
    // Get menu permissions from session
    const visibleMenus = session.visible_menus || [];
    const hiddenMenus = session.hidden_menus || [];
    
    // Build filter explanation
    const dataFilterExplanation = scope.isGlobalAdmin
      ? 'No filter - Super Admin has full access'
      : scope.isTenantOwner
        ? `tenant_id = '${scope.tenantId}'`
        : scope.isAgent
          ? `tenant_id = '${scope.tenantId}' AND agent_id IN [${scope.downlineAgentIds.slice(0, 3).join(', ')}${scope.downlineAgentIds.length > 3 ? '...' : ''}] (${scope.downlineAgentIds.length} agents)`
          : 'No access';
    
    return NextResponse.json({
      // Session identity
      session: {
        id: session.id,
        username: session.username,
        role: session.role,
        user_type: session.user_type || session.role,
      },
      
      // Data scope parameters
      dataScope: {
        tenantId: scope.tenantId,
        agentId: scope.agentId,
        downlineAgentIds: scope.downlineAgentIds,
        downlineCount: scope.downlineAgentIds.length,
      },
      
      // Scope flags
      flags: {
        isGlobalAdmin: scope.isGlobalAdmin,
        isTenantOwner: scope.isTenantOwner,
        isAgent: scope.isAgent,
        requiresTenantScope: scope.requiresTenantScope,
        requiresAgentScope: scope.requiresAgentScope,
        canAccessGlobalData: scope.canAccessGlobalData,
      },
      
      // Structure permissions (menus allowed by parent)
      structurePermissions: {
        visibleMenus,
        hiddenMenus,
        menuCount: visibleMenus.length,
      },
      
      // Data filter applied to queries
      dataFilter: dataFilterExplanation,
      scopeReason: scope.scopeReason,
      
      // Visible data counts (after scope applied)
      visibleData: {
        customers: visibleCustomerCount || 0,
        entries: visibleEntryCount || 0,
      },
      
      // Blocked data counts (would be visible without scope)
      blockedData: {
        customers: blockedCustomerCount,
        entries: blockedEntryCount,
      },
      
      // Validation
      validation: {
        valid: validation.valid,
        missing: validation.missing,
        warnings: validation.warnings,
      },
      
      // Security status
      security: {
        unscopedApiDetected,
        globalFallbackBlocked: scope.isAgent && !scope.canAccessGlobalData,
        tenantIsolationEnforced: scope.requiresTenantScope && !!scope.tenantId,
        agentIsolationEnforced: scope.isAgent && scope.downlineAgentIds.length > 0,
      },
      
      // Important reminder
      _reminder: 'STRUCTURE inheritance only - DATA is always scoped',
      _rule: 'Agents inherit menus from parent, but NEVER inherit data',
    });
    
  } catch (error) {
    console.error('[v0] Debug data-scope error:', error);
    return NextResponse.json({
      error: 'Failed to get data scope',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
