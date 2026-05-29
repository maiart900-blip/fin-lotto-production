import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import { requireAdmin } from '@/lib/api-auth';

// 4-TIER AGENT HIERARCHY: Mother Web -> Master -> Agent -> Sub-Agent
// ห้ามใช้ v1, v2 - ต้องใช้ชื่อระดับเต็มเท่านั้น
const AGENT_LEVELS = {
  mother_web: { label: 'Mother Web (เว็บแม่)', level: 0, defaultRate: 0, tier: 'mother_web' },
  master: { label: 'Master', level: 1, defaultRate: 2, tier: 'master' },
  agent: { label: 'Agent', level: 2, defaultRate: 5, tier: 'agent' },
  sub_agent: { label: 'Sub-Agent', level: 3, defaultRate: 7, tier: 'sub_agent' },
  // Legacy mappings (backwards compatibility)
  senior_agent: { label: 'Master', level: 1, defaultRate: 2, tier: 'master' },
  master_agent: { label: 'Master', level: 1, defaultRate: 2, tier: 'master' },
  agent_key: { label: 'Agent', level: 2, defaultRate: 5, tier: 'agent' },
  key_staff: { label: 'Sub-Agent', level: 3, defaultRate: 7, tier: 'sub_agent' },
  member: { label: 'Member', level: 4, defaultRate: 0, tier: 'member' },
};

// GET - ดึงรายชื่อเอเย่นต์จาก agents table
export async function GET(request: Request) {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) {
      console.error('[v0] Agent GET auth failed');
      return authResult;
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const systemType = searchParams.get('system_type');
    
    console.log('[v0] Fetching agents with filters:', { level, systemType });
    
    let query = supabase
      .from('agents')
      .select(`
        id,
        name,
        phone,
        code,
        role,
        level,
        parent_id,
        parent_agent_id,
        commission_rate,
        share_percent,
        is_active,
        status,
        credit_balance,
        credit_limit,
        enable_auto,
        enable_manual_key,
        system_type,
        visible_menus,
        created_at
      `)
      .order('level', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (level && level !== 'all') {
      query = query.eq('role', level);
    }
    
    if (systemType && systemType !== 'all') {
      query = query.eq('system_type', systemType);
    }
    
    const { data: agents, error } = await query;
    
    if (error) {
      console.error('[v0] Agents fetch error:', error);
      // Return error message to frontend instead of silent empty array
      return NextResponse.json({ 
        agents: [], 
        summary: {},
        error: 'Database query failed: ' + error.message,
        _debug: { errorCode: error.code, errorDetails: error.details }
      });
    }
    
    console.log('[v0] Agents fetched successfully:', { count: agents?.length || 0 });
    
    // Map to expected format for frontend
    const mappedAgents = (agents || []).map(agent => ({
      id: agent.id,
      name: agent.name,
      phone: agent.phone,
      username: agent.code,
      agent_level: agent.role,
      upline_id: agent.parent_agent_id || agent.parent_id,
      commission_rate: agent.commission_rate || 0,
      is_partner: true,
      is_active: agent.is_active !== false && agent.status !== 'inactive',
      total_commission: 0,
      pending_commission: 0,
      credit_balance: agent.credit_balance || 0,
      enable_auto: agent.enable_auto || false,
      enable_manual_key: agent.enable_manual_key !== false,
      system_type: agent.system_type,
      created_at: agent.created_at,
    }));
    
    // สรุปจำนวนตามระดับ
    const summary = {
      total: mappedAgents.length,
      senior_agent: mappedAgents.filter(a => a.agent_level === 'senior_agent').length,
      master_agent: mappedAgents.filter(a => a.agent_level === 'master_agent').length,
      agent: mappedAgents.filter(a => a.agent_level === 'agent').length,
      agent_key: mappedAgents.filter(a => a.agent_level === 'agent_key').length,
      key_staff: mappedAgents.filter(a => a.agent_level === 'key_staff').length,
      autoOnly: mappedAgents.filter(a => a.enable_auto && !a.enable_manual_key).length,
      keyOnly: mappedAgents.filter(a => a.enable_manual_key && !a.enable_auto).length,
      both: mappedAgents.filter(a => a.enable_auto && a.enable_manual_key).length,
    };
    
    return NextResponse.json({ agents: mappedAgents, summary, levels: AGENT_LEVELS });
  } catch (error) {
    console.error('[v0] Agents exception:', error);
    return NextResponse.json({ 
      agents: [], 
      summary: {}, 
      levels: AGENT_LEVELS,
      error: 'Server exception: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}

// POST - สร้างเอเย่นต์ใหม่ลง agents table
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      agent_level, 
      upline_id, 
      commission_rate, 
      enable_auto, 
      enable_manual_key, 
      name, 
      phone, 
      username, 
      password,
      system_type,
      require_2fa = true, // Default บังคับ 2FA
    } = body;
    
    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อเอเย่นต์' }, { status: 400 });
    }
    
    if (!username?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอก username' }, { status: 400 });
    }
    
    // Phone is optional for Agent Key
    const isAgentKey = system_type === 'manual_key' || enable_manual_key === true;
    
    // Check if username exists in agents table
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('code', username)
      .maybeSingle();
    
    if (existingAgent) {
      return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้วในระบบ' }, { status: 400 });
    }
    
    // Check users table too
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    
    if (existingUser) {
      return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้วในระบบ' }, { status: 400 });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    
    // Determine level
    let hierarchyLevel = 1;
    if (upline_id) {
      const { data: upline } = await supabase
        .from('agents')
        .select('level')
        .eq('id', upline_id)
        .single();
      
      hierarchyLevel = (upline?.level || 0) + 1;
    }
    
    // Determine system_type
    const determinedSystemType = system_type || 
      (enable_auto && enable_manual_key ? 'hybrid' : 
       enable_auto ? 'auto' : 'manual_key');
    
    // Generate 2FA secret for new agent
    let twoFactorSecret = null;
    let twoFactorQRCode = null;
    let twoFactorOtpauthUrl = null;
    
    if (require_2fa) {
      // Generate TOTP secret
      const totp = new OTPAuth.TOTP({
        issuer: 'FIN LOTTO',
        label: username,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: new OTPAuth.Secret({ size: 20 }),
      });
      
      twoFactorSecret = totp.secret.base32;
      twoFactorOtpauthUrl = totp.toString();
    }
    
    // Default visible menus based on system_type
    const defaultVisibleMenus = determinedSystemType === 'manual_key' 
      ? ['manual-key', 'manual-entries', 'manual-customers', 'manual-downline', 'results']
      : determinedSystemType === 'auto'
      ? ['auto-system', 'auto-entries', 'auto-customers', 'results']
      : ['manual-key', 'manual-entries', 'manual-customers', 'manual-downline', 'auto-system', 'auto-entries', 'auto-customers', 'results'];
    
    // Create agent in agents table
    const agentRole = agent_level || (determinedSystemType === 'manual_key' ? 'agent_key' : 'agent');
    const defaultRate = AGENT_LEVELS[agentRole as keyof typeof AGENT_LEVELS]?.defaultRate || 5;
    
    console.log('[v0] Creating agent:', {
      target_table: 'agents',
      insert_payload: {
        code: username,
        name: name,
        phone: phone || null,
        role: agentRole,
        system_type: determinedSystemType,
        enable_auto: enable_auto ?? false,
        enable_manual_key: enable_manual_key ?? true,
      },
      auth_source: 'agents.code + agents.password',
    });
    
    const { data: newAgent, error: createError } = await supabase
      .from('agents')
      .insert({
        code: username,
        name: name,
        phone: phone || null, // Optional for Agent Key
        password: hashedPassword,
        role: agentRole,
        level: hierarchyLevel,
        parent_id: upline_id || null,
        parent_agent_id: upline_id || null,
        commission_rate: commission_rate ?? defaultRate,
        share_percent: 70,
        credit_limit: 100000,
        credit_balance: 0,
        is_active: true,
        status: 'active',
        system_type: determinedSystemType,
        enable_manual_key: enable_manual_key ?? true,
        enable_auto: enable_auto ?? false,
        visible_menus: JSON.stringify(defaultVisibleMenus),
        can_create_sub_agent: agentRole !== 'key_staff',
        can_view_reports: true,
        // 2FA fields
        two_factor_required: require_2fa,
        two_factor_enabled: false, // ยังไม่ได้ verify
        two_factor_secret: twoFactorSecret,
        two_factor_setup_at: require_2fa ? new Date().toISOString() : null,
      })
      .select()
      .single();
    
    if (createError) {
      console.error('[v0] Create agent error:', createError);
      return NextResponse.json({ error: 'สร้างเอเย่นต์ไม่สำเร็จ: ' + createError.message }, { status: 500 });
    }
    
    console.log('[v0] Agent created successfully:', { id: newAgent.id, code: newAgent.code });
    
    // AUTO-POPULATE: Insert agent into agent_permissions table for visibility control
    // Every new agent automatically appears in "ตั้งค่าการมองเห็นเอเย่นต์" menu
    const { error: permError } = await supabase
      .from('agent_permissions')
      .upsert(
        defaultVisibleMenus.map(menuKey => ({
          agent_id: newAgent.id,
          menu_key: menuKey,
          can_view: true,
          can_create: menuKey.includes('entries') || menuKey.includes('customers'),
          can_edit: false,
          can_delete: false,
          can_approve: false,
          can_payout: false,
        })),
        { onConflict: 'agent_id,menu_key' }
      );
    
    if (permError) {
      console.error('[v0] Agent permissions auto-populate error:', permError);
      // Non-fatal - continue even if permissions fail
    } else {
      console.log('[v0] Agent permissions auto-populated for', newAgent.id);
    }
    
    return NextResponse.json({ 
      success: true, 
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        username: newAgent.code,
        phone: newAgent.phone,
        role: newAgent.role,
        system_type: newAgent.system_type,
        enable_auto: newAgent.enable_auto,
        enable_manual_key: newAgent.enable_manual_key,
      },
      // Return 2FA setup info if required
      twoFactor: require_2fa ? {
        required: true,
        secret: twoFactorSecret,
        otpauthUrl: twoFactorOtpauthUrl,
        message: 'สแกน QR Code ด้วย Google Authenticator หรือแอปยืนยันตัวตนอื่นๆ',
      } : null,
    });
    
  } catch (error) {
    console.error('[v0] Agent POST exception:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดทเอเย่นต์ใน agents table
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { customer_id, agent_id, commission_rate, action, enable_auto, enable_manual_key } = body;
    
    const targetId = agent_id || customer_id;
    
    if (!targetId) {
      return NextResponse.json({ error: 'กรุณาระบุ agent_id' }, { status: 400 });
    }
    
    // Suspend/Activate agent
    if (action === 'suspend' || action === 'activate') {
      const { error } = await supabase
        .from('agents')
        .update({
          is_active: action === 'activate',
          status: action === 'activate' ? 'active' : 'inactive',
        })
        .eq('id', targetId);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true });
    }
    
    // Update commission_rate or enable settings
    if (commission_rate !== undefined || enable_auto !== undefined || enable_manual_key !== undefined) {
      const updateData: Record<string, unknown> = {};
      if (commission_rate !== undefined) updateData.commission_rate = commission_rate;
      if (enable_auto !== undefined) updateData.enable_auto = enable_auto;
      if (enable_manual_key !== undefined) updateData.enable_manual_key = enable_manual_key;
      
      // Update system_type based on enable flags
      if (enable_auto !== undefined || enable_manual_key !== undefined) {
        const newEnableAuto = enable_auto ?? false;
        const newEnableManualKey = enable_manual_key ?? true;
        
        if (newEnableAuto && newEnableManualKey) {
          updateData.system_type = 'hybrid';
        } else if (newEnableAuto) {
          updateData.system_type = 'auto';
        } else {
          updateData.system_type = 'manual_key';
        }
      }
      
      const { error } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', targetId);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'ไม่มีการดำเนินการ' }, { status: 400 });
  } catch (error) {
    console.error('[v0] Agent PUT exception:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
