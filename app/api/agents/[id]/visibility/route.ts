import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { visible_menus, can_create_sub_agent, can_view_reports } = body;

    const { data, error } = await supabase
      .from('agents')
      .update({
        visible_menus,
        can_create_sub_agent,
        can_view_reports,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update agent visibility error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agent: data });
  } catch (error) {
    console.error('Agent visibility error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      .from('agents')
      .select('id, username, display_name, visible_menus, can_create_sub_agent, can_view_reports, system_type, level')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agent: data });
  } catch (error) {
    console.error('Get agent visibility error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
