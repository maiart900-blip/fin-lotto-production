import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { phone, newPassword } = await request.json();

    if (!phone || !newPassword) {
      return NextResponse.json(
        { error: 'กรุณากรอกเบอร์โทรและรหัสผ่านใหม่' },
        { status: 400 }
      );
    }

    // Find customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone')
      .eq('phone', phone)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json(
        { error: 'ไม่พบบัญชีนี้' },
        { status: 404 }
      );
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error } = await supabase
      .from('customers')
      .update({ password_hash })
      .eq('id', customer.id);

    if (error) {
      return NextResponse.json(
        { error: 'ไม่สามารถอัพเดทรหัสผ่านได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'รีเซ็ตรหัสผ่านสำเร็จ',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
