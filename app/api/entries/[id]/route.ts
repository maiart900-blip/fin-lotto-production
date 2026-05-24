import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { number, betType, amount, customerId } = await request.json();
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('entries')
      .update({
        number,
        bet_type: betType,
        amount,
        customer_id: customerId || null,
      })
      .eq('id', id)
      .select('*, customer:customers(id, name)')
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
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
      .from('entries')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
