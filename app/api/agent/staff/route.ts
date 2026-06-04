import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// GET - ดึงรายชื่อพนักงานของ Agent
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient();
    
    // ตรวจสอบ session
    const activeUserId = cookieStore.get('active_user_id')?.value;
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ดึงข้อมูล agent ที่ login
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('id, role, user_type')
      .eq('id', activeUserId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ดึงพนักงานที่มี parent_agent_id = agent นี้
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, username, name, phone, role, user_type, is_active, created_at')
      .eq('parent_agent_id', activeUserId)
      .in('user_type', ['staff', 'operator', 'sub_agent'])
      .order('created_at', { ascending: false });

    if (staffError) {
      console.error('Error fetching staff:', staffError);
      return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }

    return NextResponse.json({ staff: staff || [] });
  } catch (error) {
    console.error('Agent staff GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - เพิ่มพนักงานใหม่ (ผูก parent_agent_id อัตโนมัติ)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = await createClient();
    
    // ตรวจสอบ session
    const activeUserId = cookieStore.get('active_user_id')?.value;
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ดึงข้อมูล agent ที่ login
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('id, role, user_type, tenant_id')
      .eq('id', activeUserId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // ตรวจสอบว่าเป็น agent จริง
    if (!['agent', 'master', 'sub_agent'].includes(agent.role) && 
        !['agent', 'master', 'sub_agent'].includes(agent.user_type || '')) {
      return NextResponse.json({ error: 'Only agents can add staff' }, { status: 403 });
    }

    const body = await request.json();
    const { username, name, password, phone, role = 'staff' } = body;

    // Validation
    if (!username || !name || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    // ตรวจสอบ username ซ้ำ
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Username นี้ถูกใช้งานแล้ว' }, { status: 400 });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // สร้างพนักงานใหม่ พร้อมผูก parent_agent_id อัตโนมัติ
    const { data: newStaff, error: createError } = await supabase
      .from('users')
      .insert({
        username,
        name,
        password_hash,
        phone: phone || null,
        role: role, // 'staff' หรือ 'operator'
        user_type: role,
        parent_agent_id: activeUserId, // ผูกกับ agent ที่ login อัตโนมัติ
        tenant_id: agent.tenant_id, // inherit tenant จาก agent
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select('id, username, name, role, is_active')
      .single();

    if (createError) {
      console.error('Error creating staff:', createError);
      return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'เพิ่มพนักงานสำเร็จ',
      staff: newStaff 
    });
  } catch (error) {
    console.error('Agent staff POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
