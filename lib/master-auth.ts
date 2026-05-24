import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'finlotto-master-secret-key';

interface MasterTokenPayload {
  userId: string;
  username: string;
  role: string;
  isMaster: boolean;
  tenantAccess: 'all' | string[];
  permissions: string[];
  exp: number;
}

export async function verifyMasterToken(): Promise<MasterTokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('master_token')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as MasterTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function requireMasterAuth(): Promise<MasterTokenPayload> {
  const payload = await verifyMasterToken();
  
  if (!payload) {
    throw new Error('Master authentication required');
  }
  
  if (!payload.isMaster || payload.role !== 'super_admin') {
    throw new Error('Super Admin access required');
  }
  
  return payload;
}

export function hasPermission(payload: MasterTokenPayload, permission: string): boolean {
  return payload.permissions.includes(permission) || payload.permissions.includes('system_admin');
}

export function canAccessTenant(payload: MasterTokenPayload, tenantId: string): boolean {
  if (payload.tenantAccess === 'all') return true;
  return Array.isArray(payload.tenantAccess) && payload.tenantAccess.includes(tenantId);
}

// Client-side helper to check if user is master admin
export async function isMasterAdmin(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/master-token', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.valid && data.isMaster;
  } catch {
    return false;
  }
}

// Hook for client components
export function useMasterAuth() {
  return {
    verifyToken: async () => {
      const response = await fetch('/api/auth/master-token', {
        method: 'GET',
        credentials: 'include',
      });
      return response.json();
    },
    
    login: async (username: string, password: string) => {
      const response = await fetch('/api/auth/master-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      return response.json();
    },
    
    logout: async () => {
      const response = await fetch('/api/auth/master-token', {
        method: 'DELETE',
        credentials: 'include',
      });
      return response.json();
    },
  };
}
