import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get new password from request body
    const body = await request.json().catch(() => ({}));
    const { newPassword } = body;
    
    // Validate new password
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านใหม่' }, { status: 400 });
    }
    
    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' }, { status: 400 });
    }

    // Get agent to verify exists
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'ไม่พบเอเย่นต์' }, { status: 404 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Reset password error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'เปลี่ยนรหัสผ่านสำเร็จ'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
