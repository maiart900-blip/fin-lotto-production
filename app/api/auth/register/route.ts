import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { username, password, referral_code, bank_code, bank_account_number, bank_account_name } = await request.json();
    
    // Validation - username should be 10-digit phone number
    if (!username || username.length !== 10 || !/^\d{10}$/.test(username)) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก' },
        { status: 400 }
      );
    }

    if (!username.startsWith('0')) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 0' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    // Validate bank info
    if (!bank_code) {
      return NextResponse.json(
        { error: 'กรุณาเลือกธนาคาร' },
        { status: 400 }
      );
    }

    if (!bank_account_number || bank_account_number.length < 10 || !/^\d+$/.test(bank_account_number)) {
      return NextResponse.json(
        { error: 'เลขบัญชีธนาคารต้องเป็นตัวเลขอย่างน้อย 10 หลัก' },
        { status: 400 }
      );
    }

    if (!bank_account_name || bank_account_name.trim().length < 3) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อบัญชีธนาคาร' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Check if username (phone) already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    
    if (checkError) {
      console.error('[v0] Register check error:', checkError);
      return NextResponse.json(
        { error: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล' },
        { status: 500 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate referral code for new user
    const newUserReferralCode = 'FIN' + username.slice(-6).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    // Find referrer if referral code provided
    let referrerId = null;
    if (referral_code) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', referral_code.toUpperCase())
        .maybeSingle();
      
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    // Create user with bank info
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        username: username,
        password_hash: passwordHash,
        display_name: bank_account_name.trim(), // Use bank account name as display name
        role: 'member',
        referral_code: newUserReferralCode,
        referred_by: referrerId,
        credit_balance: 0,
        is_unlimited_credit: false,
        commission_percent: 0,
        share_percent: 0,
        hierarchy_level: referrerId ? 1 : 0,
        is_partner: false,
        two_factor_enabled: false,
        bank_code: bank_code,
        bank_account_number: bank_account_number,
        bank_account_name: bank_account_name.trim(),
      })
      .select('id, username, display_name, referral_code')
      .single();

    if (insertError) {
      console.error('[v0] Register insert error:', insertError);
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      );
    }

    // If referrer exists, create referral record
    if (referrerId && newUser) {
      await supabase
        .from('referrals')
        .insert({
          referrer_id: referrerId,
          referred_customer_id: newUser.id,
          referral_code: referral_code?.toUpperCase(),
          commission_percent: 5.00,
        });
    }

    return NextResponse.json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      user: {
        id: newUser?.id,
        username: newUser?.username,
        displayName: newUser?.display_name,
        referralCode: newUser?.referral_code,
      }
    });
  } catch (error) {
    console.error('[v0] Register error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
      { status: 500 }
    );
  }
}
