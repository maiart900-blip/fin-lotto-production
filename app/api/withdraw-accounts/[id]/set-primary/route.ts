import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Unset all primary accounts
    await supabase
      .from('withdraw_accounts')
      .update({ is_primary: false })
      .eq('is_primary', true);

    // Set this account as primary
    const { data, error } = await supabase
      .from('withdraw_accounts')
      .update({ is_primary: true, is_active: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error setting primary withdraw account:', error);
    return NextResponse.json({ error: 'Failed to set primary account' }, { status: 500 });
  }
}
