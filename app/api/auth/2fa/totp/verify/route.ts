import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW = 2;

// Decode a Base32 secret (RFC 4648) to bytes.
function decodeBase32(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[\s-]/g, '');

  let bits = '';

  for (const char of clean) {
    const value = alphabet.indexOf(char);

    if (value === -1) {
      throw new Error('Invalid Base32 secret');
    }

    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

// Generate a 6-digit HOTP value for a specific counter.
function generateHotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);

  // TOTP counters are well below Number.MAX_SAFE_INTEGER here.
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', secret)
    .update(counterBuffer)
    .digest();

  const offset = digest[digest.length - 1] & 0x0f;

  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 1_000_000).toString().padStart(6, '0');
}

// Verify current TOTP plus/minus two 30-second periods (±60 seconds).
function verifyTotpCode(
  token: string,
  base32Secret: string,
  window = TOTP_WINDOW,
  stepSeconds = TOTP_STEP_SECONDS
): boolean {
  if (!/^\d{6}$/.test(token)) {
    return false;
  }

  const secret = decodeBase32(base32Secret);
  const currentCounter = Math.floor(Date.now() / 1000 / stepSeconds);
  const tokenBuffer = Buffer.from(token);

  for (let offset = -window; offset <= window; offset += 1) {
    const counter = currentCounter + offset;

    if (counter < 0) continue;

    const expected = generateHotp(secret, counter);
    const expectedBuffer = Buffer.from(expected);

    if (
      expectedBuffer.length === tokenBuffer.length &&
      timingSafeEqual(expectedBuffer, tokenBuffer)
    ) {
      return true;
    }
  }

  return false;
}

// POST - Verify TOTP code and enable 2FA
export async function POST(request: Request) {
  const supabase = await createClient();
  const cookieStore = await cookies();

  try {
    const {
      code,
      isSetup = false,
      userId: bodyUserId,
    } = await request.json();

    // ใช้ userId จาก body ก่อน ถ้าไม่มีให้ใช้จาก cookie
    const userId = bodyUserId || cookieStore.get('admin_id')?.value;
    const pendingUserId = cookieStore.get('pending_2fa_user')?.value;
    const activeUserId = userId || pendingUserId;

    if (!activeUserId) {
      return NextResponse.json(
        { error: 'Unauthorized - No user ID provided' },
        { status: 401 }
      );
    }

    if (!code || String(code).length !== 6) {
      return NextResponse.json(
        { error: 'กรุณากรอกรหัส 6 หลัก' },
        { status: 400 }
      );
    }

    // Get TOTP settings
    const { data: settings, error: settingsError } = await supabase
      .from('two_factor_settings')
      .select('*')
      .eq('user_id', activeUserId)
      .single();

    if (settingsError && !settings) {
      console.error('TOTP settings fetch error:', settingsError);
    }

    if (!settings || !settings.secret_key) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่า 2FA' },
        { status: 400 }
      );
    }

    // Check if locked
    if (
      settings.locked_until &&
      new Date(settings.locked_until) > new Date()
    ) {
      const remainingMinutes = Math.ceil(
        (new Date(settings.locked_until).getTime() - Date.now()) / 60000
      );

      return NextResponse.json(
        { error: `บัญชีถูกล็อค อีก ${remainingMinutes} นาที` },
        { status: 429 }
      );
    }

    // Verify TOTP code with a ±60 second window.
    const isValid = verifyTotpCode(
      String(code),
      String(settings.secret_key)
    );

    if (!isValid) {
      // Smart Account Lockout:
      // - Max 5 failed attempts
      // - Lock duration: 5 minutes
      const failedAttempts = (settings.failed_attempts || 0) + 1;
      const lockUntil =
        failedAttempts >= 5
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
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
        return NextResponse.json(
          { error: 'กรอกรหัสผิดหลายครั้ง บัญชีถูกล็อค 5 นาที' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `รหัสไม่ถูกต้อง (เหลือ ${5 - failedAttempts} ครั้ง)` },
        { status: 400 }
      );
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
        message: isSetup
          ? 'ตั้งค่า 2FA สำเร็จ'
          : 'ยืนยันตัวตนสำเร็จ',
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
      message: isSetup
        ? 'ตั้งค่า 2FA สำเร็จ'
        : 'ยืนยันตัวตนสำเร็จ',
    });
  } catch (error) {
    console.error('TOTP verify error:', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}