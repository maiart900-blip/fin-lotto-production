import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySync } from 'otplib';

// POST - Verify TOTP code and enable 2FA
export async function POST(request: Request) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  
  try {
    const { code, isSetup = false, userId: bodyUserId } = await request.json();

    // ใช้ userId จาก body ก่อน ถ้าไม่มีให้ใช้จาก cookie
    const userId = bodyUserId || cookieStore.get('admin_id')?.value;
    const pendingUserId = cookieStore.get('pending_2fa_user')?.value;
    const activeUserId = userId || pendingUserId;

    if (!activeUserId) {
      return NextResponse.json({ error: 'Unauthorized - No user ID provided' }, { status: 401 });
    }

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'กรุณากรอกรหัส 6 หลัก' }, { status: 400 });
    }

    // Get TOTP settings
    const { data: settings, error: settingsError } = await supabase
      .from('two_factor_settings')
      .select('*')
      .eq('user_id', activeUserId)
      .single();

    if (!settings || !settings.secret_key) {
      return NextResponse.json({ error: 'ไม่พบการตั้งค่า 2FA' }, { status: 400 });
    }

    // Check if locked
    if (settings.locked_until && new Date(settings.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(settings.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json({ 
        error: `บัญชีถูกล็อค อีก ${remainingMinutes} นาที` 
      }, { status: 429 });
    }

    // Verify TOTP code using otplib verifySync
    const isValid = verifySync({ token: code, secret: settings.secret_key });

    if (!isValid) {
      // Increment failed attempts
      const failedAttempts = (settings.failed_attempts || 0) + 1;
      const lockUntil = failedAttempts >= 5 
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString() 
        : null;

      await supabase
        .from('two_factor_settings')
        .update({ 
          failed_attempts: failedAttempts,
          locked_until: lockUntil,
        })
        .eq('user_id', activeUserId);

      // Log failed attempt
      await supabase.from('security_logs').insert({
        user_id: activeUserId,
        action: 'totp_verify_failed',
        status: 'failed',
        details: { attempt: failedAttempts },
      });

      if (failedAttempts >= 5) {
        return NextResponse.json({ 
          error: 'กรอกรหัสผิดหลายครั้ง บัญชีถูกล็อค 30 นาที' 
        }, { status: 429 });
      }

      return NextResponse.json({ 
        error: `รหัสไม่ถูกต้อง (เหลือ ${5 - failedAttempts} ครั้ง)` 
      }, { status: 400 });
    }

    // Generate backup codes if this is setup
    let backupCodes: string[] = [];
    if (isSetup) {
      backupCodes = Array.from({ length: 8 }, () => 
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );
    }

    // Enable TOTP
    await supabase
      .from('two_factor_settings')
      .update({ 
        is_enabled: true,
        last_verified_at: new Date().toISOString(),
        failed_attempts: 0,
        locked_until: null,
        ...(isSetup && { backup_codes: backupCodes }),
      })
      .eq('user_id', activeUserId);

    // Update user
    await supabase
      .from('users')
      .update({ two_factor_enabled: true })
      .eq('id', activeUserId);

    // Log success
    await supabase.from('security_logs').insert({
      user_id: activeUserId,
      action: isSetup ? 'totp_setup_complete' : 'totp_verify_success',
      status: 'success',
    });

    // If this is login verification (pending user), complete login
    if (pendingUserId && !userId) {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', pendingUserId)
        .single();

      const response = NextResponse.json({ 
        success: true, 
        user,
        backupCodes: isSetup ? backupCodes : undefined,
        message: isSetup ? 'ตั้งค่า 2FA สำเร็จ' : 'ยืนยันตัวตนสำเร็จ',
      });

      // Set session cookie
      response.cookies.set('admin_id', pendingUserId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      response.cookies.delete('pending_2fa_user');

      return response;
    }

    return NextResponse.json({ 
      success: true, 
      backupCodes: isSetup ? backupCodes : undefined,
      message: isSetup ? 'ตั้งค่า 2FA สำเร็จ' : 'ยืนยันตัวตนสำเร็จ',
    });
  } catch (error) {
    console.error('TOTP verify error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
