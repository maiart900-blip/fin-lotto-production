// 2FA Verify API - ยืนยันรหัส TOTP หรือ Backup Code
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { useBackupCode, verify2FACode } from '@/lib/2fa-guard';

// Force Node.js runtime for crypto compatibility
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    console.log('[v0] 2FA verify: Starting verification');
    
    const supabase = await createClient();
    const cookieStore = await cookies();
    const pendingUserId = cookieStore.get('pending_2fa_user')?.value;

    console.log('[v0] 2FA verify: pendingUserId =', pendingUserId);

    if (!pendingUserId) {
      return NextResponse.json({ error: 'No pending 2FA verification' }, { status: 400 });
    }

    const body = await request.json();
    const { code, isBackupCode } = body;
    console.log('[v0] 2FA verify: code length =', code?.length, 'isBackupCode =', isBackupCode);

    if (!code) {
      return NextResponse.json({ error: 'กรุณากรอกรหัส OTP' }, { status: 400 });
    }

    // Get user data first
    console.log('[v0] 2FA verify: Fetching user data');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, role, tenant_id, display_name, two_factor_secret, two_factor_backup_codes, failed_login_attempts, locked_until')
      .eq('id', pendingUserId)
      .single();

    if (userError) {
      console.error('[v0] 2FA verify: User fetch error:', userError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[v0] 2FA verify: User found:', user.username, 'has secret:', !!user.two_factor_secret);

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return NextResponse.json({ 
        error: 'บัญชีถูกล็อคชั่วคราว กรุณาลองใหม่ภายหลัง' 
      }, { status: 429 });
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      console.log('[v0] 2FA verify: Verifying backup code');
      isValid = await useBackupCode(pendingUserId, code);
    } else {
      // Verify TOTP code using the guard function
      console.log('[v0] 2FA verify: Verifying TOTP code');
      const secret = user.two_factor_secret;
      console.log('[v0] 2FA verify: secret exists:', !!secret, 'secret length:', secret?.length);
      
      if (secret) {
        try {
          isValid = verify2FACode(secret, code);
        } catch (verifyErr) {
          console.error('[v0] 2FA verify: verify2FACode threw:', verifyErr);
          return NextResponse.json({ 
            error: 'OTP verification failed', 
            details: verifyErr instanceof Error ? verifyErr.message : 'Unknown error' 
          }, { status: 500 });
        }
        
        // Update last verified time if valid
        if (isValid) {
          await supabase
            .from('users')
            .update({ two_factor_verified_at: new Date().toISOString() })
            .eq('id', pendingUserId);
        }
      } else {
        console.log('[v0] 2FA verify: No secret found for user');
        return NextResponse.json({ error: 'ไม่พบการตั้งค่า 2FA กรุณาตั้งค่าใหม่' }, { status: 400 });
      }
    }
    
    console.log('[v0] 2FA verify: isValid =', isValid);

    if (!isValid) {
      // Increment failed attempts
      const currentAttempts = (user.failed_login_attempts || 0) + 1;
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
        metadata: { 
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
      metadata: { isBackupCode },
      created_at: new Date().toISOString(),
    }).catch(() => {}); // Silent fail for audit log

    // Determine redirect URL based on role
    let redirectTo = '/dashboard';
    if (user.role === 'super_admin' || user.role === 'admin') {
      redirectTo = '/admin/dashboard';
    } else if (user.role === 'agent') {
      redirectTo = '/agent/dashboard';
    } else if (user.role === 'tenant_admin') {
      redirectTo = user.tenant_id ? `/t/${user.tenant_id}/admin` : '/dashboard';
    }

    // Create response with session
    const response = NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenant_id: user.tenant_id,
        displayName: user.display_name || user.username,
        redirectTo,
      },
      redirectTo,
      message: 'ยืนยันตัวตนสำเร็จ' 
    });

    // Set session cookie
    const sessionData = {
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenant_id,
      twoFactorVerified: true,
      loginAt: new Date().toISOString(),
    };

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

  } catch (error) {
    console.error('[v0] 2FA verify: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
