import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'finlotto-master-secret-key';

interface MasterTokenPayload {
  userId: string;
  username: string;
  role: string;
  isMaster: boolean;
  tenantAccess: 'all' | string[];
  permissions: string[];
  exp: number;
}

// Generate Master Token for Super Admin
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const supabase = await createClient();
    
    // Verify Super Admin credentials
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('role', 'super_admin')
      .single();
    
    if (userError || !user) {
      return NextResponse.json({ 
        error: 'Invalid credentials or not a Super Admin' 
      }, { status: 401 });
    }
    
    // Verify password (bcrypt compare)
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
    
    // Generate Master Token with full access
    const payload: MasterTokenPayload = {
      userId: user.id,
      username: user.username,
      role: 'super_admin',
      isMaster: true,
      tenantAccess: 'all',
      permissions: [
        'manage_all_tenants',
        'manage_all_users',
        'manage_all_settings',
        'view_all_reports',
        'override_security',
        'impersonate_users',
        'manage_finances',
        'system_admin',
      ],
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
    
    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('master_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });
    
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
      permissions: payload.permissions,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    });
  } catch (err) {
    console.error('[v0] Master token error:', err);
    return NextResponse.json({ error: 'Token generation failed' }, { status: 500 });
  }
}

// Verify Master Token
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('master_token')?.value;
    
    const token = authHeader?.replace('Bearer ', '') || cookieToken;
    
    if (!token) {
      return NextResponse.json({ 
        valid: false, 
        error: 'No token provided' 
      }, { status: 401 });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as MasterTokenPayload;
      
      return NextResponse.json({
        valid: true,
        user: {
          userId: decoded.userId,
          username: decoded.username,
          role: decoded.role,
        },
        isMaster: decoded.isMaster,
        tenantAccess: decoded.tenantAccess,
        permissions: decoded.permissions,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
      });
    } catch {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid or expired token' 
      }, { status: 401 });
    }
  } catch (err) {
    console.error('[v0] Token verify error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

// Revoke Master Token
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('master_token');
    
    return NextResponse.json({ success: true, message: 'Token revoked' });
  } catch (err) {
    console.error('[v0] Token revoke error:', err);
    return NextResponse.json({ error: 'Revoke failed' }, { status: 500 });
  }
}
