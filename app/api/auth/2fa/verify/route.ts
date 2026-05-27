// 2FA Verify API - ยืนยันรหัส TOTP หรือ Backup Code
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAndUpdate2FA, useBackupCode, is2FARequiredForRole } from '@/lib/2fa-guard';

export async function POST(request: Request) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const pendingUserId = cookieStore.get('pending_2fa_user')?.value;

  if (!pendingUserId) {
    return NextResponse.json({ error: 'No pending 2FA verification' }, { status: 400 });
  }

  const { code, isBackupCode } = await request.json();

  if (!code) {
    return NextResponse.json({ error: 'กรุณากรอกรหัส OTP' }, { status: 400 });
  }

  // Get user data first
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', pendingUserId)
    .single();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if account is locked
  const { data: failedAttempts } = await supabase
    .from('users')
    .select('failed_login_attempts, locked_until')
    .eq('id', pendingUserId)
    .single();

  if (failedAttempts?.locked_until && new Date(failedAttempts.locked_until) > new Date()) {
    return NextResponse.json({ 
      error: 'บัญชีถูกล็อคชั่วคราว กรุณาลองใหม่ภายหลัง' 
    }, { status: 429 });
  }

  let isValid = false;

  if (isBackupCode) {
    // Verify backup code
    isValid = await useBackupCode(pendingUserId, code);
  } else {
    // Verify TOTP code
    isValid = await verifyAndUpdate2FA(pendingUserId, code);
  }

  if (!isValid) {
    // Increment failed attempts
    const currentAttempts = (failedAttempts?.failed_login_attempts || 0) + 1;
    const lockUntil = currentAttempts >= 5 
      ? new Date(Date.now() + 30 * 60 * 1000).toISOString() 
      : null;

    await supabase
      .from('users')
      .update({ 
        failed_login_attempts: currentAttempts,
        locked_until: lockUntil,
      })
      .eq('id', pendingUserId);

    // Log failed attempt
    await supabase.from('audit_logs').insert({
      user_id: pendingUserId,
      action: '2fa_verify_failed',
      details: { 
        attempt: currentAttempts,
        isBackupCode,
      },
      created_at: new Date().toISOString(),
    }).catch(() => {}); // Silent fail for audit log

    if (currentAttempts >= 5) {
      return NextResponse.json({ 
        error: 'บัญชีถูกล็อค 30 นาที เนื่องจากกรอกรหัสผิดหลายครั้ง' 
      }, { status: 429 });
    }

    return NextResponse.json({ error: 'รหัส OTP ไม่ถูกต้อง' }, { status: 400 });
  }

  // Reset failed attempts on success
  await supabase
    .from('users')
    .update({ 
      failed_login_attempts: 0, 
      locked_until: null,
      last_login: new Date().toISOString(),
    })
    .eq('id', pendingUserId);

  // Log success
  await supabase.from('audit_logs').insert({
    user_id: pendingUserId,
    action: '2fa_verify_success',
    details: { isBackupCode },
    created_at: new Date().toISOString(),
  }).catch(() => {}); // Silent fail for audit log

  // Create full session
  const sessionData = {
    userId: user.id,
    username: user.username,
    role: user.role,
    tenantId: user.tenant_id,
    twoFactorVerified: true,
    loginAt: new Date().toISOString(),
  };

  // Create response with session
  const response = NextResponse.json({ 
    success: true, 
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      tenant_id: user.tenant_id,
    },
    message: 'ยืนยันตัวตนสำเร็จ' 
  });

  // Set session cookie
  response.cookies.set('session', JSON.stringify(sessionData), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  // Remove pending cookie
  response.cookies.delete('pending_2fa_user');

  return response;
}
