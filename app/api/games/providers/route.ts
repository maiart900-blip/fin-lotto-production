import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: providers, error } = await supabase
      .from('game_providers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching providers:', error);
      return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
    }

    return NextResponse.json({
      providers: providers || [],
    });
  } catch (error) {
    console.error('Providers API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
