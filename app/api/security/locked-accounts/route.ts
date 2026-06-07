import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('locked_accounts')
    .select(`
      *,
      users:user_id (id, username, name),
      customers:customer_id (id, username, name, phone)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('locked-accounts error:', error.message);
    // Return empty array instead of error for UI compatibility
    return NextResponse.json([]);
  }

  return NextResponse.json(data || []);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('locked_accounts')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
