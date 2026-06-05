import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { phone, password, tenantId, username, email } = await request.json();

    // Accept phone, username, or email
    const loginIdentifier = phone || username || email;

    if (!loginIdentifier || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อผู้ใช้/อีเมล/เบอร์โทร และรหัสผ่าน' },
        { status: 400 }
      );
    }

    // Normalize phone number (remove leading 0 for comparison)
    const normalizedPhone = loginIdentifier.startsWith('0') ? loginIdentifier : '0' + loginIdentifier;
    const phoneWithoutZero = loginIdentifier.startsWith('0') ? loginIdentifier.substring(1) : loginIdentifier;

    // Helper function to find customer by phone, username, OR email
    const findCustomer = async (searchValue: string) => {
      // Try to find by phone first
      const { data: byPhone } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', searchValue)
        .maybeSingle();
      
      if (byPhone) return byPhone;

      // Try to find by username
      const { data: byUsername } = await supabase
        .from('customers')
        .select('*')
        .eq('username', searchValue)
        .maybeSingle();
      
      if (byUsername) return byUsername;

      // Try to find by email (case insensitive)
      const { data: byEmail } = await supabase
        .from('customers')
        .select('*')
        .ilike('email', searchValue)
        .maybeSingle();
      
      if (byEmail) return byEmail;

      return null;
    };

    // Find customer by phone, username, or email (try multiple formats)
    let customer = await findCustomer(loginIdentifier);
    
    // Try with normalized phone if not found
    if (!customer) {
      customer = await findCustomer(normalizedPhone);
    }

    // Try without leading zero if still not found
    if (!customer) {
      customer = await findCustomer(phoneWithoutZero);
    }

    // Check for database error
    const { error } = await supabase.from('customers').select('id').limit(0);
    if (error) {
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่' },
        { status: 500 }
      );
    }

    if (error) {
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่' },
        { status: 500 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'ไม่พบบัญชีนี้ กรุณาตรวจสอบเบอร์โทรศัพท์หรือสมัครสมาชิกใหม่' },
        { status: 401 }
      );
    }

    if (!customer.password_hash) {
      return NextResponse.json(
        { error: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณาติดต่อเจ้าหน้าที่' },
        { status: 401 }
      );
    }

    if (!customer.is_active) {
      return NextResponse.json(
        { error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, customer.password_hash);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง' },
        { status: 401 }
      );
    }

    // Update last login
    await supabase
      .from('customers')
      .update({ last_login: new Date().toISOString() })
      .eq('id', customer.id);

    // Generate token with tenant info for cross-platform support
    const token = jwt.sign(
      { 
        id: customer.id, 
        phone: customer.phone,
        type: 'customer',
        tenantId: customer.tenant_id || null,
        crossPlatform: !customer.tenant_id || customer.tenant_id === 'master',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return customer data (without password)
    const { password_hash: _, ...customerData } = customer;

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      customer: customerData,
      token,
    });

    // Set customer_id cookie
    response.cookies.set('customer_id', customer.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Set customer_token cookie
    response.cookies.set('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
