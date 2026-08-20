import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { stripSensitiveFieldsArray, stripSensitiveFields } from '@/lib/api-serializers';
import { getCustomerScopeForUser, applyCustomerScope } from '@/lib/customer-scope';

/**
 * Customers API - Agent/Admin level access
 * Uses stripSensitiveFields to remove only password_hash while keeping all operational fields
 * Frontend depends on full customer data for management pages
 * 
 * SECURITY: Customer scope is enforced based on user's tenant_id and agent downline
 */
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    
    // Get user session for scope filtering (requireAgentOrHigher คืน { user })
    const session = authResult.user;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const agentId = searchParams.get('agent_id');
    const systemType = searchParams.get('system_type');

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
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // SECURITY: Apply customer scope filters first
    query = applyCustomerScope(query, scope);

    // Additional filter by agent_id (for agents filtering within their downline)
    // Only apply if agent_id is in the user's allowed agent IDs
    if (agentId) {
      if (scope.canAccessAll || scope.isAdmin || scope.agentIds.includes(agentId)) {
        query = query.eq('agent_id', agentId);
      }
      // If agent_id not in scope, the applyCustomerScope already limits results
    }

    // Filter by system_type (manual_key หรือ auto)
    if (systemType) {
      query = query.eq('system_type', systemType);
    }

    // Filter by user_type (auto_customer, manual_key_customer, network_member)
    const userType = searchParams.get('user_type');
    if (userType) {
      query = query.eq('user_type', userType);
    }
    
    // Filter by customer_source (auto, manual_key)
    const customerSource = searchParams.get('customer_source');
    if (customerSource) {
      query = query.eq('customer_source', customerSource);
    }
    
    // Filter by account_type (customer, downline_member, staff)
    const accountType = searchParams.get('account_type');
    if (accountType) {
      query = query.eq('account_type', accountType);
    }
    
    // Filter by agent_level (member = staff, agent = agent-customers)
    const agentLevel = searchParams.get('agent_level');
    if (agentLevel) {
      query = query.eq('agent_level', agentLevel);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Customers GET error:', error.message);
      return NextResponse.json([]);
    }
    
    // Strip sensitive fields (password_hash) but keep all operational fields
    return NextResponse.json(stripSensitiveFieldsArray(data || []));
  } catch (err) {
    console.error('Customers GET exception:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    // Auth guard - เฉพาะ agent หรือ admin สร้าง customer ได้ (กัน public create)
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const creator = authResult.user;

    const body = await request.json();
    const { 
      name, phone, note, agent_id, system_type, username, password, position,
      user_type, customer_source, account_type 
    } = body;
    const supabase = await createClient();

    // Resolve agent scope:
    // - agent (ไม่ใช่ admin): customer ต้องผูกกับตัวเองเสมอ (กัน cross-agent)
    // - admin/super_admin: ระบุ agent_id ได้อิสระ
    const creatorIsAdmin = creator.role === 'admin' || creator.role === 'super_admin';
    const resolvedAgentId = creatorIsAdmin ? (agent_id || null) : creator.id;

    // Resolve tenant scope (multi-tenant isolation):
    // - creator มี tenant_id: ใช้ tenant นั้น
    // - creator เป็น master (null): อิง tenant ของ agent ที่ผูก (ถ้ามี) มิฉะนั้น null
    let resolvedTenantId: string | null = creator.tenant_id ?? null;
    if (resolvedTenantId == null && resolvedAgentId) {
      const { data: agentRow } = await supabase
        .from('agents')
        .select('tenant_id')
        .eq('id', resolvedAgentId)
        .maybeSingle();
      resolvedTenantId = agentRow?.tenant_id ?? null;
    }

    // Build insert object — tenant_id + agent_id มาจาก session/scope (กัน spoofing)
    const insertData: Record<string, any> = { name, phone, tenant_id: resolvedTenantId };
    if (note) insertData.note = note;
    if (resolvedAgentId) insertData.agent_id = resolvedAgentId;
    if (system_type) insertData.system_type = system_type;
    if (username) insertData.username = username;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      insertData.password_hash = hashedPassword;
    }
    if (position) insertData.position = position;
    
    // Set user classification fields
    if (user_type) insertData.user_type = user_type;
    if (customer_source) insertData.customer_source = customer_source;
    if (account_type) insertData.account_type = account_type;
    
    // Auto-set user classification based on system_type if not provided
    if (!user_type && system_type) {
      if (system_type === 'auto') {
        insertData.user_type = 'auto_customer';
        insertData.customer_source = 'auto';
        insertData.account_type = 'customer';
      } else if (system_type === 'manual_key') {
        insertData.user_type = 'manual_key_customer';
        insertData.customer_source = 'manual_key';
        insertData.account_type = 'customer';
      }
    }
    
    const { data, error } = await supabase
      .from('customers')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase error:', error.message);
      throw error;
    }
    
    // Strip sensitive fields but keep all operational data
    return NextResponse.json(stripSensitiveFields(data));
  } catch (err: any) {
    console.error('POST /api/customers error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to create customer', details: err?.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.phone !== undefined) updates.phone = updateData.phone;
    if (updateData.note !== undefined) updates.note = updateData.note;
    if (updateData.is_demo_user !== undefined) updates.is_demo_user = updateData.is_demo_user;
    if (updateData.is_lead_user !== undefined) updates.is_lead_user = updateData.is_lead_user;
    if (updateData.credit_balance !== undefined) updates.credit_balance = updateData.credit_balance;
    
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Customer PUT error:', error.message);
      throw error;
    }
    
    // Strip sensitive fields but keep all operational data
    return NextResponse.json(stripSensitiveFields(data));
  } catch {
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}
