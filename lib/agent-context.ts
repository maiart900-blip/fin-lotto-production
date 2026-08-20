/**
 * Agent Context Resolver
 *
 * Single source of truth สำหรับ resolve "ตัวตนของเอเย่นต์" จาก server session
 * แทนการรับ agent_id จาก query param/body (ซึ่งเป็นช่องโหว่ IDOR)
 *
 * ใช้ getAuthenticatedUser() เดิมในการ resolve session แล้วดึง context เพิ่ม
 * (tenant_id, parent_agent_id, commission_rate, share_percent) จากตาราง agents
 *
 * Tenant convention:
 * - tenant_id = null  => เว็บแม่ (master)
 * - tenant_id = uuid  => เว็บลูก (tenant)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { isAdminRole, isAgentRole } from '@/lib/identity';
import type { UserRole } from '@/lib/rbac';

export interface AgentContext {
  /** id ของ agent ที่ login (มาจาก session เท่านั้น) */
  agentId: string;
  /** tenant ของ agent — null = เว็บแม่ */
  tenantId: string | null;
  /** parent agent (สายบน) */
  parentAgentId: string | null;
  code: string | null;
  role: UserRole;
  /** ค่าคอมมิชชั่นจริงจาก DB (ไม่มี fallback ปลอม) */
  commissionRate: number | null;
  /** เปอร์เซ็นต์ถือสู้จริงจาก DB (ไม่มี fallback ปลอม) */
  sharePercent: number | null;
  /** true เมื่อ login ด้วย admin/super_admin (ดูข้ามได้) */
  isAdmin: boolean;
}

export type AgentContextResult = { context: AgentContext } | NextResponse;

/**
 * Require an authenticated agent (or admin) and return their resolved context.
 *
 * - 401 ถ้าไม่ได้ login
 * - 403 ถ้า role ไม่ใช่ agent และไม่ใช่ admin
 *
 * สำหรับ admin: อนุญาตให้ระบุ agent เป้าหมายผ่าน `targetAgentId` (เช่นหน้า admin ดูแทน agent)
 * แต่ agent ธรรมดา "ห้าม" ระบุ target — จะถูก scope ไปที่ตัวเองเสมอ
 */
export async function requireAgentContext(
  targetAgentId?: string | null
): Promise<AgentContextResult> {
  const auth = await getAuthenticatedUser();

  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const { user } = auth;
  const admin = isAdminRole(user.role);
  // user_type === 'agent' คือสัญญาณที่เชื่อถือได้จาก getAuthenticatedUser (ครอบคลุม master_agent
  // ที่ isAgentRole ไม่รวม) — เสริมด้วย isAgentRole สำหรับ role ที่ resolve จาก customers table
  const isAgent = user.user_type === 'agent' || isAgentRole(user.role);

  if (!isAgent && !admin) {
    return NextResponse.json(
      { success: false, error: 'Forbidden - agent access required', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  const supabase = await createClient();

  // Admin ที่ระบุ target => ดู context ของ agent เป้าหมาย
  // Agent ธรรมดา => ใช้ id ของตัวเองจาก session เสมอ (ห้าม override)
  const resolvedAgentId = admin && targetAgentId ? targetAgentId : user.id;

  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, code, role, status, tenant_id, parent_agent_id, commission_rate, share_percent')
    .eq('id', resolvedAgentId)
    .single();

  if (error || !agent) {
    // admin ที่ไม่ได้ผูกกับ agents table (ดูภาพรวมเว็บแม่)
    if (admin) {
      return {
        context: {
          agentId: user.id,
          tenantId: null,
          parentAgentId: null,
          code: user.username ?? null,
          role: user.role,
          commissionRate: null,
          sharePercent: null,
          isAdmin: true,
        },
      };
    }
    return NextResponse.json(
      { success: false, error: 'Agent not found', code: 'AGENT_NOT_FOUND' },
      { status: 404 }
    );
  }

  if (!admin && agent.status !== 'active') {
    return NextResponse.json(
      { success: false, error: 'Agent inactive', code: 'AGENT_INACTIVE' },
      { status: 403 }
    );
  }

  return {
    context: {
      agentId: agent.id,
      tenantId: agent.tenant_id ?? null,
      parentAgentId: agent.parent_agent_id ?? null,
      code: agent.code ?? null,
      role: (agent.role || 'agent') as UserRole,
      commissionRate: agent.commission_rate ?? null,
      sharePercent: agent.share_percent ?? null,
      isAdmin: admin,
    },
  };
}

/**
 * Apply tenant scoping to a Supabase query builder using the tenant convention.
 * - tenantId null  => .is('tenant_id', null)   (เว็บแม่)
 * - tenantId uuid  => .eq('tenant_id', uuid)    (เว็บลูก)
 *
 * Admin (isAdmin) จะไม่ถูก scope (ดูข้ามได้) เว้นแต่มี tenantId ระบุ
 */
export function applyTenantScope<T extends { is: any; eq: any }>(
  query: T,
  ctx: Pick<AgentContext, 'tenantId' | 'isAdmin'>,
  column = 'tenant_id'
): T {
  // admin เว็บแม่ (tenantId null) เห็นภาพรวม master
  if (ctx.tenantId === null) {
    return query.is(column, null);
  }
  return query.eq(column, ctx.tenantId);
}
