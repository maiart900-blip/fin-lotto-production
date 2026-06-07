import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { 
  checkRateLimitByIP, 
  createRateLimitResponse, 
  logRateLimitViolation,
  addRateLimitHeaders,
  type RateLimitResult 
} from '@/lib/rate-limit';
import { auditLogger } from '@/lib/audit-logger';
import {
  getUserTypeFromRole,
  getSourceTableFromRole,
  type UserType,
  type SourceTable,
  type DetailedRole,
} from '@/lib/identity';
import { is2FARequiredForRole, check2FAStatus } from '@/lib/2fa-guard';

/**
 * Set authentication cookies for server-side auth verification
 * These cookies are read by api-auth.ts to authenticate API requests
 */
async function setAuthCookies(
  userId: string, 
  role: string, 
  userType: UserType,
  sourceTable: SourceTable
) {
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };
  
  // Set unified session cookie with all identity info
  const sessionData = {
    id: userId,
    role,
    user_type: userType,
    source_table: sourceTable,
  };
  cookieStore.set('lottery_session', JSON.stringify(sessionData), cookieOptions);
  
  // Set role-specific cookies for backward compatibility
  // Agent-related roles (agent, sub_agent, master_agent) should use admin cookies
  const agentTypes = ['admin', 'super_admin', 'agent', 'member'];
  const agentRoles = ['agent', 'agent_key', 'sub_agent', 'master_agent', 'partner'];
  const shouldUseAdminCookies = agentTypes.includes(userType) || agentRoles.includes(role);
  
  if (shouldUseAdminCookies) {
    cookieStore.set('admin_id', userId, cookieOptions);
    cookieStore.set('admin_role', role, cookieOptions);
  } else {
    cookieStore.set('customer_id', userId, cookieOptions);
  }
}

export async function POST(request: Request) {
  // Rate limit check - strict limit for login attempts
  let rateLimitResult: RateLimitResult;
  try {
    rateLimitResult = await checkRateLimitByIP('login');
    
    if (!rateLimitResult.success) {
      // Log rate limit violation
      await logRateLimitViolation('login', 'login', rateLimitResult);
      
      // Log to audit
      await auditLogger.logAuth('unknown', 'login_failed', undefined, {
        reason: 'rate_limited',
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      });
      
      return createRateLimitResponse(rateLimitResult, 'login');
    }
  } catch (error) {
    // If rate limit check fails, continue with login (fail open)
    console.error('Rate limit check failed:', error);
    rateLimitResult = { success: true, limit: 5, remaining: 5, reset: Date.now() / 1000 + 60 };
  }
  
  try {
    const { username, password } = await request.json();
    
    const supabase = await createClient();
    
    // 1. ตรวจสอบจากตาราง users (Admin/Agent) ก่อน
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    
    if (user) {
      if (user.is_active === false) {
        return NextResponse.json(
          { error: 'บัญชีนี้ถูกระงับการใช้งาน' },
          { status: 401 }
        );
      }
      
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
          { status: 401 }
        );
      }
      
      // Check if 2FA is required for this role
      const requires2FA = is2FARequiredForRole(user.role);
      if (requires2FA) {
        const twoFAStatus = await check2FAStatus(user.id, user.role, false);
        
        if (twoFAStatus.needsSetup) {
          // User needs to setup 2FA first - create partial session
          const cookieStore = await cookies();
          cookieStore.set('pending_2fa_setup', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 30, // 30 minutes
            path: '/',
          });
          
          return NextResponse.json({
            success: false,
            requires2FASetup: true,
            message: 'กรุณาตั้งค่า 2FA ก่อนเข้าสู่ระบบ',
            redirectTo: '/auth/2fa-setup',
          });
        }
        
        if (twoFAStatus.needsVerify) {
          // User has 2FA enabled, needs to verify
          const cookieStore = await cookies();
          cookieStore.set('pending_2fa_user', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 10, // 10 minutes
            path: '/',
          });
          
          return NextResponse.json({
            success: false,
            requires2FA: true,
            message: 'กรุณายืนยัน 2FA',
            redirectTo: '/auth/2fa-verify',
          });
        }
      }
      
      let branchInfo = null;
      if (user.branch_id) {
        const { data: branch } = await supabase
          .from('branches')
          .select('id, code, name, branch_type, is_master, parent_branch_id')
          .eq('id', user.branch_id)
          .single();
        branchInfo = branch;
      }
      
      // Get menu permissions for user
      let permissionData = null;
      const { data: permission } = await supabase
        .from('menu_permissions')
        .select('*')
        .eq('target_id', user.id)
        .eq('target_type', 'user')
        .maybeSingle();
      
      if (permission) {
        permissionData = permission;
      }
      
      // Set auth cookies for server-side verification
      // Use user_type from database if available, otherwise derive from role
      const userType = user.user_type || getUserTypeFromRole(user.role);
      const sourceTable = getSourceTableFromRole(user.role);
      await setAuthCookies(user.id, user.role, userType, sourceTable);
      
      // Check if this is a Manual Key Agent
      const isManualKeyAgent = user.user_type === 'manual_key_agent';
      const agentTier = user.agent_tier || null;
      
      // Log successful login
      await auditLogger.logAuth(user.id, 'login', undefined, {
        username: user.username,
        role: user.role,
        user_type: userType,
        agent_tier: agentTier,
      });
      
      // Build response with rate limit headers
      const response = NextResponse.json({
        success: true,
        userType: userType, // Use standardized user_type
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
          user_type: userType,
          agent_tier: agentTier,
          source_table: sourceTable,
          referralCode: user.referral_code,
          is_unlimited_credit: user.is_unlimited_credit || false,
          credit_balance: user.credit_balance || 0,
          branch_id: user.branch_id || null,
          branch: branchInfo,
          // Agent-specific fields
          enable_manual_key: isManualKeyAgent ? true : (user.enable_manual_key ?? false),
          enable_auto: user.enable_auto ?? false,
          system_type: isManualKeyAgent ? 'manual_key' : (user.system_type || 'auto'),
          // Permission fields
          visible_menus: permissionData?.visible_menus || user.visible_menus || [],
          hidden_menus: permissionData?.hidden_menus || [],
          can_create_sub_agent: permissionData?.can_create_sub_agent || false,
          can_view_reports: permissionData?.can_view_reports ?? true,
          can_key_lottery: permissionData?.can_key_lottery ?? true,
          can_approve_transactions: permissionData?.can_approve_transactions || false,
          can_manage_members: permissionData?.can_manage_members || false,
          can_manage_finances: permissionData?.can_manage_finances || false,
        },
        redirectTo: isManualKeyAgent ? '/agent-dashboard' : (user.role === 'agent' ? '/agent-dashboard' : '/')
      });
      
      return addRateLimitHeaders(response, rateLimitResult);
    }
    
    // 2. ตรวจสอบจากตาราง agents (Agent Key / Agent Auto)
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('code', username)
      .maybeSingle();
    
    if (agent) {
      if (agent.status !== 'active') {
        return NextResponse.json(
          { error: 'บัญชีนี้ถูกระงับการใช้งาน' },
          { status: 401 }
        );
      }
      
      if (!agent.password) {
        return NextResponse.json(
          { error: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน' },
          { status: 401 }
        );
      }
      
      const isValid = await bcrypt.compare(password, agent.password);
      if (!isValid) {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
          { status: 401 }
        );
      }
      
      // Update last activity
      await supabase
        .from('agents')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', agent.id);
      
      // Fetch tenant info for mode and features
      let tenantMode = 'hybrid';
      let tenantFeatures: string[] = [];
      if (agent.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('mode, feature_flags')
          .eq('id', agent.tenant_id)
          .single();
        if (tenant) {
          tenantMode = tenant.mode || 'hybrid';
          tenantFeatures = tenant.feature_flags || [];
        }
      }
      
      // Fetch agent permissions from agent_permissions table
      const { data: agentPerms } = await supabase
        .from('agent_permissions')
        .select('menu_key, can_view, can_create, can_edit, can_delete, can_approve, can_payout')
        .eq('agent_id', agent.id);
      
      // Build visible menus from agent_permissions
      let visibleMenus: string[] = [];
      const permissionsMap: Record<string, any> = {};
      
      if (agentPerms && agentPerms.length > 0) {
        agentPerms.forEach((p: any) => {
          if (p.can_view) {
            visibleMenus.push(p.menu_key);
          }
          permissionsMap[p.menu_key] = {
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
            can_approve: p.can_approve,
            can_payout: p.can_payout,
          };
        });
      } else {
        // Fallback to agent.visible_menus if no permissions set
        try {
          visibleMenus = typeof agent.visible_menus === 'string' 
            ? JSON.parse(agent.visible_menus) 
            : agent.visible_menus || [];
        } catch {
          visibleMenus = [];
        }
        
        // Generate default menus based on system_type
        if (visibleMenus.length === 0) {
          visibleMenus = ['dashboard', 'results', 'risk-control', 'reports'];
          
          if (agent.enable_auto || agent.system_type === 'auto' || agent.system_type === 'both') {
            visibleMenus.push('auto-system', 'auto-entries', 'auto-customers');
          }
          if (agent.enable_manual_key || agent.system_type === 'manual_key' || agent.system_type === 'both') {
            visibleMenus.push('manual-key', 'manual-entries', 'manual-customers');
          }
        }
      }
      
      // Determine redirect based on role and system_type
      let redirectTo = '/manual-key'; // Default for Agent Key
      
      // Sub-agent and Master agent go to their specific portal
      if (agent.role === 'sub_agent') {
        redirectTo = '/sub-agent'; // Sub-Agent Portal
      } else if (agent.role === 'master_agent') {
        redirectTo = '/master-agent'; // Master Agent Portal
      } else if (agent.system_type === 'auto') {
        redirectTo = '/auto-system';
      } else if (agent.system_type === 'both' || agent.system_type === 'hybrid') {
        redirectTo = '/';
      }
      
      // Set auth cookies for server-side verification (agents use 'agent' user_type)
      const agentRole = (agent.role || 'agent') as DetailedRole;
      await setAuthCookies(agent.id, agentRole, 'agent', 'agents');
      
      return NextResponse.json({
        success: true,
        userType: 'agent', // Standardized user_type
        user: {
          id: agent.id,
          username: agent.code,
          displayName: agent.name,
          role: agentRole,
          user_type: 'agent' as UserType,
          source_table: 'agents' as SourceTable,
          // Tenant context
          tenant_id: agent.tenant_id || null,
          tenant_mode: tenantMode,
          feature_flags: tenantFeatures,
          // Agent data
          credit_balance: agent.credit_balance || 0,
          credit_limit: agent.credit_limit || 0,
          commission_rate: agent.commission_rate || 0,
          share_percent: agent.share_percent || 0,
          system_type: agent.system_type,
          enable_manual_key: agent.enable_manual_key ?? true,
          enable_auto: agent.enable_auto ?? false,
          level: agent.level || 1,
          parent_id: agent.parent_id,
          parent_agent_id: agent.parent_agent_id,
          owner_id: agent.owner_id,
          // Permission fields from agent_permissions
          visible_menus: visibleMenus,
          permissions: permissionsMap,
          hidden_menus: [],
          can_create_sub_agent: agent.can_create_sub_agent || false,
          can_view_reports: agent.can_view_reports ?? true,
          can_key_lottery: agent.enable_manual_key ?? true,
          can_approve_transactions: permissionsMap['financial']?.can_approve || false,
          can_manage_members: permissionsMap['member-visibility']?.can_view || true,
          can_manage_finances: permissionsMap['financial']?.can_view || false,
        },
        redirectTo
      });
    }
    
    // 3. ถ้าไม่เจอใน users และ agents ให้ตรวจสอบจาก customers
    // ค้นหาจาก phone ก่อน
    let customer = null;
    
    const { data: byPhone } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', username)
      .maybeSingle();
    
    if (byPhone) {
      customer = byPhone;
    } else {
      // ถ้าไม่เจอ ลองค้นหาจาก username
      const { data: byUsername } = await supabase
        .from('customers')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      customer = byUsername;
    }
    
    if (customer) {
      if (customer.is_active === false) {
        return NextResponse.json(
          { error: 'บัญชีนี้ถูกระงับการใช้งาน' },
          { status: 401 }
        );
      }
      
      if (!customer.password_hash) {
        return NextResponse.json(
          { error: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน' },
          { status: 401 }
        );
      }
      
      const isValid = await bcrypt.compare(password, customer.password_hash);
      if (!isValid) {
        // Log failed login attempt
        await auditLogger.logAuth(user.id, 'login_failed', undefined, {
          reason: 'invalid_password',
          username,
        });
        
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
          { status: 401 }
        );
      }
      
      // Update last login
      await supabase
        .from('customers')
        .update({ last_login: new Date().toISOString() })
        .eq('id', customer.id);
      
      // ตรวจสอบว่าเป็น Agent หรือ Member (พนักงาน)
      // agent_level: 'agent' = เอเย่น, 'member' = แมมเบอร์/พนักงาน, null = ลูกค้าทั่วไป
      const isAgent = customer.agent_level === 'agent';
      const isMember = customer.agent_level === 'member'; // แมมเบอร์ = พนักงาน
      
      // Determine user_type and role
      let customerUserType: UserType = 'customer';
      let customerRole: DetailedRole = 'customer';
      let sourceTable: SourceTable = 'customers';
      
      if (isAgent) {
        customerUserType = 'agent';
        customerRole = 'agent';
      } else if (isMember) {
        customerUserType = 'member';
        customerRole = 'member';
      }
      
      // Get menu permissions for agent/member
      let permissionData = null;
      const targetType = isAgent ? 'agent' : (isMember ? 'member' : 'customer');
      const { data: permission } = await supabase
        .from('menu_permissions')
        .select('*')
        .eq('target_id', customer.id)
        .eq('target_type', targetType)
        .maybeSingle();
      
      if (permission) {
        permissionData = permission;
      }
      
      // กำหนด redirect: Agent ไป agent-dashboard, Member (พนักงาน) ไปหน้า Admin
      let redirectTo = '/c'; // ลูกค้าทั่วไปไปหน้าลูกค้า
      if (isAgent) {
        redirectTo = '/agent-dashboard';
      } else if (isMember) {
        redirectTo = '/'; // พนักงานไปหน้า Admin
      }
      
      // Set auth cookies for server-side verification
      await setAuthCookies(customer.id, customerRole, customerUserType, sourceTable);
      
      return NextResponse.json({
        success: true,
        userType: customerUserType, // Standardized: 'customer' | 'member' | 'agent'
        user: {
          id: customer.id,
          username: customer.username || customer.phone,
          displayName: customer.name,
          phone: customer.phone,
          role: customerRole,
          user_type: customerUserType,
          source_table: sourceTable,
          credit_balance: customer.credit_balance || 0,
          commission_rate: customer.commission_rate || 0,
          upline_id: customer.upline_id,
          // Permission fields
          visible_menus: permissionData?.visible_menus || customer.visible_menus || [],
          hidden_menus: permissionData?.hidden_menus || [],
          can_create_sub_agent: permissionData?.can_create_sub_agent || customer.can_create_sub_agent || false,
          can_view_reports: permissionData?.can_view_reports ?? customer.can_view_reports ?? true,
          can_key_lottery: permissionData?.can_key_lottery ?? customer.can_key_lottery ?? true,
          can_approve_transactions: permissionData?.can_approve_transactions || false,
          can_manage_members: permissionData?.can_manage_members || false,
          can_manage_finances: permissionData?.can_manage_finances || false,
          // Agent hierarchy
          parent_agent_id: customer.parent_agent_id || customer.upline_id || null,
          agent_level: customer.level || 1,
        },
        redirectTo
      });
    }
    
    // ไม่เจอทั้ง users และ customers
    return NextResponse.json(
      { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
      { status: 401 }
    );
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
      { status: 500 }
    );
  }
}
