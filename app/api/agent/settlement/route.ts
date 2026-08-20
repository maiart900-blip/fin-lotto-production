import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext, applyTenantScope } from '@/lib/agent-context';

// API สรุปยอดส่งเว็บกลาง (Settlement) — identity จาก session, scope ด้วย tenant

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id'); // admin only
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly
    const date = searchParams.get('date');

    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่น (scope ด้วย tenant)
    let agentQuery = supabase.from('agents').select('*').eq('id', agentId);
    agentQuery = applyTenantScope(agentQuery, context);
    const { data: agent } = await agentQuery.single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ค่าถือสู้จริงจาก DB (ไม่มี fallback ปลอม)
    const sharePercent: number | null = agent.share_percent ?? null;
    const shareConfigured = sharePercent !== null;
    const masterSharePercent = shareConfigured ? 100 - sharePercent! : null;

    // กำหนดช่วงวันที่
    const now = date ? new Date(date) : new Date();
    let startDate: Date;
    let endDate: Date;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'weekly') {
      const day = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - day), 23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Data Scope: agent เห็นตัวเอง + sub-agents / sub_agent เห็นเฉพาะตัวเอง — scope ด้วย tenant
    let entriesQuery = supabase
      .from('entries')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    entriesQuery = applyTenantScope(entriesQuery, context);

    if (agent.role === 'sub_agent') {
      entriesQuery = entriesQuery.eq('agent_id', agentId);
    } else {
      entriesQuery = entriesQuery.or(`agent_id.eq.${agentId},parent_agent_id.eq.${agentId}`);
    }

    const { data: entries } = await entriesQuery;

    // ดึง winning entries
    const entryIds = entries?.map(e => e.id) || [];
    let totalPayout = 0;

    if (entryIds.length > 0) {
      const { data: winners } = await supabase
        .from('winning_entries')
        .select('payout')
        .in('entry_id', entryIds);

      totalPayout = winners?.reduce((sum, w) => sum + (Number(w.payout) || 0), 0) || 0;
    }

    // คำนวณยอด
    const totalBets = entries?.length || 0;
    const totalAmount = entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
    const profit = totalAmount - totalPayout;

    // คำนวณส่วนแบ่ง (เฉพาะเมื่อมี share config)
    const agentShare = shareConfigured ? Math.round(profit * (sharePercent! / 100)) : 0;
    const masterShare = shareConfigured ? profit - agentShare : 0;

    // ดึงประวัติการส่งยอด (scope ผ่าน agent_id ที่ผ่าน tenant scope แล้ว
    // หมายเหตุ: agent_settlements ไม่มีคอลัมน์ tenant_id — isolation ทำผ่าน agent_id)
    const { data: settlements } = await supabase
      .from('agent_settlements')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    const pendingAmount = masterShare > 0 ? masterShare : 0;

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        code: agent.code,
        share_percent: sharePercent,
        master_share_percent: masterSharePercent,
        share_configured: shareConfigured,
      },
      period: {
        type: period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
      summary: {
        total_bets: totalBets,
        total_amount: totalAmount,
        total_payout: totalPayout,
        profit: profit,
        agent_share: agentShare,
        master_share: masterShare,
        pending_amount: pendingAmount,
        share_configured: shareConfigured,
      },
      settlements: settlements || [],
    });
  } catch (error) {
    console.error('Agent settlement error:', error);
    return NextResponse.json({ error: 'Failed to get settlement' }, { status: 500 });
  }
}

// POST - บันทึกการส่งยอด (agent_id + tenant_id มาจาก session)
export async function POST(request: Request) {
  try {
    const ctxResult = await requireAgentContext();
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;

    const body = await request.json();
    const { amount, period_start, period_end, note } = body;

    if (amount === undefined || amount === null) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // สร้างรายการส่งยอด — agent_id จาก session (กัน spoofing)
    // หมายเหตุ: agent_settlements ไม่มีคอลัมน์ tenant_id — isolation ทำผ่าน agent_id ที่ scope แล้ว
    const { data, error } = await supabase
      .from('agent_settlements')
      .insert({
        agent_id: context.agentId,
        product_type: 'lottery',
        amount: Number(amount),
        period_start: period_start || new Date().toISOString(),
        period_end: period_end || new Date().toISOString(),
        note,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      settlement: data,
    });
  } catch (error: any) {
    console.error('Agent settlement create error:', error);
    return NextResponse.json({ error: 'Failed to create settlement', detail: error?.message }, { status: 500 });
  }
}
