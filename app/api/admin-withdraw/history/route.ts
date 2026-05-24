import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/api-auth';

export async function GET() {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('admin_withdrawals')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 49);

    if (error) {
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}
