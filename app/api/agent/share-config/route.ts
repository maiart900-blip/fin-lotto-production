import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentContext, applyTenantScope } from '@/lib/agent-context';

// API สำหรับแก้ไข % ส่วนแบ่ง (share_percent, commission_rate)
// PATCH - แก้ไข % ของ downline (ผู้ขอแก้ไข = session เท่านั้น, กัน auth bypass)

export async function PATCH(request: NextRequest) {
  try {
    const ctxResult = await requireAgentContext();
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;

    const supabase = await createClient();
    const body = await request.json();
    const {
      agent_id,           // เอเย่นที่จะแก้ไข
      share_percent,      // % ที่เอเย่นได้ (เช่น 90%)
      commission_rate,    // ค่าคอมมิชชั่น
      credit_limit,
    } = body;

    // requester = session (ไม่รับจาก body อีกต่อไป)
    const requesterId = context.agentId;
    const isMaster = context.isAdmin;

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    // ดึงข้อมูลเอเย่นที่จะแก้ไข (scope ด้วย tenant)
    let agentQuery = supabase.from('agents').select('*').eq('id', agent_id);
    agentQuery = applyTenantScope(agentQuery, context);
    const { data: agent } = await agentQuery.single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์: ต้องเป็น parent โดยตรงของ agent เป้าหมาย หรือเป็น admin/master
    const isDirectParent = agent.parent_id === requesterId || agent.parent_agent_id === requesterId;

    if (!isMaster && !isDirectParent) {
      return NextResponse.json({
        error: 'Permission denied. Only direct parent or master can edit.'
      }, { status: 403 });
    }

    // ถ้ามีการแก้ไข share_percent
    if (share_percent !== undefined) {
      // ตรวจสอบว่าไม่เกินของ parent
      const parentId = agent.parent_id || agent.parent_agent_id;
      if (parentId) {
        const { data: parent } = await supabase
          .from('agents')
          .select('share_percent')
          .eq('id', parentId)
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
        .or(`parent_id.eq.${agent_id},parent_agent_id.eq.${agent_id}`)
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

// GET - ดูข้อมูล % (scope ด้วย tenant + identity จาก session)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id'); // admin only

    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่น (scope ด้วย tenant)
    let agentQuery = supabase
      .from('agents')
      .select('id, name, share_percent, commission_rate, credit_limit, parent_id, parent_agent_id, level')
      .eq('id', agentId);
    agentQuery = applyTenantScope(agentQuery, context);
    const { data: agent } = await agentQuery.single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ดึงข้อมูล parent (ถ้ามี)
    let parent = null;
    const parentId = agent.parent_id || agent.parent_agent_id;
    if (parentId) {
      const { data: parentData } = await supabase
        .from('agents')
        .select('id, name, share_percent')
        .eq('id', parentId)
        .single();
      parent = parentData;
    }

    // ดึง downline (scope ด้วย tenant)
    let downlineQuery = supabase
      .from('agents')
      .select('id, name, share_percent')
      .or(`parent_id.eq.${agentId},parent_agent_id.eq.${agentId}`);
    downlineQuery = applyTenantScope(downlineQuery, context);
    const { data: downline } = await downlineQuery;

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
