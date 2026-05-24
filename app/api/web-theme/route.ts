import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('web_theme')
    .select('*')
    .order('category')
    .order('key');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Convert to key-value object
  const theme: Record<string, string> = {};
  (data || []).forEach((item: { key: string; value: string }) => {
    theme[item.key] = item.value;
  });
  
  return NextResponse.json({ settings: data || [], theme });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  // Body can be { key, value } or { settings: [{ key, value }, ...] }
  if (body.settings && Array.isArray(body.settings)) {
    // Bulk update
    const updates = body.settings.map(async (item: { key: string; value: string }) => {
      return supabase
        .from('web_theme')
        .update({ value: item.value, updated_at: new Date().toISOString() })
        .eq('key', item.key);
    });
    
    await Promise.all(updates);
    return NextResponse.json({ success: true });
  } else if (body.key && body.value !== undefined) {
    // Single update
    const { error } = await supabase
      .from('web_theme')
      .update({ value: body.value, updated_at: new Date().toISOString() })
      .eq('key', body.key);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('web_theme')
    .upsert(body, { onConflict: 'key' })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}
