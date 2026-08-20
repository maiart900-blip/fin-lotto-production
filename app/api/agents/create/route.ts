import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/api-auth';

/**
 * API สำหรับสร้าง Agent (เอเย่นต์คีย์/ออโต้/hybrid)
 * - บันทึกลง agents table (ไม่ใช่ customers)
 * - รองรับ login ด้วย username/password
 * - เบอร์โทรเป็น optional สำหรับ Agent Key
 */
export async function POST(request: NextRequest) {
  try {
    // Auth guard - require admin for creating agents
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const { user: creator } = authResult;

    const supabase = await createClient();
    const body = await request.json();
    
    const {
      name,
      username,
      password,
      phone,
      level = 'agent',
      share_percent = 70,
      commission_rate = 5,
      credit_limit = 100000,
      parent_agent_id,
      status = 'active',
      system_type = 'manual_key', // 'manual_key' | 'auto' | 'hybrid'
      enable_manual_key = true,
      enable_auto = false,
      role = 'agent_key',
      owner_id,
      tenant_id: bodyTenantId, // super_admin (master) เท่านั้นที่ระบุ target tenant ได้
    } = body;

    // Resolve tenant scope จาก session ผู้สร้าง (multi-tenant isolation)
    // - tenant admin (มี tenant_id): agent ใหม่ถูกผูกกับ tenant ของ admin เสมอ (บังคับ, กัน cross-tenant)
    // - super_admin/master (tenant_id null): เป็น master agent (null) หรือระบุ target tenant ผ่าน body ได้
    const creatorIsMaster = creator.tenant_id == null;
    const resolvedTenantId = creatorIsMaster
      ? (bodyTenantId ?? null)
      : creator.tenant_id;
    
    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อเอเย่นต์' },
        { status: 400 }
      );
    }
    
    if (!username?.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอก username' },
        { status: 400 }
      );
    }
    
    if (username.length < 4) {
      return NextResponse.json(
        { error: 'username ต้องมีอย่างน้อย 4 ตัวอักษร' },
        { status: 400 }
      );
    }
    
    if (!password) {
      return NextResponse.json(
        { error: 'กรุณากรอกรหัสผ่าน' },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }
    
    // Check if username already exists in agents table
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('code', username)
      .maybeSingle();
    
    if (existingAgent) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้มีอยู่แล้วในระบบ' },
        { status: 400 }
      );
    }
    
    // Also check users table for username conflicts
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้มีอยู่แล้วในระบบ' },
        { status: 400 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Get parent agent level if parent_agent_id is provided
    let agentLevel = 1;
    if (parent_agent_id) {
      const { data: parentAgent } = await supabase
        .from('agents')
        .select('level, tenant_id')
        .eq('id', parent_agent_id)
        .single();

      if (!parentAgent) {
        return NextResponse.json({ error: 'ไม่พบเอเย่นต์แม่ (parent)' }, { status: 400 });
      }

      // parent ต้องอยู่ tenant เดียวกับ agent ใหม่ (กันผูกข้ามสาย/ข้าม tenant)
      const parentTenant = parentAgent.tenant_id ?? null;
      if (parentTenant !== resolvedTenantId) {
        return NextResponse.json(
          { error: 'เอเย่นต์แม่อยู่คนละ tenant ไม่สามารถผูกสายข้าม tenant ได้' },
          { status: 400 }
        );
      }

      agentLevel = (parentAgent?.level || 0) + 1;
    }
    
    // Generate unique code if not provided
    const agentCode = username;
    
    // Default visible menus based on system_type
    const defaultVisibleMenus = system_type === 'manual_key' 
      ? ['manual-key', 'manual-entries', 'manual-customers', 'manual-downline']
      : system_type === 'auto'
      ? ['auto-system', 'auto-entries', 'auto-customers']
      : ['manual-key', 'manual-entries', 'manual-customers', 'manual-downline', 'auto-system', 'auto-entries', 'auto-customers'];
    
    // Create agent in agents table
    const { data: newAgent, error: createError } = await supabase
      .from('agents')
      .insert({
        code: agentCode,
        name: name,
        phone: phone || null, // Optional for Agent Key
        password: hashedPassword,
        role: role,
        level: agentLevel,
        tenant_id: resolvedTenantId, // ผูก tenant จาก session ผู้สร้าง (multi-tenant isolation)
        parent_id: parent_agent_id || null,
        parent_agent_id: parent_agent_id || null,
        owner_id: owner_id || null,
        share_percent: share_percent,
        commission_rate: commission_rate,
        credit_limit: credit_limit,
        credit_balance: 0,
        status: status,
        system_type: system_type,
        enable_manual_key: enable_manual_key,
        enable_auto: enable_auto,
        visible_menus: JSON.stringify(defaultVisibleMenus),
        can_create_sub_agent: level === 'master' || level === 'agent',
        can_view_reports: true,
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Create agent error:', createError);
      return NextResponse.json(
        { error: `ไม่สามารถสร้างเอเย่นต์ได้: ${createError.message}` },
        { status: 500 }
      );
    }
    
    // Also create user in users table for login functionality
    const agentTierMap: Record<string, string> = {
      'master': 'master',
      'agent': 'agent',
      'sub_agent': 'sub_agent',
      'agent_key': agentLevel === 1 ? 'master' : agentLevel === 2 ? 'agent' : 'sub_agent',
    };
    
    const { error: userCreateError } = await supabase
      .from('users')
      .insert({
        username: agentCode,
        password_hash: hashedPassword, // คอลัมน์จริงคือ password_hash (ไม่ใช่ password)
        display_name: name,
        phone: phone || null,
        tenant_id: resolvedTenantId, // ผูก tenant เดียวกับ agents row (login scope)
        role: 'agent', // All agents have 'agent' role for login
        user_type: 'manual_key_agent',
        agent_tier: agentTierMap[level] || agentTierMap[role] || 'agent',
        source_type: system_type,
        source: `agent_${newAgent.id}`,
        is_active: status === 'active',
        hierarchy_level: agentLevel,
        parent_id: parent_agent_id || null,
        commission_rate: commission_rate,
      });
    
    if (userCreateError) {
      console.error('Create user for agent error:', userCreateError);
      // Don't fail the whole operation, agent is already created
      // Just log the error - agent can be linked to user later
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      agent: {
        id: newAgent.id,
        code: newAgent.code,
        name: newAgent.name,
        username: newAgent.code, // username is stored as code
        role: newAgent.role,
        level: newAgent.level,
        system_type: newAgent.system_type,
        enable_manual_key: newAgent.enable_manual_key,
        enable_auto: newAgent.enable_auto,
        status: newAgent.status,
        created_at: newAgent.created_at,
      },
      message: 'สร้างเอเย่นต์สำเร็จ',
    });
    
  } catch (error) {
    console.error('Create agent error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างเอเย่นต์' },
      { status: 500 }
    );
  }
}
