import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const { data, error } = await supabase
      .from('settlements')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        notes: body.notes || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error approving settlement:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Approve settlement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
