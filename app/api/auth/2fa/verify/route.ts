import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const pendingUserId = cookieStore.get('pending_2fa_user')?.value;

  if (!pendingUserId) {
    return NextResponse.json({ error: 'No pending 2FA verification' }, { status: 400 });
  }

  const { code } = await request.json();

  if (!code) {
    return NextResponse.json({ error: 'กรุณากรอกรหัส OTP' }, { status: 400 });
  }

  // Get latest OTP code
  const { data: otpRecord, error } = await supabase
    .from('two_factor_codes')
    .select('*')
    .eq('user_id', pendingUserId)
    .eq('is_used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !otpRecord) {
    // Log failed attempt
    await supabase.from('security_logs').insert({
      user_id: pendingUserId,
      action: '2fa_verify',
      status: 'failed',
      details: { reason: 'no_valid_code' },
    });

    return NextResponse.json({ error: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' }, { status: 400 });
  }

  // Verify code (simple comparison for now, should use bcrypt hash in production)
  if (otpRecord.code_hash !== code) {
    // Increment failed attempts
    const { data: settings } = await supabase
      .from('two_factor_settings')
      .select('failed_attempts')
      .eq('user_id', pendingUserId)
      .single();

    const failedAttempts = (settings?.failed_attempts || 0) + 1;

    await supabase
      .from('two_factor_settings')
      .update({ 
        failed_attempts: failedAttempts,
        locked_until: failedAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
      })
      .eq('user_id', pendingUserId);

    // Log failed attempt
    await supabase.from('security_logs').insert({
      user_id: pendingUserId,
      action: '2fa_verify',
      status: 'failed',
      details: { reason: 'wrong_code', attempt: failedAttempts },
    });

    if (failedAttempts >= 5) {
      return NextResponse.json({ error: 'บัญชีถูกล็อค 30 นาที เนื่องจากกรอกรหัสผิดหลายครั้ง' }, { status: 429 });
    }

    return NextResponse.json({ error: 'รหัส OTP ไม่ถูกต้อง' }, { status: 400 });
  }

  // Mark code as used
  await supabase
    .from('two_factor_codes')
    .update({ is_used: true, used_at: new Date().toISOString() })
    .eq('id', otpRecord.id);

  // Reset failed attempts
  await supabase
    .from('two_factor_settings')
    .update({ 
      failed_attempts: 0, 
      locked_until: null,
      last_verified_at: new Date().toISOString(),
    })
    .eq('user_id', pendingUserId);

  // Get user data
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', pendingUserId)
    .single();

  // Log success
  await supabase.from('security_logs').insert({
    user_id: pendingUserId,
    action: '2fa_verify',
    status: 'success',
  });

  // Create response with session
  const response = NextResponse.json({ 
    success: true, 
    user,
    message: 'ยืนยันตัวตนสำเร็จ' 
  });

  // Set session cookie
  response.cookies.set('admin_id', pendingUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  // Remove pending cookie
  response.cookies.delete('pending_2fa_user');

  return response;
}
