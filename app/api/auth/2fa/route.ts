import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

// GET - Get 2FA settings for current user
export async function GET() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const userId = cookieStore.get('admin_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('two_factor_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || { is_enabled: false });
}

// POST - Enable/Setup 2FA
export async function POST(request: Request) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const userId = cookieStore.get('admin_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { method = 'email', email } = body;

  // Generate backup codes
  const backupCodes = Array.from({ length: 8 }, () => 
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );

  // Upsert 2FA settings
  const { data, error } = await supabase
    .from('two_factor_settings')
    .upsert({
      user_id: userId,
      is_enabled: true,
      method,
      backup_codes: backupCodes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update user email if provided
  if (email) {
    await supabase
      .from('users')
      .update({ email, two_factor_enabled: true })
      .eq('id', userId);
  }

  // Log security event
  await supabase.from('security_logs').insert({
    user_id: userId,
    action: '2fa_enabled',
    status: 'success',
    details: { method },
  });

  return NextResponse.json({ 
    success: true, 
    backup_codes: backupCodes,
    message: 'เปิดใช้งาน 2FA สำเร็จ' 
  });
}

// DELETE - Disable 2FA
export async function DELETE() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const userId = cookieStore.get('admin_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await supabase
    .from('two_factor_settings')
    .update({ is_enabled: false })
    .eq('user_id', userId);

  await supabase
    .from('users')
    .update({ two_factor_enabled: false })
    .eq('id', userId);

  // Log security event
  await supabase.from('security_logs').insert({
    user_id: userId,
    action: '2fa_disabled',
    status: 'success',
  });

  return NextResponse.json({ success: true, message: 'ปิดใช้งาน 2FA สำเร็จ' });
}
