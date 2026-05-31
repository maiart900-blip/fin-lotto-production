import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/api-auth';

/**
 * Users API - ADMIN ONLY
 * Manages system admin users (not customers)
 */
export async function GET() {
  try {
    console.log('[v0] Users GET: Starting...');
    
    // Auth guard - require admin for viewing users
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) {
      console.log('[v0] Users GET: Auth failed, status:', authResult.status);
      // Return the actual auth error instead of empty array
      return authResult;
    }
    
    console.log('[v0] Users GET: Auth passed, user:', authResult?.user?.username);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, role, user_type, agent_tier, credit_balance, is_unlimited_credit, parent_id, hierarchy_level, source_type, created_at')
      .order('hierarchy_level', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[v0] Users GET db error:', error.message, error.code);
      return NextResponse.json(
        { error: 'Database error: ' + error.message },
        { status: 500 }
      );
    }
    
    console.log('[v0] Users GET: Success, count:', data?.length || 0);
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[v0] Users GET exception:', err);
    return NextResponse.json(
      { error: 'Server error: ' + (err instanceof Error ? err.message : 'Unknown') },
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
      console.error('[v0] Users POST insert error:', error.message);
      return NextResponse.json(
        { error: error.message || 'Failed to create user' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Users POST exception:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' },
      { status: 500 }
    );
  }
}
