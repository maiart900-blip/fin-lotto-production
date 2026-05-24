import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAgentOrHigher } from '@/lib/api-auth';

// API สำหรับเอเย่นจัดการ downline (ลูก, หลาน, เหลน...)
// GET - ดู downline ทั้งหมดของตัวเอง
// POST - สร้าง downline ใหม่ (เปิดเอเย่นลูก)

export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const level = searchParams.get('level'); // 'direct' = แค่ลูกตรง, 'all' = ทุก level

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    // ดึงข้อมูลเอเย่นตัวเอง
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ดึง downline
    if (level === 'direct') {
      // แค่ลูกตรง (Level 1)
      const { data: directDownline } = await supabase
        .from('agents')
        .select('*')
        .eq('parent_id', agentId)
        .order('created_at', { ascending: false });

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

      // ถ้าไม่มี function ให้ใช้วิธีปกติ
      if (!allDownline) {
        const downlineMap = new Map();
        const queue = [agentId];
        let currentLevel = 0;

        while (queue.length > 0 && currentLevel < 10) { // จำกัด 10 level เพื่อความปลอดภัย
          const currentIds = [...queue];
          queue.length = 0;
          currentLevel++;

          const { data: children } = await supabase
            .from('agents')
            .select('*')
            .in('parent_id', currentIds);

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
    const supabase = await createClient();
    const body = await request.json();
    const { 
      parent_id,  // เอเย่นที่เปิด (พ่อ) - อาจเป็น null ถ้าเป็นลูกตรงของแม่
      name,
      phone,
      password,
      share_percent,      // % ที่ลูกได้ (เช่น 90%)
      commission_rate,    // ค่าคอมมิชชั่น
      credit_limit,
      type = 'agent',     // agent หรือ staff
      system_type = 'manual_key', // manual_key หรือ auto
    } = body;

    if (!name || !phone) {
      return NextResponse.json({ 
        error: 'name, phone are required' 
      }, { status: 400 });
    }

    let newLevel = 1;
    let parentShare = 100;

    // ถ้ามี parent_id ให้ดึงข้อมูลพ่อ
    if (parent_id) {
      const { data: parent } = await supabase
        .from('agents')
        .select('*')
        .eq('id', parent_id)
        .single();

      if (!parent) {
        return NextResponse.json({ error: 'Parent agent not found' }, { status: 404 });
      }

      // คำนวณ level
      const parentLevel = parent.level || 1;
      newLevel = parentLevel + 1;
      parentShare = parent.share_percent || 90;
    }

    // ตรวจสอบว่า share_percent ไม่เกินของพ่อ
    const childShare = share_percent || 90;
    
    if (parent_id && childShare > parentShare) {
      return NextResponse.json({ 
        error: `share_percent ไม่สามารถเกิน ${parentShare}% ของต้นสายได้` 
      }, { status: 400 });
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Generate username from name or phone
    const username = phone || `agent_${Date.now()}`;

    // สร้าง downline ใหม่
    const { data: newAgent, error } = await supabase
      .from('agents')
      .insert({
        code: username, // code is used as username for login
        name,
        phone: phone || null, // Phone is optional for Agent Key
        password: hashedPassword,
        parent_id: parent_id || null,
        parent_agent_id: parent_id || null,
        role: type === 'staff' ? 'staff' : 'agent_key',
        level: newLevel,
        share_percent: childShare,
        commission_rate: commission_rate || 5,
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
