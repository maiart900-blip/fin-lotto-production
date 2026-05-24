import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateSecret } from 'otplib';
import QRCode from 'qrcode';

// POST - Generate TOTP secret and QR code for authenticator app
export async function POST(request: Request) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  
  try {
    const body = await request.json();
    const { userType = 'admin', userId: bodyUserId } = body;
    
    // ใช้ userId จาก body ก่อน ถ้าไม่มีให้ใช้จาก cookie
    const userId = bodyUserId || cookieStore.get('admin_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - No user ID provided' }, { status: 401 });
    }

    // Try to get user info from users table first, then admins table
    let user = null;
    
    const { data: userData } = await supabase
      .from('users')
      .select('username, display_name, email')
      .eq('id', userId)
      .single();
    
    if (userData) {
      user = userData;
    } else {
      // Fallback to admins table
      const { data: adminData } = await supabase
        .from('admins')
        .select('username, name, email')
        .eq('id', userId)
        .single();
      
      if (adminData) {
        user = {
          username: adminData.username,
          display_name: adminData.name,
          email: adminData.email
        };
      }
    }

    // If still no user, create a temporary identifier
    if (!user) {
      user = {
        username: `user_${userId.substring(0, 8)}`,
        display_name: 'User',
        email: null
      };
    }

    // Generate TOTP secret using otplib v13 functional API
    const secret = generateSecret();
    
    // Create otpauth URL manually
    const appName = 'FIN LOTTO';
    const accountName = user.email || user.username || user.display_name || 'user';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(appName)}&algorithm=SHA1&digits=6&period=30`;

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store pending TOTP setup
    const { error: upsertError } = await supabase
      .from('two_factor_settings')
      .upsert({
        user_id: userId,
        secret_key: secret,
        method: 'authenticator',
        is_enabled: false,
        failed_attempts: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('[v0] 2FA upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save 2FA settings: ' + upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
      message: 'สแกน QR Code ด้วย Google Authenticator',
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    return NextResponse.json({ error: 'Failed to setup TOTP' }, { status: 500 });
  }
}
