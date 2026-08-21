import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isSafeModeEnabled, toggleSafeMode } from '@/lib/security';

export async function GET() {
  const enabled = await isSafeModeEnabled();

  // Get recent logs
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from('safe_mode_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({ enabled, logs: logs || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { enable, reason, user_id } = body;

  await toggleSafeMode(enable, reason, user_id);

  return NextResponse.json({ success: true, enabled: enable });
}
