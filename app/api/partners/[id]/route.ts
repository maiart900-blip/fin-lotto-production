import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;
  const body = await request.json();
  
  // Get current partner for history tracking
  const { data: currentPartner } = await supabase
    .from('partners')
    .select('share_percent')
    .eq('id', id)
    .single();

  // Track percent change if changed
  if (currentPartner && body.sharePercent !== undefined && 
      Number(currentPartner.share_percent) !== Number(body.sharePercent)) {
    // Get current user from session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    let userId = null;
    if (sessionCookie) {
      try {
        const session = JSON.parse(sessionCookie.value);
        userId = session.id;
      } catch {}
    }

    await supabase.from('partner_percent_history').insert({
      partner_id: id,
      old_percent: currentPartner.share_percent,
      new_percent: body.sharePercent,
      changed_by: userId,
    });
  }

  const { data, error } = await supabase
    .from('partners')
    .update({
      name: body.name,
      phone: body.phone || null,
      share_percent: body.sharePercent,
      is_active: body.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  const { error } = await supabase
    .from('partners')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
