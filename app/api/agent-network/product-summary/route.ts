import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { summarizeProductSettlement } from '@/lib/products/calculation';
import { PRODUCT_ORDER, PRODUCTS, type ProductType } from '@/lib/products/types';

// GET /api/agent-network/product-summary?start=YYYY-MM-DD&end=YYYY-MM-DD
// สรุปยอดแยกตาม product_type — lottery ดึงจากข้อมูลจริง (ตาราง entries),
// product ที่ยัง coming_soon จะคืนยอด 0 พร้อม status เพื่อให้ UI แสดง placeholder
export async function GET(request: Request) {
  try {
    const auth = await requireRole(['super_admin', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const startDate = searchParams.get('start') || defaultStart;
    const endDate = searchParams.get('end') || now.toISOString().slice(0, 10);

    const supabase = await createClient();

    // ดึง entries ทั้งหมดในช่วงเวลา (เฉพาะที่ไม่ archived) พร้อม snapshot ที่ต้องใช้
    const { data: rows, error } = await supabase
      .from('entries')
      .select('product_type, amount, payout_amount, agent_share_amount, agent_commission, status')
      .neq('status', 'archived')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    // จัดกลุ่ม rows ตาม product_type
    const grouped = new Map<ProductType, typeof rows>();
    for (const r of rows ?? []) {
      const pt = (r.product_type as ProductType) ?? 'lottery';
      if (!grouped.has(pt)) grouped.set(pt, []);
      grouped.get(pt)!.push(r);
    }

    // สร้างผลสรุปครบทุก product ตามลำดับ (product ที่ไม่มีข้อมูล = ยอด 0)
    const products = PRODUCT_ORDER.map((type) => {
      const def = PRODUCTS[type];
      const summary = summarizeProductSettlement(type, grouped.get(type) ?? []);
      return {
        type,
        label: def.label,
        description: def.description,
        status: def.status,
        icon: def.icon,
        ...summary,
      };
    });

    // ยอดรวมทั้งระบบ (เฉพาะ product ที่ active)
    const totals = products
      .filter((p) => p.status === 'active')
      .reduce(
        (acc, p) => ({
          totalBets: acc.totalBets + p.totalBets,
          totalPayout: acc.totalPayout + p.totalPayout,
          grossProfit: acc.grossProfit + p.grossProfit,
          agentShare: acc.agentShare + p.agentShare,
          agentCommission: acc.agentCommission + p.agentCommission,
          entryCount: acc.entryCount + p.entryCount,
        }),
        { totalBets: 0, totalPayout: 0, grossProfit: 0, agentShare: 0, agentCommission: 0, entryCount: 0 },
      );

    return NextResponse.json({
      period: { start: startDate, end: endDate },
      products,
      totals,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
