import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('slip_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Slip uploads fetch error:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Slip uploads error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('slip_uploads')
      .insert({
        type: body.type,
        amount: body.amount,
        slip_url: body.slip_url || null,
        note: body.note || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Slip upload insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Slip upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
