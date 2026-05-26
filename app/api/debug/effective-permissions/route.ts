import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  resolveAgentPermissions, 
} from '@/lib/agent-permissions';
import {
  getEffectiveAgentMenus,
  getEffectiveAgentFeatures,
  PLATFORM_ONLY_MENUS,
  MANUAL_KEY_MENUS,
  AUTO_SYSTEM_MENUS,
  AGENT_DEFAULT_MENUS,
} from '@/lib/agent-permissions.client';

/**
 * Debug endpoint for effective permissions
 * 
 * Returns complete permission information for the current logged-in user.
 * Protected: Only accessible by admin/super_admin or the user themselves (for debugging)
 * 
 * GET /api/debug/effective-permissions
 * GET /api/debug/effective-permissions?user_id=xxx (admin only)
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('lottery_session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    let session;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('user_id');
    
    // If requesting another user's permissions, require admin
    if (targetUserId && targetUserId !== session.id) {
      if (session.role !== 'super_admin' && session.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Admin access required to view other users' },
          { status: 403 }
        );
      }
    }
    
    const userId = targetUserId || session.id;
    const userType = session.user_type;
    const sourceTable = session.source_table;
    
    // Fetch user data based on source table
    let userData: any = null;
    let tenantId: string | null = null;
    let agentId: string | null = null;
    let tenantMode: string | null = null;
    let packageName: string | null = null;
    let visibleMenus: string[] = [];
    let hiddenMenus: string[] = [];
    let enabledFeatures: string[] = [];
    let blockedMenus: string[] = [];
    let allowedRoutes: string[] = [];
    let deniedRoutes: { route: string; reason: string }[] = [];
    
    if (sourceTable === 'agents') {
      // Fetch agent data
      const { data: agent } = await supabase
        .from('agents')
        .select('*, tenant:tenants(*)')
        .eq('id', userId)
        .single();
      
      if (!agent) {
        return NextResponse.json(
          { success: false, error: 'Agent not found' },
          { status: 404 }
        );
      }
      
      userData = agent;
      tenantId = agent.tenant_id;
      agentId = agent.id;
      
      // Fetch tenant info
      if (agent.tenant) {
        tenantMode = agent.tenant.mode || 'hybrid';
        packageName = agent.tenant.package?.name || null;
      }
      
      // Resolve agent permissions using the centralized resolver
      try {
        const effectivePerms = await resolveAgentPermissions(userId, tenantId);
        visibleMenus = effectivePerms.effective_menus;
        blockedMenus = effectivePerms.blocked_menus;
        enabledFeatures = effectivePerms.enabled_features;
        
        // Build allowed/denied routes
        const allRoutes = [
          '/', '/agent-dashboard',
          '/manual-key', '/manual-key/entries', '/manual-key/customers', '/manual-key/rates',
          '/auto-system', '/auto-system/entries', '/auto-system/customers',
          '/results', '/reports', '/profit-loss',
          '/agent-members', '/agent/commission', '/agent-withdraw-history',
          '/member/summary', '/member/finance', '/member/slip-upload',
          '/prize-payout', '/admin/key',
          // Platform routes (should be denied)
          '/users', '/roles-permissions', '/super-admin', '/master-control',
          '/financial-hub', '/multi-tenant', '/security-dashboard',
        ];
        
        allRoutes.forEach(route => {
          const normalizedRoute = route.startsWith('/') ? route : '/' + route;
          const menuKey = route.startsWith('/') ? route.slice(1) : route;
          
          // Check if platform-only
          if (PLATFORM_ONLY_MENUS.includes(normalizedRoute) || PLATFORM_ONLY_MENUS.includes(menuKey)) {
            deniedRoutes.push({ route, reason: 'Platform-only menu (not available for agents)' });
            return;
          }
          
          // Check manual key routes
          const isManualKeyRoute = MANUAL_KEY_MENUS.some(m => 
            normalizedRoute === m || normalizedRoute.startsWith(m + '/')
          );
          if (isManualKeyRoute && !effectivePerms.can_key_lottery) {
            deniedRoutes.push({ route, reason: 'Manual key feature disabled for this agent' });
            return;
          }
          
          // Check auto system routes
          const isAutoRoute = AUTO_SYSTEM_MENUS.some(m => 
            normalizedRoute === m || normalizedRoute.startsWith(m + '/')
          );
          if (isAutoRoute && !effectivePerms.can_auto_system) {
            deniedRoutes.push({ route, reason: 'Auto system feature disabled for this agent' });
            return;
          }
          
          // Check if in visible menus
          if (visibleMenus.includes(normalizedRoute) || visibleMenus.includes(menuKey)) {
            allowedRoutes.push(route);
          } else if (AGENT_DEFAULT_MENUS.includes(normalizedRoute) || AGENT_DEFAULT_MENUS.includes(menuKey)) {
            allowedRoutes.push(route);
          }
        });
        
      } catch (error) {
        console.error('Error resolving agent permissions:', error);
      }
      
    } else if (sourceTable === 'users') {
      // Fetch admin/user data
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }
      
      userData = user;
      
      // Admin users have full access (no blocked menus)
      if (user.role === 'super_admin') {
        enabledFeatures = ['all'];
        allowedRoutes = ['*'];
      } else if (user.role === 'admin') {
        enabledFeatures = ['admin'];
        blockedMenus = ['/super-admin'];
        deniedRoutes.push({ route: '/super-admin', reason: 'Super admin only' });
      }
      
      // Get menu_permissions if any
      const { data: perms } = await supabase
        .from('menu_permissions')
        .select('*')
        .eq('target_id', userId)
        .eq('target_type', 'user')
        .maybeSingle();
      
      if (perms) {
        visibleMenus = perms.visible_menus || [];
        hiddenMenus = perms.hidden_menus || [];
      }
      
    } else if (sourceTable === 'customers') {
      // Fetch customer data (member or customer)
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!customer) {
        return NextResponse.json(
          { success: false, error: 'Customer not found' },
          { status: 404 }
        );
      }
      
      userData = customer;
      
      // Get menu_permissions if any
      const targetType = customer.agent_level === 'agent' ? 'agent' : 
                         customer.agent_level === 'member' ? 'member' : 'customer';
      const { data: perms } = await supabase
        .from('menu_permissions')
        .select('*')
        .eq('target_id', userId)
        .eq('target_type', targetType)
        .maybeSingle();
      
      if (perms) {
        visibleMenus = perms.visible_menus || [];
        hiddenMenus = perms.hidden_menus || [];
      }
    }
    
    // Build response
    return NextResponse.json({
      success: true,
      effective_permissions: {
        // Identity
        user_id: userId,
        user_type: userType,
        source_table: sourceTable,
        role: userData?.role || session.role,
        
        // Tenant/Agent context
        tenant_id: tenantId,
        agent_id: agentId,
        tenant_mode: tenantMode,
        package: packageName,
        
        // Features
        enabled_features: enabledFeatures,
        disabled_features: [],
        
        // Menus
        visible_menus: visibleMenus,
        blocked_menus: blockedMenus,
        hidden_menus: hiddenMenus,
        
        // Routes
        allowed_routes: allowedRoutes,
        denied_routes: deniedRoutes,
        
        // Quick flags
        can_key_lottery: enabledFeatures.includes('manual_key') || enabledFeatures.includes('can_key_lottery'),
        can_auto_system: enabledFeatures.includes('auto_system'),
        can_create_sub_agent: userData?.can_create_sub_agent ?? false,
        can_view_reports: userData?.can_view_reports ?? true,
        can_approve_transactions: false,
        can_manage_members: true,
        can_manage_finances: false,
      },
      
      // Raw data for debugging
      raw_data: {
        session,
        user_data: {
          id: userData?.id,
          username: userData?.username || userData?.code,
          role: userData?.role,
          system_type: userData?.system_type,
          enable_manual_key: userData?.enable_manual_key,
          enable_auto: userData?.enable_auto,
          visible_menus: userData?.visible_menus,
        },
      },
    });
    
  } catch (error) {
    console.error('Error fetching effective permissions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
