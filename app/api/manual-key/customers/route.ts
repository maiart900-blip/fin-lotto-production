import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API สำหรับจัดการลูกค้าคีย์หวย (Manual Key Customers)
 * - GET: ดึงรายการลูกค้าคีย์หวย (source_type = 'manual_key')
 * - POST: สร้างลูกค้าคีย์หวยใหม่
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const search = searchParams.get('search') || '';
    
    console.log('[v0] GET manual-key customers, agentId:', agentId);

    // Query customers with source_type = 'manual_key' only
    let query = supabase
      .from('customers')
      .select('*')
      .eq('source_type', 'manual_key')
      .order('created_at', { ascending: false });
    
    // Filter by agent_id (FK to agents.id)
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }
    
    // Search
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[v0] Error fetching manual-key customers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[v0] Manual-key customers found:', data?.length);
    return NextResponse.json({ customers: data || [], total: data?.length || 0 });
  } catch (error) {
    console.error('[v0] GET manual-key customers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const {
      name,
      phone,
      line_id,
      agent_id, // Store in upline_id for now
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อลูกค้า' }, { status: 400 });
    }

    console.log('[v0] Creating manual-key customer:', { name, phone, agent_id });

    // Create customer with source_type = 'manual_key'
    // Use fields that exist in customers table schema
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        name: name.trim(),
        phone: phone?.trim() || null,
        line_id: line_id?.trim() || null,
        source_type: 'manual_key', // Important: mark as manual_key customer
        system_type: 'manual_key',
        agent_id: agent_id || null, // FK to agents.id - the agent who created this customer
        parent_agent_id: agent_id || null, // FK to agents.id
        credit_balance: 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[v0] Error creating manual-key customer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[v0] Manual-key customer created:', newCustomer);

    return NextResponse.json({
      success: true,
      customer: newCustomer,
      message: 'สร้างลูกค้าคีย์หวยสำเร็จ',
    });
  } catch (error) {
    console.error('[v0] POST manual-key customers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
