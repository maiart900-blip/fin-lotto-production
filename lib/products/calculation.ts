// Shared product calculation layer
// -----------------------------------------------------------------------------
// ชั้น abstraction กลางสำหรับ "ธุรกรรมของสินค้า" (ProductTransaction),
// "การคำนวณคอมมิชชั่น/ถือสู้" (ProductCommission) และ "การเคลียร์ยอด" (ProductSettlement)
// ทุก product (หวย/คาสิโน/กีฬา/เกม) ใช้โครงเดียวกัน ต่างกันแค่ที่มาของ "ยอดเดิมพัน"
// และ "ผลได้เสีย" เท่านั้น
//
// สำหรับ lottery เรา reuse ตรรกะเดิมใน lib/agent-snapshot.ts ทั้งหมด
// (ไม่เขียนซ้ำ) จึงมั่นใจว่าระบบหวยยังทำงานเหมือนเดิม 100%

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AgentChain,
  type AgentSnapshotFields,
  buildAgentSnapshotFields,
  resolveCustomerAgentChain,
} from '@/lib/agent-snapshot';
import { type ProductType, normalizeProductType } from './types';

/** ธุรกรรมของสินค้าแบบ product-agnostic */
export interface ProductTransaction {
  productType: ProductType;
  customerId: string | null;
  /** ยอดเดิมพัน/ยอดเล่น (stake) */
  amount: number;
  /** ยอดจ่ายคืน/ผลได้เสีย (payout) ถ้ามี */
  payoutAmount?: number;
}

/** ผลการคำนวณคอมมิชชั่น/ถือสู้ของธุรกรรม 1 รายการ */
export interface ProductCommissionResult {
  productType: ProductType;
  /** snapshot สายงานเอเย่นต์ (รูปแบบเดียวกับ entries ของหวย) */
  snapshot: AgentSnapshotFields | null;
  /** กำไร/ขาดทุนของธุรกรรม (stake - payout) */
  grossProfit: number;
}

/**
 * คำนวณคอมมิชชั่น/ถือสู้ของธุรกรรม 1 รายการ (product ใดก็ได้)
 * โดย reuse สูตรเดียวกับหวย ผ่าน buildAgentSnapshotFields
 */
export function computeProductCommission(
  tx: ProductTransaction,
  chain: AgentChain | null,
): ProductCommissionResult {
  const productType = normalizeProductType(tx.productType);
  const grossProfit = tx.amount - (tx.payoutAmount ?? 0);

  return {
    productType,
    snapshot: chain ? buildAgentSnapshotFields(chain, tx.amount) : null,
    grossProfit,
  };
}

/**
 * resolve สายงาน + คำนวณ ในขั้นตอนเดียว (สะดวกสำหรับธุรกรรมเดี่ยว)
 * ธุรกรรมแบบ batch ควร resolve เองแล้ว cache เพื่อเลี่ยง N+1
 */
export async function resolveAndComputeCommission(
  supabase: SupabaseClient,
  tx: ProductTransaction,
): Promise<ProductCommissionResult> {
  const chain = await resolveCustomerAgentChain(supabase, tx.customerId);
  return computeProductCommission(tx, chain);
}

/** ยอดสรุปต่อ product 1 ตัว (ใช้ในหน้า Agent Summary) */
export interface ProductSettlementSummary {
  productType: ProductType;
  totalBets: number;
  totalPayout: number;
  grossProfit: number;
  agentShare: number;
  agentCommission: number;
  entryCount: number;
}

/** ผลรวม snapshot ของหลายธุรกรรมให้เป็นยอดสรุปต่อ product */
export function summarizeProductSettlement(
  productType: ProductType,
  rows: Array<{
    amount?: number | null;
    payout_amount?: number | null;
    agent_share_amount?: number | null;
    agent_commission?: number | null;
  }>,
): ProductSettlementSummary {
  const totalBets = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalPayout = rows.reduce((s, r) => s + Number(r.payout_amount ?? 0), 0);
  const agentShare = rows.reduce((s, r) => s + Number(r.agent_share_amount ?? 0), 0);
  const agentCommission = rows.reduce((s, r) => s + Number(r.agent_commission ?? 0), 0);

  return {
    productType: normalizeProductType(productType),
    totalBets,
    totalPayout,
    grossProfit: totalBets - totalPayout,
    agentShare,
    agentCommission,
    entryCount: rows.length,
  };
}
