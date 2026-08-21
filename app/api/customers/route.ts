import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const agentId = searchParams.get('agent_id');
    const systemType = searchParams.get('system_type');

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by agent_id (สำหรับเอเย่นดูเฉพาะลูกค้าใต้สายงาน)
    if (agentId) {
      query = query.eq('agent_id', agentId);
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

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('[v0] Customers GET error:', error.message);
      return NextResponse.json([]);
    }
    
    // Return array for backward compatibility (all existing pages expect array)
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[v0] Customers GET exception:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      name, phone, note, agent_id, system_type, username, password, position,
      user_type, customer_source, account_type 
    } = body;
    const supabase = await createClient();
    
    // Build insert object
    const insertData: Record<string, any> = { name, phone };
    if (note) insertData.note = note;
    if (agent_id) insertData.agent_id = agent_id;
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
      console.error('[v0] Supabase error:', error.message);
      throw error;
    }
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[v0] POST /api/customers error:', err?.message || err);
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
      console.error('[v0] Customer PUT error:', error.message);
      throw error;
    }
    
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}
