import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/api-auth';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    throw new Error('JWT secret is not configured');
  }

  return secret;
}

// POST - Reset user password
export async function POST(request: NextRequest) {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { userId, newPassword, reason, notifyUser } = body;

    // Verify admin has permission
    const cookieStore = await cookies();
    const masterToken = cookieStore.get('master_token')?.value;
    
    if (!masterToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify master token
    let adminPayload;
    try {
      adminPayload = jwt.verify(masterToken, getJwtSecret()) as unknown as { role: string; userId: string };
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!['super_admin', 'owner', 'admin'].includes(adminPayload.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Get target user
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, username, email, phone, role')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        password_changed_at: new Date().toISOString(),
        force_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    // Log password reset
    await supabase.from('audit_logs').insert({
      action: 'admin_password_reset',
      actor_id: adminPayload.userId,
      target_type: 'user',
      target_id: targetUser.id,
      details: {
        targetUsername: targetUser.username,
        reason,
        notifyUser,
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    });

    // TODO: Send notification to user if notifyUser is true
    // This would typically send an email or SMS

    return NextResponse.json({
      success: true,
      message: 'รีเซ็ตรหัสผ่านสำเร็จ',
      user: {
        id: targetUser.id,
        username: targetUser.username,
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
