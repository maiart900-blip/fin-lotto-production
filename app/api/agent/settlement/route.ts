import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สรุปยอดส่งเว็บกลาง (Settlement)
// เอเย่นต้องส่ง % ส่วนแบ่งให้เว็บกลาง

export async function GET(request: Request) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const period = searchParams.get('period') || 'daily'; // daily, weekly, monthly
    const date = searchParams.get('date');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่น
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const sharePercent = agent.share_percent || 90;
    const masterSharePercent = 100 - sharePercent;

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

    // ดึง entries ของเอเย่น
    const { data: entries } = await supabase
      .from('entries')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

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
    
    // คำนวณส่วนแบ่ง
    const agentShare = Math.round(profit * (sharePercent / 100));
    const masterShare = profit - agentShare;

    // ดึงประวัติการส่งยอด
    const { data: settlements } = await supabase
      .from('agent_settlements')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(10);

    // คำนวณยอดค้างส่ง
    const paidAmount = settlements?.filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0) || 0;
    
    const pendingAmount = masterShare > 0 ? masterShare : 0;

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        code: agent.code,
        share_percent: sharePercent,
        master_share_percent: masterSharePercent,
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
      },
      settlements: settlements || [],
    });
  } catch (error) {
    console.error('Agent settlement error:', error);
    return NextResponse.json({ error: 'Failed to get settlement' }, { status: 500 });
  }
}

// POST - บันทึกการส่งยอด
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_id, amount, period_start, period_end, note } = body;

    if (!agent_id || !amount) {
      return NextResponse.json({ error: 'agent_id and amount are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // สร้างรายการส่งยอด
    const { data, error } = await supabase
      .from('agent_settlements')
      .insert({
        agent_id,
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
