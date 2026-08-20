import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentContext, applyTenantScope } from '@/lib/agent-context';

// API สำหรับเอเย่น - ดึง/สร้าง entries เฉพาะของเอเย่นตัวเอง (identity จาก session, scope ด้วย tenant)
// ไม่แก้ไข API entries เดิมของเว็บกลาง

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id'); // admin only
    const date = searchParams.get('date');
    const lotteryId = searchParams.get('lottery_id');
    const status = searchParams.get('status');

    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // ตรวจสอบว่า agent นี้เป็น agent หรือ sub_agent (scope ด้วย tenant)
    let agentInfoQuery = supabase
      .from('agents')
      .select('id, role, parent_agent_id')
      .eq('id', agentId);
    agentInfoQuery = applyTenantScope(agentInfoQuery, context);
    const { data: agentInfo } = await agentInfoQuery.single();

    // Data Scope: agent เห็นตัวเอง + sub-agents / sub_agent เห็นเฉพาะตัวเอง — scope ด้วย tenant
    let query = supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });
    query = applyTenantScope(query, context);

    if (agentInfo?.role === 'sub_agent') {
      query = query.eq('agent_id', agentId);
    } else {
      query = query.or(`agent_id.eq.${agentId},parent_agent_id.eq.${agentId}`);
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
    }

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: entries, error } = await query.limit(500);

    if (error) throw error;

    // คำนวณสถิติ
    const stats = {
      total: entries?.length || 0,
      totalAmount: entries?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0,
      pending: entries?.filter(e => e.status === 'pending').length || 0,
      won: entries?.filter(e => e.status === 'won').length || 0,
      lost: entries?.filter(e => e.status === 'lost').length || 0,
    };

    return NextResponse.json({
      entries,
      stats,
    });
  } catch (error) {
    console.error('Agent entries error:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

// POST - เอเย่นบันทึก entries ของตัวเอง (agent_id + tenant_id มาจาก session เท่านั้น)
export async function POST(request: Request) {
  try {
    const ctxResult = await requireAgentContext();
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const body = await request.json();
    const { entries, lottery_id, customer_name, customer_id } = body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries array is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Insert entries — agent_id + tenant_id จาก session (กัน spoofing)
    const entriesToInsert = entries.map(e => ({
      number: e.number,
      bet_type: e.bet_type || e.betType,
      amount: Number(e.amount) || 0,
      lottery_id: lottery_id || e.lottery_id,
      agent_id: agentId,
      tenant_id: context.tenantId,
      customer_id: customer_id || e.customer_id || null,
      customer_name: customer_name || e.customer_name,
      status: 'pending',
      source_type: 'agent',
    }));

    const { data, error } = await supabase
      .from('entries')
      .insert(entriesToInsert)
      .select();

    if (error) throw error;

    // คำนวณยอดรวม
    const totalAmount = entriesToInsert.reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      total_amount: totalAmount,
      entries: data,
    });
  } catch (error: any) {
    console.error('Agent create entries error:', error);
    return NextResponse.json({ error: 'Failed to create entries', detail: error?.message }, { status: 500 });
  }
}
