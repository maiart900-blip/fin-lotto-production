'use client';

import { createContext, useContext, ReactNode } from 'react';
import { usePermissions, UsePermissionsReturn } from '@/hooks/use-permissions';

const PermissionContext = createContext<UsePermissionsReturn | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const permissions = usePermissions();
  
  return (
    <PermissionContext.Provider value={permissions}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext(): UsePermissionsReturn {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }
  return context;
}

/**
 * Component wrapper ที่ซ่อน children ถ้าไม่มี permission
 */
export function RequirePermission({
  menuId,
  featureId,
  children,
  fallback = null,
}: {
  menuId?: string;
  featureId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { canSeeMenu, hasFeature, isLoading } = usePermissions();
  
  if (isLoading) return null;
  
  if (menuId && !canSeeMenu(menuId)) {
    return <>{fallback}</>;
  }
  
  if (featureId && !hasFeature(featureId)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Component wrapper สำหรับ route protection
 */
export function RequireRouteAccess({
  route,
  children,
  fallback,
}: {
  route: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { canAccessRoute, isLoading } = usePermissions();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!canAccessRoute(route)) {
    if (fallback) return <>{fallback}</>;
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
