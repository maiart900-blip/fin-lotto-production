import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/api-auth';

/**
 * Users API - ADMIN ONLY
 * Manages system admin users (not customers)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();
    
    // Get session from multiple possible sources
    const adminId = cookieStore.get('admin_id')?.value;
    const sessionCookie = cookieStore.get('session')?.value;
    const lotterySession = cookieStore.get('lottery_session')?.value;
    
    let userId: string | null = null;
    let userRole: string | null = null;
    
    // Try admin_id cookie first
    if (adminId) {
      userId = adminId;
      userRole = cookieStore.get('admin_role')?.value || 'admin';
    } 
    // Try session cookie
    else if (sessionCookie) {
      try {
        const session = JSON.parse(decodeURIComponent(sessionCookie));
        userId = session.userId || session.id;
        userRole = session.role;
      } catch {
        // Session parse failed
      }
    }
    // Try lottery_session
    else if (lotterySession) {
      try {
        const session = JSON.parse(lotterySession);
        userId = session.id;
        userRole = session.role;
      } catch {
        // Lottery session parse failed
      }
    }
    
    // Verify user exists and has admin role
    if (userId) {
      const { data: user } = await supabase
        .from('users')
        .select('id, role, is_active')
        .eq('id', userId)
        .single();
      
      if (user?.is_active) {
        const adminRoles = ['super_admin', 'admin', 'owner', 'staff', 'master_admin'];
        if (adminRoles.includes(user.role)) {
          // User is authenticated admin - proceed with query
          const { data, error } = await supabase
            .from('users')
            .select('id, username, display_name, role, user_type, agent_tier, credit_balance, is_unlimited_credit, parent_id, hierarchy_level, source_type, created_at')
            .order('hierarchy_level', { ascending: true })
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error('Users GET db error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
          }
          
          return NextResponse.json(data || []);
        }
      }
    }
    
    // Not authenticated or not admin
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
    
  } catch (err) {
    console.error('Users GET exception:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Auth guard - require admin for creating users
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { 
      username, 
      password, 
      displayName, 
      phone,
      role, 
      user_type,
      agent_tier,
      is_unlimited_credit, 
      parent_id, 
      hierarchy_level,
      commission_rate,
      source_type,
      source,
    } = body;

    // Validate required fields
    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบ (username, password, displayName)' },
        { status: 400 }
      );
    }

    // Validate username format (alphanumeric, 3-50 chars)
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ เท่านั้น (3-50 ตัวอักษร)' },
        { status: 400 }
      );
    }

    // Validate password (min 6 chars)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Check if username exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    
    if (existing) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Build insert object with all fields
    const insertData: Record<string, unknown> = {
      username,
      password_hash: passwordHash,
      display_name: displayName,
      role: role || 'staff',
      is_unlimited_credit: is_unlimited_credit || false,
      parent_id: parent_id || null,
      hierarchy_level: hierarchy_level || 0,
      credit_balance: 0,
      is_active: true,
    };

    // Add optional fields if provided
    if (phone) insertData.phone = phone;
    if (user_type) insertData.user_type = user_type;
    if (agent_tier) insertData.agent_tier = agent_tier;
    if (commission_rate !== undefined && commission_rate !== null) {
      insertData.commission_rate = commission_rate;
    }
    if (source_type) insertData.source_type = source_type;
    if (source) insertData.source = source;
    
    const { data, error } = await supabase
      .from('users')
      .insert(insertData)
      .select('id, username, display_name, role, user_type, agent_tier, credit_balance, is_unlimited_credit, parent_id, hierarchy_level, source_type, created_at')
      .single();
    
    if (error) {
      console.error('Users POST insert error:', error.message, error.code);
      
      // Handle specific Supabase errors
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างผู้ใช้ได้: ' + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('Users POST exception:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
