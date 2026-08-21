import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

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
