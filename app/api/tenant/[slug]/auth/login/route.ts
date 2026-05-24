import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get tenant by slug
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, is_active')
      .eq('slug', slug)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'ไม่พบเว็บไซต์' }, { status: 404 });
    }

    if (!tenant.is_active) {
      return NextResponse.json({ error: 'เว็บไซต์ถูกปิดใช้งาน' }, { status: 403 });
    }

    // Find customer by phone and tenant_id
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, phone, username, password_hash, credit_balance, is_active, tenant_id')
      .eq('phone', phone)
      .eq('tenant_id', tenant.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    if (!customer.is_active) {
      return NextResponse.json({ error: 'บัญชีถูกระงับการใช้งาน' }, { status: 403 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, customer.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: customer.id, 
        phone: customer.phone, 
        type: 'tenant_customer',
        tenantId: tenant.id,
        tenantSlug: slug,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookies
    const cookieStore = await cookies();
    cookieStore.set('tenant_customer_id', customer.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    cookieStore.set('tenant_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // Update last login
    await supabase
      .from('customers')
      .update({ last_login: new Date().toISOString() })
      .eq('id', customer.id);

    return NextResponse.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        username: customer.username,
        credit_balance: customer.credit_balance,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    });
  } catch (error) {
    console.error('Tenant login error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
