import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'finlotto-master-secret-key';

// POST - Login as another user (impersonate)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { userId, adminId, reason } = body;

    // Verify admin has permission
    const cookieStore = await cookies();
    const masterToken = cookieStore.get('master_token')?.value;
    
    if (!masterToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify master token
    let adminPayload;
    try {
      adminPayload = jwt.verify(masterToken, JWT_SECRET) as { role: string; userId: string };
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!['super_admin', 'owner'].includes(adminPayload.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Get target user
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, username, display_name, role, tenant_id, is_active')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create impersonation token
    const impersonateToken = jwt.sign(
      {
        userId: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
        tenantId: targetUser.tenant_id,
        impersonatedBy: adminPayload.userId,
        isImpersonation: true,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      },
      JWT_SECRET
    );

    // Log impersonation
    await supabase.from('audit_logs').insert({
      action: 'user_impersonation',
      actor_id: adminPayload.userId,
      target_type: 'user',
      target_id: targetUser.id,
      details: {
        targetUsername: targetUser.username,
        targetRole: targetUser.role,
        reason,
      },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    });

    // Set impersonation cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        display_name: targetUser.display_name,
        role: targetUser.role,
      },
      redirectUrl: targetUser.role === 'customer' ? '/c' : '/',
    });

    response.cookies.set('impersonate_token', impersonateToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
      path: '/',
    });

    // Store original admin token for returning
    response.cookies.set('original_admin_token', masterToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Impersonate error:', error);
    return NextResponse.json({ error: 'Failed to impersonate' }, { status: 500 });
  }
}

// DELETE - End impersonation
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const originalToken = cookieStore.get('original_admin_token')?.value;

    const response = NextResponse.json({ success: true, redirectUrl: '/' });

    // Clear impersonation
    response.cookies.delete('impersonate_token');
    response.cookies.delete('original_admin_token');

    // Restore original token if exists
    if (originalToken) {
      response.cookies.set('master_token', originalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('End impersonate error:', error);
    return NextResponse.json({ error: 'Failed to end impersonation' }, { status: 500 });
  }
}
