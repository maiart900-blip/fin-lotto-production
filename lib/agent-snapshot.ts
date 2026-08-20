/**
 * Agent snapshot helper
 * -----------------------------------------------------------------------------
 * เมื่อมีการ "แทงหวย" (สร้าง entry) เราต้อง snapshot สายงานเอเย่นต์ของลูกค้า
 * ลงไปในแต่ละ entry ทันที เพื่อให้การเปลี่ยน % ถือสู้/ค่าคอมในภายหลัง
 * ไม่กระทบยอดเคลียร์ย้อนหลัง
 *
 * แหล่งข้อมูลจริงของสายงานเอเย่นต์คือตาราง `agents`
 * (customers.agent_id -> agents.id, agents.parent_agent_id -> agents.id)
 *
 * หมายเหตุ spec: ค่า 0% ถือเป็นค่าที่ถูกต้อง (เอเย่นต์ที่ตั้ง 0% = ไม่ถือสู้/ไม่มีคอม)
 * จึงใช้ `Number(x) || 0` เพื่อแปลง null/undefined เป็น 0 เท่านั้น
 * ไม่มีการ fallback ไปค่าอื่น (เช่น 5/3) แบบ hardcode
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgentChain {
  agentId: string;
  agentSharePercent: number;
  agentCommissionRate: number;
  parentAgentId: string | null;
  parentSharePercent: number;
  parentCommissionRate: number;
}

export interface AgentSnapshotFields {
  agent_id: string;
  parent_agent_id: string | null;
  agent_share_percent: number;
  parent_share_percent: number;
  agent_share_amount: number;
  parent_share_amount: number;
  agent_commission: number;
  parent_commission: number;
  master_amount: number;
  master_agent_id: string | null;
}

/**
 * Resolve สายงานเอเย่นต์ของลูกค้า 1 ครั้ง (agent + parent) จากตาราง agents.
 * คืน null เมื่อลูกค้าไม่มี agent ผูกไว้ (agent_id = null) — ในกรณีนี้ entry
 * จะไม่มี snapshot สายงาน ซึ่งถูกต้องตามความจริงของข้อมูล
 */
export async function resolveCustomerAgentChain(
  supabase: SupabaseClient,
  customerId: string | null | undefined,
): Promise<AgentChain | null> {
  if (!customerId) return null;

  const { data: customer } = await supabase
    .from('customers')
    .select('agent_id')
    .eq('id', customerId)
    .maybeSingle();

  const agentId = customer?.agent_id ?? null;
  if (!agentId) return null;

  const { data: agent } = await supabase
    .from('agents')
    .select('id, parent_agent_id, share_percent, commission_rate')
    .eq('id', agentId)
    .maybeSingle();

  if (!agent) return null;

  let parentAgentId: string | null = null;
  let parentSharePercent = 0;
  let parentCommissionRate = 0;

  if (agent.parent_agent_id) {
    const { data: parent } = await supabase
      .from('agents')
      .select('id, share_percent, commission_rate')
      .eq('id', agent.parent_agent_id)
      .maybeSingle();
    if (parent) {
      parentAgentId = parent.id;
      parentSharePercent = Number(parent.share_percent) || 0;
      parentCommissionRate = Number(parent.commission_rate) || 0;
    }
  }

  return {
    agentId: agent.id,
    agentSharePercent: Number(agent.share_percent) || 0,
    agentCommissionRate: Number(agent.commission_rate) || 0,
    parentAgentId,
    parentSharePercent,
    parentCommissionRate,
  };
}

/**
 * คำนวณ snapshot fields สำหรับ entry 1 รายการ จากสายงานที่ resolve มาแล้ว
 * (แยก resolve ออกจาก compute เพื่อเลี่ยง N+1 เมื่อแทงหลายรายการพร้อมกัน)
 */
export function buildAgentSnapshotFields(
  chain: AgentChain,
  amount: number,
): AgentSnapshotFields {
  const agentCommission = amount * (chain.agentCommissionRate / 100);
  const parentCommission = amount * (chain.parentCommissionRate / 100);
  const agentShareAmount = amount * (chain.agentSharePercent / 100);
  const parentShareAmount = amount * (chain.parentSharePercent / 100);
  const masterAmount = amount - agentCommission - parentCommission;

  return {
    agent_id: chain.agentId,
    parent_agent_id: chain.parentAgentId,
    agent_share_percent: chain.agentSharePercent,
    parent_share_percent: chain.parentSharePercent,
    agent_share_amount: agentShareAmount,
    parent_share_amount: parentShareAmount,
    agent_commission: agentCommission,
    parent_commission: parentCommission,
    master_amount: masterAmount,
    master_agent_id: chain.parentAgentId,
  };
}
