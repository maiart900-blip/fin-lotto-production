import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ site_name: 'สลากพลัส Lotto' });
  }
}

export async function PUT(request: Request) {
  try {
    const { siteName, turnover_enabled, turnover_percentage } = await request.json();
    const supabase = await createClient();
    
    const updateData: Record<string, unknown> = { 
      updated_at: new Date().toISOString() 
    };
    
    if (siteName !== undefined) {
      updateData.site_name = siteName;
    }
    if (turnover_enabled !== undefined) {
      updateData.turnover_enabled = turnover_enabled;
    }
    if (turnover_percentage !== undefined) {
      updateData.turnover_percentage = Math.min(100, Math.max(1, turnover_percentage));
    }
    
    const { data, error } = await supabase
      .from('settings')
      .update(updateData)
      .eq('id', 1)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
