import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สำหรับแก้ไข % ส่วนแบ่ง (share_percent, commission_rate)
// PATCH - แก้ไข % ของ downline

export async function PATCH(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { 
      agent_id,           // เอเย่นที่จะแก้ไข
      requester_id,       // ผู้ขอแก้ไข (ต้องเป็น parent หรือ master)
      share_percent,      // % ที่เอเย่นได้ (เช่น 90%)
      commission_rate,    // ค่าคอมมิชชั่น
      credit_limit,
    } = body;

    if (!agent_id || !requester_id) {
      return NextResponse.json({ 
        error: 'agent_id and requester_id are required' 
      }, { status: 400 });
    }

    // ดึงข้อมูลเอเย่นที่จะแก้ไข
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ดึงข้อมูลผู้ขอแก้ไข
    const { data: requester } = await supabase
      .from('agents')
      .select('*')
      .eq('id', requester_id)
      .single();

    // ตรวจสอบสิทธิ์ (ต้องเป็น parent โดยตรง หรือ master level 0)
    const isMaster = !requester; // ถ้าไม่ใช่ agent = เป็น master
    const isDirectParent = agent.parent_id === requester_id;

    if (!isMaster && !isDirectParent) {
      return NextResponse.json({ 
        error: 'Permission denied. Only parent or master can edit.' 
      }, { status: 403 });
    }

    // ถ้ามีการแก้ไข share_percent
    if (share_percent !== undefined) {
      // ตรวจสอบว่าไม่เกินของ parent
      if (agent.parent_id) {
        const { data: parent } = await supabase
          .from('agents')
          .select('share_percent')
          .eq('id', agent.parent_id)
          .single();

        if (parent && share_percent > (parent.share_percent || 100)) {
          return NextResponse.json({ 
            error: `share_percent cannot exceed parent's share (${parent.share_percent}%)` 
          }, { status: 400 });
        }
      }

      // ตรวจสอบว่าไม่น้อยกว่า downline ที่มีอยู่
      const { data: downline } = await supabase
        .from('agents')
        .select('share_percent, name')
        .eq('parent_id', agent_id)
        .gt('share_percent', share_percent);

      if (downline && downline.length > 0) {
        return NextResponse.json({ 
          error: `Cannot set share_percent lower than downline. ${downline[0].name} has ${downline[0].share_percent}%` 
        }, { status: 400 });
      }
    }

    // อัพเดทข้อมูล
    const updateData: any = { updated_at: new Date().toISOString() };
    if (share_percent !== undefined) updateData.share_percent = share_percent;
    if (commission_rate !== undefined) updateData.commission_rate = commission_rate;
    if (credit_limit !== undefined) updateData.credit_limit = credit_limit;

    const { data: updated, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', agent_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      agent: updated,
      message: `อัพเดท ${agent.name} สำเร็จ`,
    });
  } catch (error: any) {
    console.error('Error updating share:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - ดูประวัติการแก้ไข % (ถ้ามี)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    // ดึงข้อมูลเอเย่น
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, share_percent, commission_rate, credit_limit, parent_id, level')
      .eq('id', agentId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ดึงข้อมูล parent (ถ้ามี)
    let parent = null;
    if (agent.parent_id) {
      const { data: parentData } = await supabase
        .from('agents')
        .select('id, name, share_percent')
        .eq('id', agent.parent_id)
        .single();
      parent = parentData;
    }

    // ดึง downline
    const { data: downline } = await supabase
      .from('agents')
      .select('id, name, share_percent')
      .eq('parent_id', agentId);

    return NextResponse.json({
      agent,
      parent,
      downline: downline || [],
      limits: {
        max_share: parent?.share_percent || 100,
        min_share: downline?.length ? Math.max(...downline.map((d: any) => d.share_percent || 0)) : 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching share info:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
