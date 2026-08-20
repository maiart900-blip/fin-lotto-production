/**
 * Agent financial reporting helper
 * -----------------------------------------------------------------------------
 * Source of truth ของการคำนวณเงินย้อนหลัง (P&L / settlement / report) คือ
 * "snapshot ที่ freeze ไว้บน entry ตอนรับโพย" ไม่ใช่ค่า live ปัจจุบันของ agents
 *
 * เหตุผล: ถ้า admin แก้ share_percent / commission ของ agent ภายหลัง
 * ยอดเคลียร์ของโพยเก่าต้อง "ไม่เปลี่ยน" (กัน retroactive drift)
 *
 * Live agent settings ใช้เฉพาะตอนสร้าง entry ใหม่ (สร้าง snapshot ใหม่) เท่านั้น
 * — ดู lib/agent-snapshot.ts
 *
 * หมายเหตุ spec: ค่า 0% ถือเป็นค่าที่ถูกต้อง (0 = ไม่ถือสู้) จึงตรวจ null/undefined
 * เท่านั้น ไม่ treat 0 เป็น "ไม่ได้ตั้งค่า"
 */

export interface EntryFinancialLike {
  id: string;
  amount: number | null;
  agent_id: string | null;
  parent_agent_id: string | null;
  agent_share_percent: number | null;
  parent_share_percent: number | null;
}

/**
 * เปอร์เซ็นต์ถือสู้ที่ freeze ไว้บน entry สำหรับ "ผู้ชมรายงาน" (viewerAgentId)
 *
 * - viewer เป็น agent โดยตรงของ entry → ใช้ agent_share_percent (snapshot)
 * - viewer เป็น parent (สายบน) ของ entry → ใช้ parent_share_percent (snapshot)
 * - ไม่มี snapshot / viewer ไม่อยู่ในสายของ entry → null (ให้ caller ตัดสิน fallback)
 */
export function resolveFrozenSharePercent(
  entry: EntryFinancialLike,
  viewerAgentId: string,
): number | null {
  if (entry.agent_id && entry.agent_id === viewerAgentId) {
    return entry.agent_share_percent ?? null;
  }
  if (entry.parent_agent_id && entry.parent_agent_id === viewerAgentId) {
    return entry.parent_share_percent ?? null;
  }
  return null;
}

/**
 * เปอร์เซ็นต์ที่ใช้จริงในการคำนวณย้อนหลัง:
 * snapshot มาก่อนเสมอ; entry เก่าที่ไม่มี snapshot (legacy null) จึง fallback
 * ไปค่า live ที่ caller ส่งมา คืน null เมื่อไม่มีทั้งสอง (share ยังไม่ตั้งค่า) → share = 0
 */
export function effectiveSharePercent(
  entry: EntryFinancialLike,
  viewerAgentId: string,
  liveSharePercentFallback: number | null,
): { percent: number | null; fromSnapshot: boolean } {
  const frozen = resolveFrozenSharePercent(entry, viewerAgentId);
  if (frozen !== null) return { percent: frozen, fromSnapshot: true };
  return { percent: liveSharePercentFallback ?? null, fromSnapshot: false };
}

export interface ProfitShareResult {
  /** ผลรวม stake ของ entries */
  totalAmount: number;
  /** ผลรวม payout (เงินรางวัลที่จ่ายลูกค้า) */
  totalPayout: number;
  /** กำไร/ขาดทุนรวม = totalAmount - totalPayout */
  profit: number;
  /** ส่วนแบ่งของผู้ชม (agent) รวมทุก entry โดยใช้ frozen rate ต่อ entry */
  agentShare: number;
  /** ส่วนที่เหลือ (สายบน/เว็บแม่) = profit - agentShare */
  masterShare: number;
  /** มี entry อย่างน้อย 1 รายการที่คิดจาก snapshot จริง */
  usedSnapshot: boolean;
}

/**
 * คำนวณกำไรและส่วนแบ่งของผู้ชม จากรายการ entries โดยใช้ frozen snapshot rate
 * ต่อ entry (fallback ไป live rate เฉพาะ entry ที่ไม่มี snapshot)
 *
 * payout อ่านต่อ entry จาก payoutByEntryId (entry ที่ไม่มี key = payout 0)
 * การรวมส่วนแบ่งทำแบบ per-entry แล้ว sum เพื่อให้ reconcile ตรงกันทุกหน้ารายงาน
 */
export function computeProfitShare(
  entries: EntryFinancialLike[],
  viewerAgentId: string,
  liveSharePercentFallback: number | null,
  payoutByEntryId: Map<string, number>,
): ProfitShareResult {
  let totalAmount = 0;
  let totalPayout = 0;
  let agentShare = 0;
  let masterShare = 0;
  let usedSnapshot = false;

  for (const entry of entries) {
    const amount = Number(entry.amount) || 0;
    const payout = payoutByEntryId.get(entry.id) || 0;
    const entryProfit = amount - payout;

    totalAmount += amount;
    totalPayout += payout;

    const { percent, fromSnapshot } = effectiveSharePercent(
      entry,
      viewerAgentId,
      liveSharePercentFallback,
    );
    if (fromSnapshot) usedSnapshot = true;

    if (percent !== null) {
      const entryAgentShare = Math.round(entryProfit * (percent / 100));
      agentShare += entryAgentShare;
      masterShare += entryProfit - entryAgentShare;
    }
    // percent === null → share ยังไม่ตั้งค่า: agentShare/masterShare += 0
  }

  return {
    totalAmount,
    totalPayout,
    profit: totalAmount - totalPayout,
    agentShare,
    masterShare,
    usedSnapshot,
  };
}

/**
 * ดึง payout ต่อ entry จากตาราง winning_entries → Map(entry_id -> payout รวม)
 */
export function buildPayoutMap(
  winners: Array<{ entry_id: string; payout: number | null }> | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of winners || []) {
    map.set(w.entry_id, (map.get(w.entry_id) || 0) + (Number(w.payout) || 0));
  }
  return map;
}
