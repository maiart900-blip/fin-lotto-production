import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สำหรับเอเย่น - ดึง entries เฉพาะของเอเย่นตัวเอง
// ไม่แก้ไข API entries เดิมของเว็บกลาง

export async function GET(request: Request) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const date = searchParams.get('date');
    const lotteryId = searchParams.get('lottery_id');
    const status = searchParams.get('status');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // ตรวจสอบว่า agent นี้เป็น agent หรือ sub_agent
    const { data: agentInfo } = await supabase
      .from('agents')
      .select('id, role, parent_agent_id')
      .eq('id', agentId)
      .single();

    // Data Scope Logic:
    // - Agent (role=agent/agent_key): เห็น own data + sub-agents data
    // - Sub-Agent (role=sub_agent): เห็นเฉพาะ own data
    let query = supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (agentInfo?.role === 'sub_agent') {
      // Sub-agent เห็นเฉพาะ entries ที่ตัวเองสร้าง
      query = query.eq('agent_id', agentId);
    } else {
      // Agent เห็น entries ของตัวเอง + sub-agents ทั้งหมด
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

// POST - เอเย่นบันทึก entries ของตัวเอง
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entries, agent_id, lottery_id, customer_name, customer_id } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries array is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Insert entries พร้อม agent_id และ customer_id
    const entriesToInsert = entries.map(e => ({
      number: e.number,
      bet_type: e.bet_type || e.betType,
      amount: Number(e.amount) || 0,
      lottery_id: lottery_id || e.lottery_id,
      agent_id: agent_id,
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
