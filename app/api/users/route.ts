import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/api-auth';

/**
 * Users API - ADMIN ONLY
 * Manages system admin users (not customers)
 */
export async function GET() {
  try {
    // Auth guard - require admin for viewing users
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, role, credit_balance, is_unlimited_credit, parent_id, hierarchy_level, created_at')
      .order('hierarchy_level', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[v0] Users GET error:', error.message);
      return NextResponse.json([]);
    }
    
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[v0] Users GET exception:', err);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    // Auth guard - require admin for creating users
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { username, password, displayName, role, is_unlimited_credit, parent_id, hierarchy_level } = await request.json();
    
    const supabase = await createClient();
    
    // Check if username exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    
    if (existing) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        display_name: displayName,
        role,
        is_unlimited_credit: is_unlimited_credit || false,
        parent_id: parent_id || null,
        hierarchy_level: hierarchy_level || 0,
        credit_balance: 0,
      })
      .select('id, username, display_name, role, credit_balance, is_unlimited_credit, parent_id, hierarchy_level, created_at')
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
