import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

/**
 * API สำหรับสร้าง Agent ใน agent network
 * - บันทึกลง agents table (ไม่ใช่ customers)
 * - รองรับ Agent Key, Agent Auto, Hybrid
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const {
      username,
      password,
      display_name,
      phone,
      role = 'agent',
      parent_id,
      share_percent = 70,
      commission_rate = 5,
      credit_limit = 100000,
      system_type = 'manual_key',
      enable_manual_key = true,
      enable_auto = false,
    } = body;
    
    // Validate required fields
    if (!username || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }
    
    // Check if username exists in agents table
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('code', username)
      .maybeSingle();
    
    if (existingAgent) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' },
        { status: 400 }
      );
    }
    
    // Also check users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' },
        { status: 400 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Determine hierarchy level
    let hierarchyLevel = 1;
    if (parent_id) {
      const { data: parent } = await supabase
        .from('agents')
        .select('level')
        .eq('id', parent_id)
        .single();
      
      hierarchyLevel = (parent?.level || 0) + 1;
    }
    
    // Create agent in agents table
    const { data: newAgent, error: createError } = await supabase
      .from('agents')
      .insert({
        code: username,
        name: display_name || username,
        phone: phone || null,
        password: hashedPassword,
        role: role,
        level: hierarchyLevel,
        parent_id: parent_id || null,
        parent_agent_id: parent_id || null,
        share_percent: share_percent,
        commission_rate: commission_rate,
        credit_limit: credit_limit,
        credit_balance: 0,
        status: 'active',
        system_type: system_type,
        enable_manual_key: enable_manual_key,
        enable_auto: enable_auto,
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Create agent error:', createError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างเอเย่นต์ได้' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      agent: {
        id: newAgent.id,
        username: newAgent.code,
        display_name: newAgent.name,
        role: newAgent.role,
        system_type: newAgent.system_type,
      },
    });
    
  } catch (error) {
    console.error('Create agent error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างเอเย่นต์' },
      { status: 500 }
    );
  }
}
