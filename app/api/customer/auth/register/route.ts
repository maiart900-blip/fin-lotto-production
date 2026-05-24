import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { 
      name, 
      username, 
      phone, 
      password, 
      bank_code, 
      bank_account_number, 
      bank_account_name,
      referral_code 
    } = body;

    // Use username or name (backward compatible)
    const customerName = name || username || phone;

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกเบอร์โทรศัพท์และรหัสผ่าน' },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!/^0\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก เริ่มด้วย 0)' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' },
        { status: 400 }
      );
    }

    // Check if phone already exists
    const { data: existingPhone, error: checkError } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล กรุณาลองใหม่' },
        { status: 500 }
      );
    }

    if (existingPhone) {
      return NextResponse.json(
        { error: 'เบอร์โทรนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบหรือใช้เบอร์อื่น' },
        { status: 400 }
      );
    }

    // Check if username already exists
    if (username) {
      const { data: existingUsername } = await supabase
        .from('customers')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUsername) {
        return NextResponse.json(
          { error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' },
          { status: 400 }
        );
      }
    }

    // Check referral code if provided
    let referredById: string | null = null;
    let freeCredit = 0;
    if (referral_code) {
      const { data: referrer } = await supabase
        .from('customers')
        .select('id')
        .eq('referral_code', referral_code.toUpperCase())
        .single();

      if (referrer) {
        referredById = referrer.id;
        // Give bonus credit for using referral code
        freeCredit = 20;
      }
    }

    // Check signup promotion
    const { data: signupPromo } = await supabase
      .from('signup_promotions')
      .select('*')
      .eq('is_active', true)
      .single();

    if (signupPromo) {
      freeCredit = Math.max(freeCredit, signupPromo.credit_amount || 0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate unique referral code
    const newReferralCode = generateReferralCode();

    // Create customer (auto system - ลูกค้าสมัครเอง)
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        name: customerName,
        username: username || null,
        phone,
        password_hash: passwordHash,
        bank_code: bank_code || null,
        bank_account_number: bank_account_number || null,
        bank_account_name: bank_account_name || null,
        referral_code: newReferralCode,
        referred_by: referredById,
        credit_balance: freeCredit,
        is_active: true,
        source_type: 'auto', // ลูกค้าสมัครเองผ่านระบบออโต้
        system_type: 'auto',
      })
      .select()
      .single();

    if (error) {
      console.error('Registration error:', error);
      return NextResponse.json(
        { error: 'สมัครสมาชิกไม่สำเร็จ: ' + error.message },
        { status: 500 }
      );
    }

    // Create credit transaction for free credit
    if (freeCredit > 0) {
      await supabase.from('credit_transactions').insert({
        customer_id: customer.id,
        amount: freeCredit,
        type: 'bonus',
        description: referredById ? 'โบนัสสมัครสมาชิกจากการแนะนำ' : 'โบนัสสมัครสมาชิกใหม่',
        balance_after: freeCredit,
      });

      // If referrer exists, give them commission too
      if (referredById) {
        // Get referrer current balance
        const { data: referrer } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', referredById)
          .single();

        if (referrer) {
          const referrerBonus = 10;
          const newBalance = (referrer.credit_balance || 0) + referrerBonus;
          
          await supabase
            .from('customers')
            .update({ credit_balance: newBalance })
            .eq('id', referredById);

          await supabase.from('credit_transactions').insert({
            customer_id: referredById,
            amount: referrerBonus,
            type: 'commission',
            description: `โบนัสแนะนำเพื่อน: ${customerName}`,
            balance_after: newBalance,
          });
        }
      }
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      free_credit: freeCredit,
      customer: {
        id: customer.id,
        name: customer.name,
        username: customer.username,
        phone: customer.phone,
        referral_code: customer.referral_code,
      },
    });

    // Auto-login: Set customer_id cookie
    response.cookies.set('customer_id', customer.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' },
      { status: 500 }
    );
  }
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
