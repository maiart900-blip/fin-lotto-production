import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    

    
    const { 
      displayName, 
      display_name,
      role, 
      password, 
      bank_code, 
      bank_account_number, 
      bank_account_name,
      is_active,
      credit_balance,
      commission_percent,
      share_percent
    } = body;
    
    const supabase = await createClient();
    
    // Verify user exists first
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingUser) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้ในระบบ' }, { status: 404 });
    }
    
    // Build update object dynamically
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    // Display name (support both formats)
    if (displayName !== undefined) updateData.display_name = displayName;
    if (display_name !== undefined) updateData.display_name = display_name;
    
    // Role
    if (role !== undefined) updateData.role = role;
    
    // Password (hash if provided)
    if (password && password.length >= 6) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    
    // Bank info - allow empty strings to clear values
    if (bank_code !== undefined) updateData.bank_code = bank_code || null;
    if (bank_account_number !== undefined) updateData.bank_account_number = bank_account_number || null;
    if (bank_account_name !== undefined) updateData.bank_account_name = bank_account_name || null;
    
    // Status
    if (is_active !== undefined) updateData.is_active = is_active;
    
    // Financial - Super Admin can update any value
    if (credit_balance !== undefined) updateData.credit_balance = Number(credit_balance) || 0;
    if (commission_percent !== undefined) updateData.commission_percent = Number(commission_percent) || 0;
    if (share_percent !== undefined) updateData.share_percent = Number(share_percent) || 0;
    
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ 
        error: `ไม่สามารถอัปเดตข้อมูลได้: ${error.message}` 
      }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (err) {
    console.error('Update user exception:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก' 
    }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // PATCH is alias for PUT for partial updates
  return PUT(request, { params });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get user info before deleting (for logging)
    const { data: user } = await supabase
      .from('users')
      .select('username, display_name, phone')
      .eq('id', id)
      .single();
    
    // Delete related records first (cascade)
    // 1. Delete entries
    await supabase.from('entries').delete().eq('user_id', id);
    
    // 2. Delete bet slips
    await supabase.from('bet_slips').delete().eq('user_id', id);
    
    // 3. Delete credit transactions
    await supabase.from('credit_transactions').delete().eq('user_id', id);
    
    // 4. Delete the user - this completely removes the username/phone from system
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({ 
        error: `ไม่สามารถลบผู้ใช้ได้: ${error.message}` 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: `ลบสมาชิก ${user?.display_name || user?.username || id} สำเร็จ - สามารถสมัครใหม่ได้แล้ว`
    });
  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบสมาชิก' 
    }, { status: 500 });
  }
}
