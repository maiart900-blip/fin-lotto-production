import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Fetch all bot settings
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('bot_announcement_settings')
      .select('*')
      .order('platform');

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update bot settings
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { platform, ...settings } = body;

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    // Check if settings exist for this platform
    const { data: existing } = await supabase
      .from('bot_announcement_settings')
      .select('id')
      .eq('platform', platform)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('bot_announcement_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('platform', platform)
        .select()
        .single();
    } else {
      // Insert new
      result = await supabase
        .from('bot_announcement_settings')
        .insert({ platform, ...settings })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete bot settings
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('bot_announcement_settings')
      .delete()
      .eq('platform', platform);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
