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
    .from('security_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json([]);
  }

  return NextResponse.json(data || []);
}
