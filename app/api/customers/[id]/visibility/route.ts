import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { visible_menus, can_key_lottery, can_approve_transactions } = body;
    
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('customers')
      .update({
        visible_menus,
        can_key_lottery,
        can_approve_transactions,
      })
      .eq('id', id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('customers')
      .select('id, visible_menus, can_key_lottery, can_approve_transactions')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch' }, { status: 500 });
  }
}
