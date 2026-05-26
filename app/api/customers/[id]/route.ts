import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { stripSensitiveFields } from '@/lib/api-serializers';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { requireCustomerAccess } from '@/lib/customer-scope';

/**
 * Single Customer API - Admin level access
 * Uses stripSensitiveFields to remove only password_hash while keeping all operational fields
 * 
 * SECURITY: Customer access is validated against tenant and agent scope
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Auth guard - require agent or higher
  const authResult = await requireAgentOrHigher();
  if (authResult instanceof NextResponse) return authResult;
  const session = authResult;
  
  // SECURITY: Check customer access
  const accessCheck = await requireCustomerAccess(id, {
    id: session.id,
    role: session.role,
    user_type: session.user_type,
    tenant_id: session.tenant_id,
  });
  
  if (!accessCheck.allowed) {
    return NextResponse.json({ error: accessCheck.reason || 'Access denied' }, { status: 403 });
  }
  
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }
  
  // Strip sensitive fields but keep all operational data
  return NextResponse.json(stripSensitiveFields(data));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Auth guard - require agent or higher
  const authResult = await requireAgentOrHigher();
  if (authResult instanceof NextResponse) return authResult;
  const session = authResult;
  
  // SECURITY: Check customer access
  const accessCheck = await requireCustomerAccess(id, {
    id: session.id,
    role: session.role,
    user_type: session.user_type,
    tenant_id: session.tenant_id,
  });
  
  if (!accessCheck.allowed) {
    return NextResponse.json({ error: accessCheck.reason || 'Access denied' }, { status: 403 });
  }
  
  const supabase = await createClient();
  const body = await request.json();
  
  // Build update object dynamically
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  
  // Name
  if (body.name !== undefined) updateData.name = body.name;
  
  // Phone
  if (body.phone !== undefined) updateData.phone = body.phone;
  
  // Password (hash if provided)
  if (body.password && body.password.length >= 4) {
    updateData.password_hash = await bcrypt.hash(body.password, 10);
  }
  
  // Bank info
  if (body.bank_code !== undefined) updateData.bank_code = body.bank_code || null;
  if (body.bank_account_number !== undefined) updateData.bank_account_number = body.bank_account_number || null;
  if (body.bank_account_name !== undefined) updateData.bank_account_name = body.bank_account_name || null;
  
  // Status - is_active
  if (body.is_active !== undefined) updateData.is_active = body.is_active;
  
  // Credit balance
  if (body.credit_balance !== undefined) updateData.credit_balance = Number(body.credit_balance) || 0;
  
  // Agent fields
  if (body.agent_level !== undefined) updateData.agent_level = body.agent_level;
  if (body.upline_id !== undefined) updateData.upline_id = body.upline_id || null;
  if (body.commission_rate !== undefined) updateData.commission_rate = Number(body.commission_rate) || 0;
  if (body.is_partner !== undefined) updateData.is_partner = body.is_partner;

  const { data, error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Strip sensitive fields but keep all operational data
  return NextResponse.json(stripSensitiveFields(data));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // PUT is alias for PATCH
  return PATCH(request, { params });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Auth guard - require agent or higher
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    
    // SECURITY: Check customer access
    const accessCheck = await requireCustomerAccess(id, {
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });
    
    if (!accessCheck.allowed) {
      return NextResponse.json({ error: accessCheck.reason || 'Access denied' }, { status: 403 });
    }
    
    const supabase = await createClient();
    
    // Get customer info before deleting
    const { data: customer } = await supabase
      .from('customers')
      .select('name, phone')
      .eq('id', id)
      .single();
    
    // Delete related records first
    // 1. Delete entries
    await supabase.from('entries').delete().eq('customer_id', id);
    
    // 2. Delete credit transactions
    await supabase.from('credit_transactions').delete().eq('customer_id', id);
    
    // 3. Delete commission transactions
    await supabase.from('commission_transactions').delete().eq('user_id', id);
    
    // 4. Delete the customer
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ 
        error: `ไม่สามารถลบสมาชิกได้: ${error.message}` 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: `ลบสมาชิก ${customer?.name || customer?.phone || id} สำเร็จ`
    });
  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบสมาชิก' 
    }, { status: 500 });
  }
}
