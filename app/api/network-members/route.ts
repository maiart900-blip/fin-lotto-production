import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { getCustomerScopeForUser, applyCustomerScope } from '@/lib/customer-scope';

/**
 * API สำหรับแมมเบอร์สายงาน (Network Members)
 * - แมมเบอร์คือคนที่อยู่ใต้สายงานของ Agent
 * - แยกจากลูกค้าออโต้ (auto_customer) และลูกค้าคีย์หวย (manual_key_customer)
 * - ใช้ user_type = 'network_member' และ account_type = 'downline_member'
 * 
 * SECURITY: Customer scope is enforced based on user's tenant_id and agent downline
 */
export async function GET(request: NextRequest) {
  try {
    // Auth guard
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const agentId = searchParams.get('agent_id');
    const status = searchParams.get('status');
    
    // Get customer scope for current user
    const scope = await getCustomerScopeForUser({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('user_type', 'network_member') // Filter for network members only
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // SECURITY: Apply customer scope filters
    query = applyCustomerScope(query, scope);

    // Additional filter by agent_id (only if within user's scope)
    if (agentId) {
      if (scope.canAccessAll || scope.isAdmin || scope.agentIds.includes(agentId)) {
        query = query.or(`agent_id.eq.${agentId},parent_agent_id.eq.${agentId},upline_id.eq.${agentId}`);
      }
    }

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    
    if (error) {
      console.error('Network members GET error:', error.message);
      return NextResponse.json({ members: [], total: 0 });
    }
    
    return NextResponse.json({ 
      members: data || [], 
      total: count || 0,
      page,
      limit
    });
  } catch (err) {
    console.error('Network members GET exception:', err);
    return NextResponse.json({ members: [], total: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { 
      name, 
      phone, 
      username,
      password,
      agent_id,
      parent_agent_id,
      share_percent,
      commission_rate,
      credit_limit,
      note
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อแมมเบอร์' }, { status: 400 });
    }

    // Check if username exists (if provided)
    if (username) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      
      if (existing) {
        return NextResponse.json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }, { status: 400 });
      }
    }

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Create network member
    const insertData: Record<string, any> = {
      name: name.trim(),
      phone: phone?.trim() || null,
      username: username || null,
      password_hash: passwordHash,
      user_type: 'network_member',
      customer_source: null, // Network members don't have a customer source
      account_type: 'downline_member',
      agent_level: 'member', // Keep for backwards compatibility
      agent_id: agent_id || null,
      parent_agent_id: parent_agent_id || agent_id || null,
      upline_id: agent_id || null,
      share_percent: share_percent || 0,
      commission_rate: commission_rate || 0,
      credit_balance: 0,
      credit_limit: credit_limit || 0,
      note: note || null,
      is_active: true,
    };

    const { data: newMember, error } = await supabase
      .from('customers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Create network member error:', error);
      return NextResponse.json({ error: 'ไม่สามารถสร้างแมมเบอร์ได้' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      member: newMember 
    });
  } catch (err) {
    console.error('Network members POST exception:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, action, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing member ID' }, { status: 400 });
    }

    if (action === 'toggle_status') {
      const { is_active } = data;
      const { error } = await supabase
        .from('customers')
        .update({ is_active })
        .eq('id', id)
        .eq('user_type', 'network_member');

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'reset_password') {
      const { password } = data;
      if (!password) {
        return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านใหม่' }, { status: 400 });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const { error } = await supabase
        .from('customers')
        .update({ password_hash: passwordHash })
        .eq('id', id)
        .eq('user_type', 'network_member');

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Default update
    const updates: Record<string, any> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.note !== undefined) updates.note = data.note;
    if (data.share_percent !== undefined) updates.share_percent = data.share_percent;
    if (data.commission_rate !== undefined) updates.commission_rate = data.commission_rate;
    if (data.credit_limit !== undefined) updates.credit_limit = data.credit_limit;

    const { data: updated, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('user_type', 'network_member')
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, member: updated });
  } catch (err) {
    console.error('Network members PUT exception:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
