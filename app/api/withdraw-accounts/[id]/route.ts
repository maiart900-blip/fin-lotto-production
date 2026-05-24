import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // If setting as primary, unset other primary accounts first
    if (body.is_primary) {
      await supabase
        .from('withdraw_accounts')
        .update({ is_primary: false })
        .eq('is_primary', true)
        .neq('id', id);
    }

    const { data, error } = await supabase
      .from('withdraw_accounts')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating withdraw account:', error);
    return NextResponse.json({ error: 'Failed to update withdraw account' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('withdraw_accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting withdraw account:', error);
    return NextResponse.json({ error: 'Failed to delete withdraw account' }, { status: 500 });
  }
}
