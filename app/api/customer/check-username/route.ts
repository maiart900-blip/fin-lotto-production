import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username || username.length < 4) {
      return NextResponse.json({ available: false, error: 'Username too short' });
    }

    const supabase = await createClient();
    
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    return NextResponse.json({ available: !data });
  } catch {
    return NextResponse.json({ available: true });
  }
}
