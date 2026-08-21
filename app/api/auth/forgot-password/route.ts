import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    // Validate phone
    if (!phone || phone.length !== 10 || !phone.startsWith('0')) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ไม่ถูกต้อง', found: false },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Find user by phone (username)
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, display_name')
      .eq('username', phone)
      .single();

    if (error || !user) {
      return NextResponse.json({
        found: false,
        message: 'ไม่พบข้อมูลสมาชิก',
      });
    }

    // Mask phone number for security (e.g., 081****789)
    const maskedPhone = phone.slice(0, 3) + '****' + phone.slice(-3);

    return NextResponse.json({
      found: true,
      displayName: user.display_name || `สมาชิก ${phone.slice(-4)}`,
      maskedPhone: maskedPhone,
      message: 'พบข้อมูลสมาชิก กรุณาติดต่อฝ่ายบริการลูกค้า',
    });

  } catch (error) {
    console.error('[v0] Forgot password error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในระบบ', found: false },
      { status: 500 }
    );
  }
}
