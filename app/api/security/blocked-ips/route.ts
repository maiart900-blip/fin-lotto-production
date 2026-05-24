import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { blockIP } from '@/lib/security';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('blocked_ips')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { ip_address, reason, duration_minutes = 30, blocked_by } = body;

  await blockIP(ip_address, reason, duration_minutes, blocked_by);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const ip = searchParams.get('ip');

  if (!ip) {
    return NextResponse.json({ error: 'IP required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('blocked_ips')
    .delete()
    .eq('ip_address', ip);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
