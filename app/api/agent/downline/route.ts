import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAgentContext, applyTenantScope } from '@/lib/agent-context';

// API สำหรับเอเย่นจัดการ downline (ลูก, หลาน, เหลน...)
// GET - ดู downline ทั้งหมดของตัวเอง (identity จาก session, scope ด้วย tenant)
// POST - สร้าง downline ใหม่ (parent + tenant มาจาก session)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agent_id'); // admin only
    const level = searchParams.get('level'); // 'direct' = แค่ลูกตรง, 'all' = ทุก level

    const ctxResult = await requireAgentContext(targetAgentId);
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;
    const agentId = context.agentId;

    const supabase = await createClient();

    // ดึงข้อมูลเอเย่นตัวเอง (scope ด้วย tenant)
    let agentQuery = supabase.from('agents').select('*').eq('id', agentId);
    agentQuery = applyTenantScope(agentQuery, context);
    const { data: agent } = await agentQuery.single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ดึง downline
    if (level === 'direct') {
      // แค่ลูกตรง (Level 1) — scope ด้วย tenant
      let directQuery = supabase
        .from('agents')
        .select('*')
        .or(`parent_id.eq.${agentId},parent_agent_id.eq.${agentId}`)
        .order('created_at', { ascending: false });
      directQuery = applyTenantScope(directQuery, context);
      const { data: directDownline } = await directQuery;

      return NextResponse.json({
        agent,
        downline: directDownline || [],
        level: 'direct',
        count: directDownline?.length || 0,
      });
    } else {
      // ทุก level - ใช้ recursive CTE
      const { data: allDownline } = await supabase.rpc('get_all_downline', {
        p_agent_id: agentId,
      });

      // ถ้าไม่มี function ให้ใช้วิธีปกติ (scope ด้วย tenant)
      if (!allDownline) {
        const downlineMap = new Map();
        const queue = [agentId];
        let currentLevel = 0;

        while (queue.length > 0 && currentLevel < 10) { // จำกัด 10 level เพื่อความปลอดภัย
          const currentIds = [...queue];
          queue.length = 0;
          currentLevel++;

          let childQuery = supabase
            .from('agents')
            .select('*')
            .in('parent_id', currentIds);
          childQuery = applyTenantScope(childQuery, context);
          const { data: children } = await childQuery;

          if (children) {
            for (const child of children) {
              downlineMap.set(child.id, { ...child, level: currentLevel });
              queue.push(child.id);
            }
          }
        }

        const allDownlineList = Array.from(downlineMap.values());

        return NextResponse.json({
          agent,
          downline: allDownlineList,
          level: 'all',
          count: allDownlineList.length,
          maxLevel: currentLevel,
        });
      }

      return NextResponse.json({
        agent,
        downline: allDownline,
        level: 'all',
        count: allDownline.length,
      });
    }
  } catch (error: any) {
    console.error('Error fetching downline:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctxResult = await requireAgentContext();
    if (ctxResult instanceof NextResponse) return ctxResult;
    const { context } = ctxResult;

    const supabase = await createClient();
    const body = await request.json();
    const {
      parent_id: requestedParentId, // parent เป้าหมาย (ต้องเป็นตัวเองหรือ downline ที่ตัวเองเป็นเจ้าของ)
      name,
      phone,
      password,
      share_percent,      // % ที่ลูกได้ — ต้องระบุ (ไม่มี default ปลอม)
      commission_rate,    // ค่าคอมมิชชั่น — ต้องระบุ
      credit_limit,
      type = 'agent',     // agent หรือ staff
      system_type = 'manual_key',
    } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'name, phone are required' }, { status: 400 });
    }
    if (share_percent === undefined || share_percent === null) {
      return NextResponse.json({ error: 'share_percent is required' }, { status: 400 });
    }
    if (commission_rate === undefined || commission_rate === null) {
      return NextResponse.json({ error: 'commission_rate is required' }, { status: 400 });
    }

    // parent เริ่มต้น = ตัวเอง (session). ถ้าระบุ parent อื่น ต้องเป็น downline ที่ตัวเองเป็นเจ้าของ
    let parentId = context.agentId;
    if (requestedParentId && requestedParentId !== context.agentId) {
      if (!context.isAdmin) {
        // ตรวจสอบ ownership: เดินสายขึ้นจาก requestedParent จนถึง context.agentId
        let owned = false;
        let cursor: string | null = requestedParentId;
        for (let i = 0; i < 10 && cursor; i++) {
          const { data: node } = await supabase
            .from('agents')
            .select('id, parent_id, parent_agent_id')
            .eq('id', cursor)
            .single();
          if (!node) break;
          const up = node.parent_id || node.parent_agent_id;
          if (up === context.agentId) { owned = true; break; }
          cursor = up;
        }
        if (!owned) {
          return NextResponse.json({ error: 'Permission denied: parent is not in your downline' }, { status: 403 });
        }
      }
      parentId = requestedParentId;
    }

    // ดึงข้อมูล parent เพื่อคำนวณ level + เพดาน share (scope ด้วย tenant)
    let parentQuery = supabase.from('agents').select('*').eq('id', parentId);
    parentQuery = applyTenantScope(parentQuery, context);
    const { data: parent } = await parentQuery.single();

    if (!parent) {
      return NextResponse.json({ error: 'Parent agent not found' }, { status: 404 });
    }

    const newLevel = (parent.level || 1) + 1;
    const parentShare = parent.share_percent;

    // share ของลูกห้ามเกินของ parent (ถ้า parent มีค่า share)
    if (parentShare !== null && parentShare !== undefined && share_percent > parentShare) {
      return NextResponse.json({
        error: `share_percent ไม่สามารถเกิน ${parentShare}% ของต้นสายได้`
      }, { status: 400 });
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const username = phone || `agent_${Date.now()}`;

    // สร้าง downline ใหม่ — tenant_id inherit จาก session (กัน cross-tenant)
    const { data: newAgent, error } = await supabase
      .from('agents')
      .insert({
        code: username,
        name,
        phone: phone || null,
        password: hashedPassword,
        parent_id: parentId,
        parent_agent_id: parentId,
        tenant_id: context.tenantId,
        role: type === 'staff' ? 'staff' : 'agent_key',
        level: newLevel,
        share_percent: share_percent,
        commission_rate: commission_rate,
        credit_limit: credit_limit || 10000,
        credit_balance: 0,
        status: 'active',
        system_type,
        enable_manual_key: system_type === 'manual_key' || system_type === 'hybrid',
        enable_auto: system_type === 'auto' || system_type === 'hybrid',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      agent: newAgent,
      message: `สร้าง ${type === 'staff' ? 'พนักงาน' : 'เอเย่นต์'} "${name}" สำเร็จ`,
    });
  } catch (error: any) {
    console.error('Error creating downline:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
