'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from './use-auth';
import {
  UserRole,
  MenuPermissionConfig,
  PermissionChecker,
  getEffectivePermissions,
  getDefaultMenusForRole,
  getDefaultFeaturesForRole,
  getRequiredRolesForRoute,
  MEMBER_MENUS,
  AGENT_MENUS,
  LOTTERY_TYPE_PERMISSIONS,
} from '@/lib/permissions';

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : null);

export interface UsePermissionsReturn {
  // Loading states
  isLoading: boolean;
  
  // Permission data
  permissions: MenuPermissionConfig | null;
  effectivePermissions: MenuPermissionConfig;
  checker: PermissionChecker | null;
  
  // Check functions
  canSeeMenu: (menuId: string) => boolean;
  hasFeature: (featureId: string) => boolean;
  canAccessRoute: (route: string) => boolean;
  
  // Get lists
  getVisibleMenus: () => string[];
  getVisibleMemberMenus: () => typeof MEMBER_MENUS;
  getVisibleAgentMenus: () => typeof AGENT_MENUS;
  getVisibleLotteryTypes: () => typeof LOTTERY_TYPE_PERMISSIONS;
  
  // Quick flags
  canCreateSubAgent: boolean;
  canViewReports: boolean;
  canKeyLottery: boolean;
  canApproveTransactions: boolean;
  canManageMembers: boolean;
  canManageFinances: boolean;
  
  // Refresh
  mutate: () => void;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // Fetch user's menu permissions
  const { data: userPermissions, mutate: mutateUserPerm, isLoading: isLoadingUserPerm } = useSWR<MenuPermissionConfig | null>(
    user?.id ? `/api/menu-permissions?target_id=${user.id}&target_type=user` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  // Fetch agent permissions (if user belongs to an agent)
  const { data: agentPermissions, isLoading: isLoadingAgentPerm } = useSWR<MenuPermissionConfig | null>(
    user?.branch_id ? `/api/menu-permissions?target_id=${user.branch_id}&target_type=agent` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  // Fetch sub-site permissions (if applicable)
  const { data: subSitePermissions, isLoading: isLoadingSubSitePerm } = useSWR<MenuPermissionConfig | null>(
    null, // TODO: Add sub_site_id when available
    fetcher,
    { revalidateOnFocus: false }
  );
  
  const isLoading = isAuthLoading || isLoadingUserPerm || isLoadingAgentPerm || isLoadingSubSitePerm;
  
  // Get user's role (convert to UserRole type)
  const userRole = useMemo((): UserRole => {
    if (!user?.role) return 'member';
    // Map legacy roles to new roles
    const roleMap: Record<string, UserRole> = {
      'super_admin': 'super_admin',
      'master_admin': 'master_admin',
      'admin': 'admin',
      'agent': 'agent',
      'agent_auto': 'agent_auto',
      'agent_key': 'agent_key',
      'key_branch': 'key_branch',
      'staff': 'staff',
      'member': 'member',
      'partner': 'agent', // Map partner to agent
    };
    return roleMap[user.role] || 'member';
  }, [user?.role]);
  
  // Calculate effective permissions
  const effectivePermissions = useMemo(() => {
    return getEffectivePermissions(
      userRole,
      userPermissions,
      agentPermissions,
      subSitePermissions
    );
  }, [userRole, userPermissions, agentPermissions, subSitePermissions]);
  
  // Create permission checker
  const checker = useMemo(() => {
    return new PermissionChecker(effectivePermissions, userRole);
  }, [effectivePermissions, userRole]);
  
  // Check if user can see a menu
  const canSeeMenu = useCallback((menuId: string): boolean => {
    if (!checker) return false;
    return checker.canSeeMenu(menuId);
  }, [checker]);
  
  // Check if user has a feature
  const hasFeature = useCallback((featureId: string): boolean => {
    if (!checker) return false;
    return checker.hasFeature(featureId);
  }, [checker]);
  
  // Check if user can access a route
  const canAccessRoute = useCallback((route: string): boolean => {
    // First check role-based restrictions
    const requiredRoles = getRequiredRolesForRoute(route);
    if (requiredRoles && !requiredRoles.includes(userRole)) {
      return false;
    }
    
    // Then check menu-based permissions
    if (!checker) return true;
    return checker.canAccessRoute(route);
  }, [checker, userRole]);
  
  // Get visible menus
  const getVisibleMenus = useCallback((): string[] => {
    if (!checker) return getDefaultMenusForRole(userRole);
    return checker.getVisibleMenus();
  }, [checker, userRole]);
  
  // Get visible member menus
  const getVisibleMemberMenus = useCallback(() => {
    const visibleIds = getVisibleMenus();
    return MEMBER_MENUS.filter(m => visibleIds.includes(m.id));
  }, [getVisibleMenus]);
  
  // Get visible agent menus
  const getVisibleAgentMenus = useCallback(() => {
    const visibleIds = getVisibleMenus();
    return AGENT_MENUS.filter(m => visibleIds.includes(m.id));
  }, [getVisibleMenus]);
  
  // Get visible lottery types
  const getVisibleLotteryTypes = useCallback(() => {
    const visibleIds = getVisibleMenus();
    return LOTTERY_TYPE_PERMISSIONS.filter(m => visibleIds.includes(m.id));
  }, [getVisibleMenus]);
  
  // Mutate/refresh permissions
  const mutate = useCallback(() => {
    mutateUserPerm();
  }, [mutateUserPerm]);
  
  return {
    isLoading,
    permissions: userPermissions || null,
    effectivePermissions,
    checker,
    canSeeMenu,
    hasFeature,
    canAccessRoute,
    getVisibleMenus,
    getVisibleMemberMenus,
    getVisibleAgentMenus,
    getVisibleLotteryTypes,
    canCreateSubAgent: effectivePermissions.can_create_sub_agent,
    canViewReports: effectivePermissions.can_view_reports,
    canKeyLottery: effectivePermissions.can_key_lottery,
    canApproveTransactions: effectivePermissions.can_approve_transactions,
    canManageMembers: effectivePermissions.can_manage_members,
    canManageFinances: effectivePermissions.can_manage_finances,
    mutate,
  };
}

/**
 * Hook สำหรับเช็ค permission ก่อนเข้าหน้า
 * ใช้ใน layout หรือ page component
 */
export function useRoutePermission(route: string) {
  const { canAccessRoute, isLoading } = usePermissions();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (!isLoading) {
      setHasAccess(canAccessRoute(route));
    }
  }, [isLoading, canAccessRoute, route]);
  
  return {
    hasAccess,
    isLoading,
  };
}

/**
 * Hook สำหรับเช็ค menu permission
 */
export function useMenuPermission(menuId: string) {
  const { canSeeMenu, isLoading } = usePermissions();
  const [canSee, setCanSee] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (!isLoading) {
      setCanSee(canSeeMenu(menuId));
    }
  }, [isLoading, canSeeMenu, menuId]);
  
  return {
    canSee,
    isLoading,
  };
}
