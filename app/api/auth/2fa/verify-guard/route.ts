import { NextResponse } from 'next/server';
import {
  check2FAStatus,
  update2FALastVerified,
  get2FASecret,
} from '@/lib/2fa-guard';
import * as OTPAuth from 'otpauth';

// POST - ยืนยัน 2FA code
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, user_type, code } = body;

    if (!user_id || !code) {
      return NextResponse.json(
        { success: false, error: 'User ID and code are required' },
        { status: 400 }
      );
    }

    // get2FASecret() รับ userId เพียง 1 argument
    const secret = await get2FASecret(user_id);

    if (!secret) {
      return NextResponse.json(
        { success: false, error: '2FA not setup for this user' },
        { status: 400 }
      );
    }

    // Verify TOTP
    const totp = new OTPAuth.TOTP({
      issuer: 'LotteryAgent',
      label: user_id,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({
      token: String(code),
      window: 1,
    });

    if (delta === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid 2FA code' },
        { status: 401 }
      );
    }

    // update2FALastVerified() รับ userId เพียง 1 argument
    await update2FALastVerified(user_id);

    // argument ตัวที่ 3 ของ check2FAStatus เป็น boolean
    const status = await check2FAStatus(
      user_id,
      user_type || 'agent',
      true
    );

    return NextResponse.json({
      success: true,
      message: '2FA verified successfully',
      status,
      verified_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to verify 2FA' },
      { status: 500 }
    );
  }
}

// GET - ตรวจสอบสถานะ 2FA
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get('user_id');
    const userType =
      (searchParams.get('user_type') || 'agent') as 'agent' | 'customer';
    const sessionVerified =
      searchParams.get('session_verified') === 'true';

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // argument ตัวที่ 3 เป็น boolean
    const status = await check2FAStatus(
      userId,
      userType,
      sessionVerified
    );

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Error checking 2FA status:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to check 2FA status' },
      { status: 500 }
    );
  }
}