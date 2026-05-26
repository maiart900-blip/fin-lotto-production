/**
 * Enterprise RBAC (Role-Based Access Control) System
 * Provides granular permission management with role hierarchy
 */

import { createClient } from '@/lib/supabase/server';

export type UserType = 'admin' | 'staff' | 'customer' | 'agent';

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  requires_2fa: boolean;
  is_sensitive: boolean;
}

export interface Role {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  description: string;
  level: number;
  is_system: boolean;
  permissions: string[];
}

export interface UserPermissionContext {
  user_id: string;
  user_type: UserType;
  tenant_id?: string;
  roles: Role[];
  permissions: string[];
  denied_permissions: string[];
  is_2fa_verified: boolean;
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(
  userId: string,
  userType: UserType,
  permissionCode: string,
  tenantId?: string
): Promise<{ allowed: boolean; requires_2fa: boolean; reason?: string }> {
  const supabase = await createClient();
  
  // Get user's effective permissions
  const context = await getUserPermissionContext(userId, userType, tenantId);
  
  // Check if permission is explicitly denied
  if (context.denied_permissions.includes(permissionCode)) {
    return { allowed: false, requires_2fa: false, reason: 'Permission explicitly denied' };
  }
  
  // Check wildcard permissions
  if (context.permissions.includes('*')) {
    return { allowed: true, requires_2fa: false };
  }
  
  // Check category wildcard (e.g., "finance.*")
  const category = permissionCode.split('.')[0];
  if (context.permissions.includes(`${category}.*`)) {
    // Check if this specific permission requires 2FA
    const { data: perm } = await supabase
      .from('permissions')
      .select('requires_2fa')
      .eq('code', permissionCode)
      .single();
    
    return { 
      allowed: true, 
      requires_2fa: perm?.requires_2fa && !context.is_2fa_verified 
    };
  }
  
  // Check exact permission
  if (context.permissions.includes(permissionCode)) {
    const { data: perm } = await supabase
      .from('permissions')
      .select('requires_2fa')
      .eq('code', permissionCode)
      .single();
    
    return { 
      allowed: true, 
      requires_2fa: perm?.requires_2fa && !context.is_2fa_verified 
    };
  }
  
  return { allowed: false, requires_2fa: false, reason: 'Permission not granted' };
}

/**
 * Get user's complete permission context
 */
export async function getUserPermissionContext(
  userId: string,
  userType: UserType,
  tenantId?: string
): Promise<UserPermissionContext> {
  const supabase = await createClient();
  
  // Get user's roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      expires_at,
      roles (
        id,
        code,
        name,
        description,
        level,
        is_system,
        permissions
      )
    `)
    .eq('user_id', userId)
    .eq('user_type', userType)
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .or('expires_at.is.null,expires_at.gt.now()');
  
  const roles: Role[] = (userRoles || [])
    .filter(ur => ur.roles)
    .map(ur => ({
      ...(ur.roles as unknown as Role),
      permissions: JSON.parse(JSON.stringify((ur.roles as any).permissions || []))
    }));
  
  // Collect all permissions from roles
  const rolePermissions = new Set<string>();
  roles.forEach(role => {
    (role.permissions || []).forEach((p: string) => rolePermissions.add(p));
  });
  
  // Get direct user permissions (grants)
  const { data: directGrants } = await supabase
    .from('user_permissions')
    .select(`
      permission_id,
      is_granted,
      expires_at,
      permissions (code)
    `)
    .eq('user_id', userId)
    .eq('user_type', userType)
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .or('expires_at.is.null,expires_at.gt.now()');
  
  const grantedPermissions = new Set<string>();
  const deniedPermissions = new Set<string>();
  
  (directGrants || []).forEach(grant => {
    const code = (grant.permissions as any)?.code;
    if (code) {
      if (grant.is_granted) {
        grantedPermissions.add(code);
      } else {
        deniedPermissions.add(code);
      }
    }
  });
  
  // Merge role permissions with direct grants
  const allPermissions = new Set([...rolePermissions, ...grantedPermissions]);
  
  // Check 2FA status
  const { data: session } = await supabase
    .from('active_sessions')
    .select('is_2fa_verified')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  return {
    user_id: userId,
    user_type: userType,
    tenant_id: tenantId,
    roles,
    permissions: Array.from(allPermissions),
    denied_permissions: Array.from(deniedPermissions),
    is_2fa_verified: session?.is_2fa_verified || false
  };
}

/**
 * Assign role to user
 */
export async function assignRole(
  userId: string,
  userType: UserType,
  roleCode: string,
  assignedBy: string,
  tenantId?: string,
  expiresAt?: Date
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Find role
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, level')
    .eq('code', roleCode)
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .single();
  
  if (roleError || !role) {
    return { success: false, error: 'Role not found' };
  }
  
  // Insert user role
  const { error } = await supabase
    .from('user_roles')
    .upsert({
      user_id: userId,
      user_type: userType,
      role_id: role.id,
      tenant_id: tenantId,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString(),
      expires_at: expiresAt?.toISOString()
    }, {
      onConflict: 'user_id,user_type,role_id,tenant_id'
    });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Log the action
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: assignedBy,
    actor_type: 'admin',
    action: 'role_assigned',
    resource_type: 'user_role',
    resource_id: userId,
    details: { role_code: roleCode, user_type: userType }
  });
  
  return { success: true };
}

/**
 * Revoke role from user
 */
export async function revokeRole(
  userId: string,
  userType: UserType,
  roleCode: string,
  revokedBy: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Find role
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('code', roleCode)
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .single();
  
  if (!role) {
    return { success: false, error: 'Role not found' };
  }
  
  // Delete user role
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('user_type', userType)
    .eq('role_id', role.id);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Log the action
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: revokedBy,
    actor_type: 'admin',
    action: 'role_revoked',
    resource_type: 'user_role',
    resource_id: userId,
    details: { role_code: roleCode, user_type: userType }
  });
  
  return { success: true };
}

/**
 * Grant direct permission to user
 */
export async function grantPermission(
  userId: string,
  userType: UserType,
  permissionCode: string,
  grantedBy: string,
  reason?: string,
  tenantId?: string,
  expiresAt?: Date
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Find permission
  const { data: permission } = await supabase
    .from('permissions')
    .select('id')
    .eq('code', permissionCode)
    .single();
  
  if (!permission) {
    return { success: false, error: 'Permission not found' };
  }
  
  // Insert user permission
  const { error } = await supabase
    .from('user_permissions')
    .upsert({
      user_id: userId,
      user_type: userType,
      permission_id: permission.id,
      tenant_id: tenantId,
      is_granted: true,
      granted_by: grantedBy,
      reason,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt?.toISOString()
    }, {
      onConflict: 'user_id,user_type,permission_id,tenant_id'
    });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Deny permission from user (override role permissions)
 */
export async function denyPermission(
  userId: string,
  userType: UserType,
  permissionCode: string,
  deniedBy: string,
  reason: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Find permission
  const { data: permission } = await supabase
    .from('permissions')
    .select('id')
    .eq('code', permissionCode)
    .single();
  
  if (!permission) {
    return { success: false, error: 'Permission not found' };
  }
  
  // Insert denial
  const { error } = await supabase
    .from('user_permissions')
    .upsert({
      user_id: userId,
      user_type: userType,
      permission_id: permission.id,
      tenant_id: tenantId,
      is_granted: false,
      granted_by: deniedBy,
      reason,
      granted_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,user_type,permission_id,tenant_id'
    });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Get all available permissions grouped by category
 */
export async function getAllPermissions(): Promise<Record<string, Permission[]>> {
  const supabase = await createClient();
  
  const { data: permissions } = await supabase
    .from('permissions')
    .select('*')
    .order('category', { ascending: true })
    .order('code', { ascending: true });
  
  const grouped: Record<string, Permission[]> = {};
  (permissions || []).forEach(p => {
    if (!grouped[p.category]) {
      grouped[p.category] = [];
    }
    grouped[p.category].push(p);
  });
  
  return grouped;
}

/**
 * Get all roles (system + tenant-specific)
 */
export async function getAllRoles(tenantId?: string): Promise<Role[]> {
  const supabase = await createClient();
  
  const query = supabase
    .from('roles')
    .select('*')
    .order('level', { ascending: false });
  
  if (tenantId) {
    query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  } else {
    query.is('tenant_id', null);
  }
  
  const { data } = await query;
  
  return (data || []).map(r => ({
    ...r,
    permissions: r.permissions || []
  }));
}

/**
 * Create custom role for tenant
 */
export async function createCustomRole(
  tenantId: string,
  code: string,
  name: string,
  description: string,
  permissions: string[],
  level: number,
  createdBy: string
): Promise<{ success: boolean; role?: Role; error?: string }> {
  const supabase = await createClient();
  
  const { data: role, error } = await supabase
    .from('roles')
    .insert({
      tenant_id: tenantId,
      code,
      name,
      description,
      permissions,
      level,
      is_system: false
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Log the action
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: createdBy,
    actor_type: 'admin',
    action: 'role_created',
    resource_type: 'role',
    resource_id: role.id,
    details: { code, name, permissions }
  });
  
  return { success: true, role };
}
