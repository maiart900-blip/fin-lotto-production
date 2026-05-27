// 2FA Setup API - สร้าง secret และ QR code สำหรับตั้งค่า 2FA
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { generate2FASecret, generateBackupCodes, verify2FACode, enable2FA } from '@/lib/2fa-guard';
import * as QRCode from 'qrcode';

// GET - Generate new 2FA secret and QR code
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const session = JSON.parse(sessionCookie.value);
    const userId = session.userId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user info
    const supabase = await createClient();
    const { data: user } = await supabase
      .from('users')
      .select('username, two_factor_enabled')
      .eq('id', userId)
      .single();
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Generate new secret
    const { secret, otpauthUrl } = generate2FASecret(user.username);
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    
    // Store temporary secret in session (not yet enabled)
    const newSession = {
      ...session,
      pending2FASecret: secret,
    };
    
    cookieStore.set('session', JSON.stringify(newSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30, // 30 minutes for setup
      path: '/',
    });
    
    return NextResponse.json({
      success: true,
      qrCode: qrCodeDataUrl,
      secret: secret, // For manual entry
      alreadyEnabled: user.two_factor_enabled,
    });
    
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Verify code and enable 2FA
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const session = JSON.parse(sessionCookie.value);
    const userId = session.userId;
    const pendingSecret = session.pending2FASecret;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!pendingSecret) {
      return NextResponse.json({ 
        error: 'No pending 2FA setup. Please start setup again.' 
      }, { status: 400 });
    }
    
    const body = await request.json();
    const { code } = body;
    
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
    }
    
    // Verify the code with pending secret
    const isValid = verify2FACode(pendingSecret, code);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }
    
    // Generate backup codes
    const backupCodes = generateBackupCodes(8);
    
    // Enable 2FA in database
    const success = await enable2FA(userId, pendingSecret, backupCodes);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to enable 2FA' }, { status: 500 });
    }
    
    // Update session - remove pending secret, mark 2FA as verified
    const newSession = {
      ...session,
      pending2FASecret: undefined,
      twoFactorVerified: true,
    };
    
    cookieStore.set('session', JSON.stringify(newSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    return NextResponse.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes, // Show once, user must save these
    });
    
  } catch (error) {
    console.error('2FA enable error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
