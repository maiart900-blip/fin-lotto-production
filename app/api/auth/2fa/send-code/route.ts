import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user_id, purpose = 'login' } = await request.json();

  if (!user_id) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  // Check if user has 2FA enabled
  const { data: settings } = await supabase
    .from('two_factor_settings')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (!settings?.is_enabled) {
    return NextResponse.json({ error: '2FA not enabled' }, { status: 400 });
  }

  // Check if locked
  if (settings.locked_until && new Date(settings.locked_until) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(settings.locked_until).getTime() - Date.now()) / 60000);
    return NextResponse.json({ 
      error: `บัญชีถูกล็อค กรุณารออีก ${remainingMinutes} นาที` 
    }, { status: 429 });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP (expires in 5 minutes)
  await supabase.from('two_factor_codes').insert({
    user_id,
    code_hash: otp, // In production, should hash this
    purpose,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  // Get user email
  const { data: user } = await supabase
    .from('users')
    .select('email, username')
    .eq('id', user_id)
    .single();

  // In production, send email/SMS here
  // For now, log it (remove in production!)
  console.log(`[2FA] OTP for ${user?.username}: ${otp}`);

  // Log security event
  await supabase.from('security_logs').insert({
    user_id,
    action: '2fa_code_sent',
    status: 'success',
    details: { method: settings.method, purpose },
  });

  return NextResponse.json({ 
    success: true, 
    message: `ส่งรหัส OTP ไปที่ ${settings.method === 'email' ? 'อีเมล' : 'เบอร์โทร'} แล้ว`,
    // For development only - remove in production!
    dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
  });
}
