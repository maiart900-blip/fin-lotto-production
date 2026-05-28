// Super Admin Recovery API - Bypass or reset 2FA for emergency access
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

// Recovery secret - CHANGE THIS in production or use env var
const RECOVERY_SECRET = process.env.RECOVERY_SECRET || 'finlotto-recovery-2024';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { username, password, recoverySecret, action } = body;

    // Validate recovery secret
    if (recoverySecret !== RECOVERY_SECRET) {
      return NextResponse.json({ error: 'Invalid recovery secret' }, { status: 403 });
    }

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only super_admin can use recovery
    if (user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Recovery only available for super_admin' }, { status: 403 });
    }

    // Verify password (simple check - in production use bcrypt)
    const bcrypt = await import('bcryptjs');
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    if (action === 'bypass') {
      // Bypass 2FA and login directly
      const cookieStore = await cookies();
      
      const sessionData = {
        userId: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenant_id,
        twoFactorVerified: true,
        loginAt: new Date().toISOString(),
        recoveryLogin: true,
      };

      const response = NextResponse.json({
        success: true,
        action: 'bypass',
        message: 'Emergency login successful',
        redirectTo: '/admin/dashboard',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.display_name || user.username,
        },
      });

      response.cookies.set('session', JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 2, // 2 hours only for recovery login
        path: '/',
      });

      // Log recovery login (ignore errors if audit_logs table doesn't exist)
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'recovery_login',
          metadata: { method: 'bypass' },
          created_at: new Date().toISOString(),
        });
      } catch {
        // Ignore audit log errors
      }

      return response;

    } else if (action === 'reset_2fa') {
      // Reset 2FA - delete secret and backup codes
      const { error: updateError } = await supabase
        .from('users')
        .update({
          two_factor_secret: null,
          two_factor_backup_codes: null,
          two_factor_enabled: false,
          two_factor_verified_at: null,
        })
        .eq('id', user.id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to reset 2FA' }, { status: 500 });
      }

      // Log 2FA reset (ignore errors if audit_logs table doesn't exist)
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'recovery_2fa_reset',
          metadata: { resetBy: 'recovery_api' },
          created_at: new Date().toISOString(),
        });
      } catch {
        // Ignore audit log errors
      }

      return NextResponse.json({
        success: true,
        action: 'reset_2fa',
        message: '2FA has been reset. You can now login without 2FA and set it up again.',
      });

    } else if (action === 'get_status') {
      // Get current 2FA status
      return NextResponse.json({
        success: true,
        twoFactorEnabled: user.two_factor_enabled,
        hasSecret: !!user.two_factor_secret,
        hasBackupCodes: !!user.two_factor_backup_codes && user.two_factor_backup_codes.length > 0,
        lastVerified: user.two_factor_verified_at,
      });

    } else {
      return NextResponse.json({ error: 'Invalid action. Use: bypass, reset_2fa, or get_status' }, { status: 400 });
    }

  } catch (error) {
    console.error('[Recovery API] Error:', error);
    return NextResponse.json({ 
      error: 'Recovery failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
