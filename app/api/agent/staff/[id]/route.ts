import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// PATCH - อัพเดตข้อมูลพนักงาน
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: staffId } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient();
    
    // ตรวจสอบ session
    const activeUserId = cookieStore.get('active_user_id')?.value;
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ตรวจสอบว่าพนักงานนี้อยู่ใต้สาย agent ที่ login
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, parent_agent_id')
      .eq('id', staffId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์ - ต้องเป็น agent เจ้าของ
    if (staff.parent_agent_id !== activeUserId) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขพนักงานนี้' }, { status: 403 });
    }

    const body = await request.json();
    const updateData: any = {};

    // อัพเดตเฉพาะ field ที่ส่งมา
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    
    // เปลี่ยนรหัสผ่าน
    if (body.password) {
      updateData.password_hash = await bcrypt.hash(body.password, 10);
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', staffId)
      .select('id, username, name, role, is_active')
      .single();

    if (updateError) {
      console.error('Error updating staff:', updateError);
      return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'อัพเดตข้อมูลสำเร็จ',
      staff: updated 
    });
  } catch (error) {
    console.error('Agent staff PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - ลบพนักงาน
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: staffId } = await params;
    const cookieStore = await cookies();
    const supabase = await createClient();
    
    // ตรวจสอบ session
    const activeUserId = cookieStore.get('active_user_id')?.value;
    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ตรวจสอบว่าพนักงานนี้อยู่ใต้สาย agent ที่ login
    const { data: staff, error: staffError } = await supabase
      .from('users')
      .select('id, parent_agent_id')
      .eq('id', staffId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์ - ต้องเป็น agent เจ้าของ
    if (staff.parent_agent_id !== activeUserId) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ลบพนักงานนี้' }, { status: 403 });
    }

    // Soft delete - เปลี่ยน is_active เป็น false แทนการลบจริง
    const { error: deleteError } = await supabase
      .from('users')
      .update({ 
        is_active: false,
        deleted_at: new Date().toISOString()
      })
      .eq('id', staffId);

    if (deleteError) {
      console.error('Error deleting staff:', deleteError);
      return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'ลบพนักงานสำเร็จ'
    });
  } catch (error) {
    console.error('Agent staff DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
