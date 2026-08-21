import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

// GET: List all users for a specific tenant (Master Admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const supabase = await createClient();
    
    // Get users for this tenant
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, display_name, role, credit_balance, bank_code, bank_account_number, bank_account_name, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json(users || []);
  } catch (error) {
    console.error('[v0] Get tenant users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// PUT: Update user in sub-site (Master Admin Override)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = await request.json();
    const { userId, ...updateData } = body;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    // Verify user belongs to tenant
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, tenant_id')
      .eq('id', userId)
      .single();
    
    if (checkError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (updateData.display_name !== undefined) updates.display_name = updateData.display_name;
    if (updateData.bank_code !== undefined) updates.bank_code = updateData.bank_code;
    if (updateData.bank_account_number !== undefined) updates.bank_account_number = updateData.bank_account_number;
    if (updateData.bank_account_name !== undefined) updates.bank_account_name = updateData.bank_account_name;
    if (updateData.credit_balance !== undefined) updates.credit_balance = updateData.credit_balance;
    if (updateData.is_active !== undefined) updates.is_active = updateData.is_active;
    if (updateData.role !== undefined) updates.role = updateData.role;
    
    // Hash password if provided
    if (updateData.password && updateData.password.length >= 6) {
      updates.password_hash = await bcrypt.hash(updateData.password, 10);
    }
    
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();
    
    if (updateError) throw updateError;
    
    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('[v0] Update tenant user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// POST: Create user in sub-site (Master Admin)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = await request.json();
    const { username, password, display_name, bank_code, bank_account_number, bank_account_name, role = 'member' } = body;
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    // Check if username exists in this tenant
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .eq('tenant_id', tenantId)
      .single();
    
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }
    
    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = `${tenantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        display_name: display_name || `สมาชิก ${username.slice(-4)}`,
        role,
        tenant_id: tenantId,
        referral_code: referralCode,
        bank_code,
        bank_account_number,
        bank_account_name,
        credit_balance: 0,
        is_active: true,
      })
      .select('*')
      .single();
    
    if (createError) throw createError;
    
    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: newUser,
    });
  } catch (error) {
    console.error('[v0] Create tenant user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
