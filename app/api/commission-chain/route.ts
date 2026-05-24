import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CommissionResult {
  entry_id: string;
  total_amount: number;
  agent_commission: number;
  parent_commission: number;
  master_amount: number;
  chain: {
    level: string;
    name: string;
    amount: number;
    percentage: number;
  }[];
}

// คำนวณ commission chain จากแมมเบอร์ -> เอเย่น -> เว็บแม่
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { entry_id, amount, customer_id, agent_id } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // ดึงข้อมูล agent และ parent chain
    let currentAgentId = agent_id;
    const commissionChain: CommissionResult['chain'] = [];
    let remainingAmount = amount;

    // ถ้าไม่มี agent_id ให้หาจาก customer
    if (!currentAgentId && customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('agent_id')
        .eq('id', customer_id)
        .single();
      
      currentAgentId = customer?.agent_id;
    }

    // วน loop หาเอเย่นต์และ parent ทั้งหมด
    let level = 1;
    while (currentAgentId) {
      const { data: agent } = await supabase
        .from('agents')
        .select('id, username, display_name, commission_rate, parent_agent_id, level')
        .eq('id', currentAgentId)
        .single();

      if (!agent) break;

      // คำนวณ commission สำหรับเอเย่นต์นี้
      const commissionRate = Number(agent.commission_rate) || 5; // default 5%
      const commission = remainingAmount * (commissionRate / 100);

      commissionChain.push({
        level: `เอเย่น Lv.${agent.level || level}`,
        name: agent.display_name || agent.username,
        amount: commission,
        percentage: commissionRate,
      });

      remainingAmount -= commission;
      currentAgentId = agent.parent_agent_id;
      level++;

      // ป้องกัน infinite loop
      if (level > 10) break;
    }

    // จำนวนที่เหลือส่งเว็บแม่
    commissionChain.push({
      level: 'เว็บแม่ (Master)',
      name: 'บริษัท',
      amount: remainingAmount,
      percentage: 100 - commissionChain.reduce((sum, c) => sum + c.percentage, 0),
    });

    const result: CommissionResult = {
      entry_id: entry_id || 'preview',
      total_amount: amount,
      agent_commission: commissionChain.find(c => c.level.includes('Lv.1'))?.amount || 0,
      parent_commission: commissionChain.filter(c => !c.level.includes('Master') && !c.level.includes('Lv.1'))
        .reduce((sum, c) => sum + c.amount, 0),
      master_amount: remainingAmount,
      chain: commissionChain,
    };

    // ถ้ามี entry_id ให้อัปเดตในฐานข้อมูล
    if (entry_id && entry_id !== 'preview') {
      await supabase
        .from('entries')
        .update({
          agent_commission: result.agent_commission,
          parent_commission: result.parent_commission,
          master_amount: result.master_amount,
        })
        .eq('id', entry_id);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Commission calculation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ดึงสรุป commission ของเอเย่นต์
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const systemType = searchParams.get('system_type');

    let query = supabase
      .from('entries')
      .select('id, amount, agent_commission, parent_commission, master_amount, created_at, agent_id');

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data: entries, error } = await query.order('created_at', { ascending: false }).limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // คำนวณสรุป
    const summary = {
      total_entries: entries?.length || 0,
      total_amount: entries?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0,
      total_agent_commission: entries?.reduce((sum, e) => sum + Number(e.agent_commission || 0), 0) || 0,
      total_parent_commission: entries?.reduce((sum, e) => sum + Number(e.parent_commission || 0), 0) || 0,
      total_master_amount: entries?.reduce((sum, e) => sum + Number(e.master_amount || 0), 0) || 0,
    };

    return NextResponse.json({ entries, summary });
  } catch (error) {
    console.error('Get commission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
