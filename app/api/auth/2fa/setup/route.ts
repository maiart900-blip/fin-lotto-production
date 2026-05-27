// 2FA Setup API - สร้าง secret และ QR code สำหรับตั้งค่า 2FA
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { generate2FASecret, generateBackupCodes, verify2FACode, enable2FA } from '@/lib/2fa-guard';
import * as QRCode from 'qrcode';

// Force Node.js runtime for crypto compatibility
export const runtime = 'nodejs';

// POST - Generate new 2FA secret and QR code
export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // Check for pending 2FA setup (from login flow)
    const pending2FASetup = cookieStore.get('pending_2fa_setup');
    
    // Also check regular session
    const sessionCookie = cookieStore.get('session');
    
    let userId: string | null = null;
    
    if (pending2FASetup?.value) {
      userId = pending2FASetup.value;
    } else if (sessionCookie?.value) {
      try {
        const session = JSON.parse(sessionCookie.value);
        userId = session.userId;
      } catch {
        // Invalid session
      }
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }
    
    // Get user info
    const supabase = await createClient();
    const { data: user } = await supabase
      .from('users')
      .select('username, two_factor_enabled, two_factor_secret')
      .eq('id', userId)
      .single();
    
    if (!user) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
    }
    
    // Generate new secret
    const { secret, otpauthUrl } = await generate2FASecret(user.username);
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    
    // Generate backup codes
    const backupCodes = generateBackupCodes(8);
    
    // Store temporary secret in cookie for verification
    cookieStore.set('pending_2fa_secret', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30, // 30 minutes for setup
      path: '/',
    });
    
    // Store backup codes temporarily
    cookieStore.set('pending_2fa_backup', JSON.stringify(backupCodes), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 30,
      path: '/',
    });
    
    return NextResponse.json({
      success: true,
      qrCode: qrCodeDataUrl,
      secret: secret, // For manual entry
      backupCodes: backupCodes,
      alreadyEnabled: user.two_factor_enabled && !!user.two_factor_secret,
    });
    
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตั้งค่า' }, { status: 500 });
  }
}

// PUT - Verify code and enable 2FA
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Get user ID from pending setup or session
    const pending2FASetup = cookieStore.get('pending_2fa_setup');
    const sessionCookie = cookieStore.get('session');
    const pendingSecret = cookieStore.get('pending_2fa_secret')?.value;
    const pendingBackup = cookieStore.get('pending_2fa_backup')?.value;
    
    let userId: string | null = null;
    
    if (pending2FASetup?.value) {
      userId = pending2FASetup.value;
    } else if (sessionCookie?.value) {
      try {
        const session = JSON.parse(sessionCookie.value);
        userId = session.userId;
      } catch {
        // Invalid session
      }
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!pendingSecret) {
      return NextResponse.json({ 
        error: 'ไม่พบข้อมูลการตั้งค่า กรุณาเริ่มใหม่' 
      }, { status: 400 });
    }
    
    const body = await request.json();
    const { code } = body;
    
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'กรุณากรอกรหัส 6 หลัก' }, { status: 400 });
    }
    
    // Verify the code with pending secret
    const isValid = verify2FACode(pendingSecret, code);
    
    if (!isValid) {
      return NextResponse.json({ error: 'รหัสไม่ถูกต้อง กรุณาลองใหม่' }, { status: 400 });
    }
    
    // Get backup codes
    let backupCodes: string[] = [];
    if (pendingBackup) {
      try {
        backupCodes = JSON.parse(pendingBackup);
      } catch {
        backupCodes = generateBackupCodes(8);
      }
    } else {
      backupCodes = generateBackupCodes(8);
    }
    
    // Enable 2FA in database
    const success = await enable2FA(userId, pendingSecret, backupCodes);
    
    if (!success) {
      return NextResponse.json({ error: 'ไม่สามารถเปิดใช้งาน 2FA ได้' }, { status: 500 });
    }
    
    // Clear temporary cookies
    cookieStore.delete('pending_2fa_setup');
    cookieStore.delete('pending_2fa_secret');
    cookieStore.delete('pending_2fa_backup');
    
    return NextResponse.json({
      success: true,
      message: 'ตั้งค่า 2FA สำเร็จ',
    });
    
  } catch (error) {
    console.error('2FA enable error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
