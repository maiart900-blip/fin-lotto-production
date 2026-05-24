import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงประวัติการโยกย้าย
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const agentId = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('transfer_logs')
      .select(`
        *,
        customer:customer_id(id, name, phone),
        from_agent:from_agent_id(id, name, phone),
        to_agent:to_agent_id(id, name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    if (agentId) {
      query = query.or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transfer logs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transfers: data });
  } catch (error) {
    console.error('Transfer logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - ทำการโยกย้ายสายงาน
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      customer_id, 
      to_agent_id, 
      transfer_type = 'member_to_agent',
      reason,
      note,
      transferred_by 
    } = body;

    if (!customer_id || !transferred_by) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // ดึงข้อมูลลูกค้าปัจจุบัน
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, referred_by, agent_id, partner_id')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลลูกค้า' },
        { status: 404 }
      );
    }

    const fromAgentId = customer.agent_id || customer.referred_by;

    // บันทึก transfer log
    const { data: transferLog, error: logError } = await supabase
      .from('transfer_logs')
      .insert({
        customer_id,
        from_agent_id: fromAgentId,
        to_agent_id: to_agent_id || null,
        from_partner_id: customer.partner_id,
        to_partner_id: null,
        transfer_type,
        transferred_by,
        reason,
        note,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating transfer log:', logError);
      return NextResponse.json({ error: logError.message }, { status: 500 });
    }

    // อัปเดต agent_id / referred_by ในลูกค้า
    const updateData: Record<string, string | null> = {};
    if (to_agent_id) {
      updateData.agent_id = to_agent_id;
      updateData.referred_by = to_agent_id;
    } else {
      // ย้ายออกจากสายงาน (ไม่มี agent)
      updateData.agent_id = null;
      updateData.referred_by = null;
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customer_id);

    if (updateError) {
      console.error('Error updating customer:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'โยกย้ายสายงานสำเร็จ',
      transfer: transferLog,
    });
  } catch (error) {
    console.error('Transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
