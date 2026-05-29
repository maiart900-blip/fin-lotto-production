/**
 * Tenant Data Isolation Middleware
 * 
 * TASK 2: SYSTEM DATA ISOLATION
 * 
 * Ensures that customer data, wallets, and member lists are strictly 
 * separated by Tenant ID. Each sub-web sees only their own customers.
 * 
 * Usage in API routes:
 * 
 * ```ts
 * import { withTenantIsolation } from '@/lib/tenant-isolation';
 * 
 * export async function GET(request: NextRequest) {
 *   const isolation = await withTenantIsolation(request);
 *   if (isolation.error) return isolation.error;
 *   
 *   // Use isolation.tenantId to scope queries
 *   const { data } = await supabase
 *     .from('customers')
 *     .select('*')
 *     .eq('tenant_id', isolation.tenantId);
 * }
 * ```
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getDataScope, applyTenantScope, applyFullDataScope, DataScope } from '@/lib/data-scope';

export interface TenantIsolationResult {
  success: boolean;
  tenantId: string | null;
  userId: string;
  role: string;
  scope: DataScope;
  isSuperAdmin: boolean;
  error?: NextResponse;
}

/**
 * Get tenant isolation context from request
 * Returns tenant_id to use for data scoping
 */
export async function withTenantIsolation(
  request: NextRequest
): Promise<TenantIsolationResult> {
  try {
    const supabase = await createClient();
    
    // Get session from cookie
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return {
        success: false,
        tenantId: null,
        userId: '',
        role: '',
        scope: {} as DataScope,
        isSuperAdmin: false,
        error: NextResponse.json(
          { error: 'Unauthorized - No session' },
          { status: 401 }
        ),
      };
    }
    
    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', sessionCookie)
      .single();
    
    if (sessionError || !session) {
      return {
        success: false,
        tenantId: null,
        userId: '',
        role: '',
        scope: {} as DataScope,
        isSuperAdmin: false,
        error: NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        ),
      };
    }
    
    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      return {
        success: false,
        tenantId: null,
        userId: '',
        role: '',
        scope: {} as DataScope,
        isSuperAdmin: false,
        error: NextResponse.json(
          { error: 'Session expired' },
          { status: 401 }
        ),
      };
    }
    
    // Get user details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role, tenant_id, user_type, agent_id')
      .eq('id', session.user_id)
      .single();
    
    if (userError || !user) {
      return {
        success: false,
        tenantId: null,
        userId: '',
        role: '',
        scope: {} as DataScope,
        isSuperAdmin: false,
        error: NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        ),
      };
    }
    
    // Get data scope
    const scope = await getDataScope({
      id: user.id,
      role: user.role,
      user_type: user.user_type,
      tenant_id: user.tenant_id,
      agent_id: user.agent_id,
    });
    
    // Super admin can access all data
    const isSuperAdmin = user.role === 'super_admin';
    
    // Non-super-admin must have tenant_id
    if (!isSuperAdmin && !user.tenant_id) {
      return {
        success: false,
        tenantId: null,
        userId: user.id,
        role: user.role,
        scope,
        isSuperAdmin,
        error: NextResponse.json(
          { error: 'No tenant access - Contact administrator' },
          { status: 403 }
        ),
      };
    }
    
    return {
      success: true,
      tenantId: user.tenant_id,
      userId: user.id,
      role: user.role,
      scope,
      isSuperAdmin,
    };
    
  } catch (error) {
    console.error('[TenantIsolation] Error:', error);
    return {
      success: false,
      tenantId: null,
      userId: '',
      role: '',
      scope: {} as DataScope,
      isSuperAdmin: false,
      error: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Apply tenant isolation to a Supabase query
 * Automatically adds tenant_id filter for non-super-admin users
 */
export function applyTenantFilter<T extends { eq: (col: string, val: unknown) => T }>(
  query: T,
  isolation: TenantIsolationResult,
  tenantColumn: string = 'tenant_id'
): T {
  // Super admin sees all
  if (isolation.isSuperAdmin) {
    return query;
  }
  
  // Apply tenant filter
  if (isolation.tenantId) {
    return query.eq(tenantColumn, isolation.tenantId);
  }
  
  // No tenant - block access (return impossible filter)
  return query.eq(tenantColumn, '__NO_ACCESS__');
}

/**
 * Verify a record belongs to the user's tenant
 */
export function verifyTenantAccess(
  record: { tenant_id?: string | null },
  isolation: TenantIsolationResult
): { allowed: boolean; reason: string } {
  // Super admin can access all
  if (isolation.isSuperAdmin) {
    return { allowed: true, reason: 'Super admin access' };
  }
  
  // Check tenant match
  if (!record.tenant_id) {
    return { allowed: false, reason: 'Record has no tenant_id' };
  }
  
  if (record.tenant_id !== isolation.tenantId) {
    return { allowed: false, reason: 'Record belongs to different tenant' };
  }
  
  return { allowed: true, reason: 'Same tenant' };
}

/**
 * Get tenant-scoped data with automatic isolation
 * This is a convenience wrapper for common data fetching patterns
 */
export async function getTenantScopedData<T>(
  table: string,
  isolation: TenantIsolationResult,
  options: {
    select?: string;
    filters?: Record<string, unknown>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: T[] | null; error: Error | null; count: number }> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from(table)
      .select(options.select || '*', { count: 'exact' });
    
    // Apply tenant isolation
    query = applyTenantFilter(query, isolation);
    
    // Apply additional filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }
    
    // Apply ordering
    if (options.orderBy) {
      query = query.order(options.orderBy.column, { 
        ascending: options.orderBy.ascending ?? false 
      });
    }
    
    // Apply pagination
    if (options.limit) {
      const offset = options.offset || 0;
      query = query.range(offset, offset + options.limit - 1);
    }
    
    const { data, error, count } = await query;
    
    return {
      data: data as T[] | null,
      error: error ? new Error(error.message) : null,
      count: count || 0,
    };
    
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
      count: 0,
    };
  }
}

// Re-export data scope utilities for convenience
export { applyTenantScope, applyFullDataScope };
