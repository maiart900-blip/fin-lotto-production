'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useRef } from 'react';

export type UserRole = 'super_admin' | 'admin' | 'agent' | 'agent_key' | 'partner' | 'staff' | 'member' | 'customer';

export interface BranchInfo {
  id: string;
  code: string;
  name: string;
  branch_type: 'master' | 'branch' | 'sub_branch';
  is_master: boolean;
  parent_branch_id?: string | null;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  referralCode?: string;
  is_unlimited_credit?: boolean;
  credit_balance?: number;
  branch_id?: string | null;
  branch?: BranchInfo | null;
  // Permission fields
  visible_menus?: string[];
  hidden_menus?: string[];
  can_create_sub_agent?: boolean;
  can_view_reports?: boolean;
  can_key_lottery?: boolean;
  can_approve_transactions?: boolean;
  can_manage_members?: boolean;
  can_manage_finances?: boolean;
  // Agent hierarchy
  parent_agent_id?: string | null;
  agent_level?: number;
}

const SESSION_KEY = 'lottery_session';

function getStoredSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

function setStoredSession(user: SessionUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function useAuth() {
  const router = useRouter();
  // IMPORTANT: Start with consistent values on both server and client
  // to avoid hydration mismatch. Load from localStorage in useEffect.
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasInitialized = useRef(false);

  // Load session from localStorage after mount (client-side only)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const stored = getStoredSession();
    setUser(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    const responseData = await res.json();
    
    if (!res.ok) {
      throw new Error(responseData.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
    
    // Store in localStorage and state
    setStoredSession(responseData.user);
    setUser(responseData.user);
    
    return responseData.user;
  }, []);

  const logout = useCallback(() => {
    setStoredSession(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  // Refresh user data from API (for real-time credit balance update)
  const mutate = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/users/${user.id}`);
      if (res.ok) {
        const userData = await res.json();
        const updatedUser: SessionUser = {
          ...user,
          credit_balance: userData.credit_balance,
          is_unlimited_credit: userData.is_unlimited_credit,
        };
        setStoredSession(updatedUser);
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  }, [user]);

  const canAccess = useCallback((action: 'view' | 'create' | 'edit' | 'delete' | 'settings' | 'users' | 'clear' | 'admin' | 'audit_logs' | 'super_admin' | 'withdraw' | 'topup') => {
    if (!user) return false;
    
    // Super Admin can do everything
    if (user.role === 'super_admin') return true;
    
    // Admin can do everything except super_admin specific things
    if (user.role === 'admin') return true;
    
    // Agent permissions
    if (user.role === 'agent') {
      return ['view', 'create', 'edit', 'delete'].includes(action);
    }
    
    // Staff permissions
    if (user.role === 'staff') {
      return ['view', 'create', 'edit'].includes(action);
    }
    
    return false;
  }, [user]);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const isAgent = user?.role === 'agent' || user?.role === 'agent_key' || user?.role === 'partner';
  
  // Branch context helpers
  const isMasterBranch = user?.branch?.is_master === true || user?.branch?.branch_type === 'master';
  const hasBranch = !!user?.branch_id;
  const branchId = user?.branch_id || null;
  const branch = user?.branch || null;
  
  // Check if user can access data from a specific branch
  const canAccessBranch = useCallback((targetBranchId: string) => {
    if (!user) return false;
    
    // Super admin can access all branches
    if (user.role === 'super_admin') return true;
    
    // Master branch admin can access all child branches
    if (isMasterBranch && user.role === 'admin') return true;
    
    // User can only access their own branch
    return user.branch_id === targetBranchId;
  }, [user, isMasterBranch]);

  // Check if user can see a specific menu by menu ID or href
  const canSeeMenu = useCallback((menuIdOrHref: string) => {
    if (!user) return false;
    
    // Super Admin and Admin can see everything (except restricted by branch)
    if (user.role === 'super_admin') return true;
    if (user.role === 'admin') return true;
    
    // If no visible_menus defined, use role-based defaults
    if (!user.visible_menus || user.visible_menus.length === 0) {
      // Default: allow basic menus for each role
      return true;
    }
    
    // Check if menu is hidden
    if (user.hidden_menus?.includes(menuIdOrHref)) {
      return false;
    }
    
    // Check if menu is in visible_menus list
    return user.visible_menus.includes(menuIdOrHref);
  }, [user]);

  // Get all visible menus for user
  const getVisibleMenus = useCallback(() => {
    if (!user) return [];
    
    // Super Admin and Admin see everything
    if (user.role === 'super_admin' || user.role === 'admin') {
      return [];  // Empty means no restriction
    }
    
    return user.visible_menus || [];
  }, [user]);

  return {
    user,
    isLoading,
    isError: false,
    isAuthenticated: !!user,
    isSuperAdmin,
    isAdmin,
    isAgent,
    isMasterBranch,
    hasBranch,
    branchId,
    branch,
    login,
    logout,
    mutate,
    canAccess,
    canAccessBranch,
    canSeeMenu,
    getVisibleMenus,
  };
}
