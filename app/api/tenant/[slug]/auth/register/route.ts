import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { 
      phone, 
      username, 
      password, 
      bank_code, 
      bank_account_number, 
      bank_account_name 
    } = body;

    // Validation
    if (!phone || !username || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    if (phone.length !== 10) {
      return NextResponse.json({ error: 'เบอร์โทรต้องมี 10 หลัก' }, { status: 400 });
    }

    if (username.length < 4) {
      return NextResponse.json({ error: 'Username ต้องมีอย่างน้อย 4 ตัวอักษร' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
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

    // Check if phone already exists for this tenant
    const { data: existingPhone } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .eq('tenant_id', tenant.id)
      .single();

    if (existingPhone) {
      return NextResponse.json({ error: 'เบอร์โทรนี้มีบัญชีแล้ว' }, { status: 400 });
    }

    // Check if username already exists for this tenant
    const { data: existingUsername } = await supabase
      .from('customers')
      .select('id')
      .eq('username', username)
      .eq('tenant_id', tenant.id)
      .single();

    if (existingUsername) {
      return NextResponse.json({ error: 'Username นี้ถูกใช้แล้ว' }, { status: 400 });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate referral code
    const referral_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create customer
    const { data: customer, error: createError } = await supabase
      .from('customers')
      .insert({
        name: bank_account_name || username,
        phone,
        username,
        password_hash,
        bank_code,
        bank_account_number,
        bank_account_name,
        referral_code,
        tenant_id: tenant.id,
        credit_balance: 0,
        is_active: true,
        // Identity model: regular customer (not staff/member, not agent)
        agent_level: null,
        user_type: 'customer',
      })
      .select('id, username, referral_code')
      .single();

    if (createError) {
      console.error('Create customer error:', createError);
      return NextResponse.json({ error: 'สมัครสมาชิกไม่สำเร็จ' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      customer: {
        id: customer.id,
        username: customer.username,
        referral_code: customer.referral_code,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    });
  } catch (error) {
    console.error('Tenant register error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
