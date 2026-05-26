import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

// Default admin credentials - should be overridden via environment variables
const DEFAULT_ADMIN = {
  username: process.env.SEED_ADMIN_USERNAME || 'admin',
  password: process.env.SEED_ADMIN_PASSWORD || 'CHANGE_ME_' + Math.random().toString(36).substring(2, 10),
  name: 'Super Admin',
  display_name: 'Super Admin',
  role: 'super_admin',
};

/**
 * GET - Auto seed admin if none exists (for first-time setup)
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Check if any admin exists
    const { data: existingAdmins, error: checkError } = await supabase
      .from('users')
      .select('id, username, role')
      .in('role', ['super_admin', 'admin'])
      .limit(1);

    if (checkError) {
      console.error('[v0] Check admin error:', checkError);
      return NextResponse.json({ 
        error: 'Database error', 
        details: checkError.message 
      }, { status: 500 });
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Admin already exists',
        admin: {
          username: existingAdmins[0].username,
          role: existingAdmins[0].role,
        },
      });
    }

    // No admin exists - create default admin
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

    const { data: admin, error: createError } = await supabase
      .from('users')
      .insert({
        username: DEFAULT_ADMIN.username,
        password_hash: passwordHash,
        name: DEFAULT_ADMIN.name,
        display_name: DEFAULT_ADMIN.display_name,
        role: DEFAULT_ADMIN.role,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select('id, username, role')
      .single();

    if (createError) {
      console.error('[v0] Create admin error:', createError);
      return NextResponse.json({ 
        error: 'Failed to create admin', 
        details: createError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Default admin created successfully',
      admin: {
        username: admin.username,
        role: admin.role,
      },
      credentials: {
        username: DEFAULT_ADMIN.username,
        password: DEFAULT_ADMIN.password,
      },
    });
  } catch (error) {
    console.error('[v0] Seed admin error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to seed admin' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name, secret } = body;

    // Validate setup secret (prevent unauthorized admin creation)
    const setupSecret = process.env.SETUP_SECRET || 'fin-lotto-setup-2024';
    if (secret !== setupSecret) {
      return NextResponse.json({ error: 'Invalid setup secret' }, { status: 403 });
    }

    // Validate input
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if any admin exists
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Only allow if no users exist OR user provides correct secret
    if (count && count > 0) {
      // Check if this specific admin exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Admin already exists' }, { status: 400 });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin
    const { data: admin, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        name: name || 'Admin',
        role: count === 0 ? 'super_admin' : 'admin',
        is_active: true,
      })
      .select('id, username, name, role')
      .single();

    if (error) {
      console.error('Create admin error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin created successfully',
      admin,
    });
  } catch (error) {
    console.error('Seed admin error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to create admin' 
    }, { status: 500 });
  }
}

/**
 * PUT - Force create or update admin (for setup/recovery)
 * This creates 'admin' user with password 'admin123' regardless of existing users
 */
export async function PUT() {
  try {
    const supabase = await createClient();

    // Check if admin user exists
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('username', DEFAULT_ADMIN.username)
      .maybeSingle();

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

    if (existingAdmin) {
      // Update existing admin
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          role: DEFAULT_ADMIN.role,
          is_active: true,
        })
        .eq('id', existingAdmin.id);

      if (updateError) {
        return NextResponse.json({ 
          error: 'Failed to update admin', 
          details: updateError.message 
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Admin password reset successfully',
        credentials: {
          username: DEFAULT_ADMIN.username,
          password: DEFAULT_ADMIN.password,
        },
      });
    }

    // Create new admin user
    const { data: admin, error: createError } = await supabase
      .from('users')
      .insert({
        username: DEFAULT_ADMIN.username,
        password_hash: passwordHash,
        name: DEFAULT_ADMIN.name,
        display_name: DEFAULT_ADMIN.display_name,
        role: DEFAULT_ADMIN.role,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select('id, username, role')
      .single();

    if (createError) {
      return NextResponse.json({ 
        error: 'Failed to create admin', 
        details: createError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin created successfully',
      admin: {
        username: admin.username,
        role: admin.role,
      },
      credentials: {
        username: DEFAULT_ADMIN.username,
        password: DEFAULT_ADMIN.password,
      },
    });
  } catch (error) {
    console.error('[v0] Force seed admin error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to seed admin' 
    }, { status: 500 });
  }
}
