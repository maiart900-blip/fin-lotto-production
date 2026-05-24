import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

export async function GET() {
  // Auth guard - require super_admin for security settings
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('key');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert to object
  const settings: Record<string, string> = {};
  data?.forEach((item) => {
    settings[item.key] = item.value;
  });

  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { key, value, user_id } = body;

  const { error } = await supabase
    .from('system_settings')
    .update({ value, updated_by: user_id, updated_at: new Date().toISOString() })
    .eq('key', key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
