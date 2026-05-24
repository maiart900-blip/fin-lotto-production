import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const userId = cookieStore.get('admin_id')?.value;

  if (!userId) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from('trusted_devices')
    .select('*')
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false });

  if (error) {
    return NextResponse.json([]);
  }

  return NextResponse.json(data || []);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const userId = cookieStore.get('admin_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('id');

  if (deviceId) {
    await supabase
      .from('trusted_devices')
      .delete()
      .eq('id', deviceId)
      .eq('user_id', userId);
  } else {
    // Delete all except current
    await supabase
      .from('trusted_devices')
      .delete()
      .eq('user_id', userId);
  }

  return NextResponse.json({ success: true });
}
