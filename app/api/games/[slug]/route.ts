import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // Check if slug is a UUID (id) or actual slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    let query = supabase
      .from('games')
      .select(`
        *,
        provider:game_providers(id, name, slug, logo_url)
      `)
      .eq('is_active', true);

    if (isUUID) {
      query = query.eq('id', slug);
    } else {
      query = query.eq('slug', slug);
    }

    const { data: game, error } = await query.single();

    if (error || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Increment play count
    await supabase
      .from('games')
      .update({ play_count: (game.play_count || 0) + 1 })
      .eq('id', game.id);

    return NextResponse.json({ game });
  } catch (error) {
    console.error('Game API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // Check if slug is a UUID (id) or actual slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    // Build update object - only include provided fields
    const updateData: Record<string, unknown> = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.game_type !== undefined) updateData.game_type = body.game_type;
    if (body.category_id !== undefined) updateData.category_id = body.category_id;
    if (body.provider_id !== undefined) updateData.provider_id = body.provider_id;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.game_url !== undefined) updateData.game_url = body.game_url;
    if (body.rtp !== undefined) updateData.rtp = body.rtp;
    if (body.volatility !== undefined) updateData.volatility = body.volatility;
    if (body.min_bet !== undefined) updateData.min_bet = body.min_bet;
    if (body.max_bet !== undefined) updateData.max_bet = body.max_bet;
    if (body.is_hot !== undefined) updateData.is_hot = body.is_hot;
    if (body.is_new !== undefined) updateData.is_new = body.is_new;
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
    if (body.is_jackpot !== undefined) updateData.is_jackpot = body.is_jackpot;
    if (body.is_live !== undefined) updateData.is_live = body.is_live;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    let query = supabase.from('games').update(updateData);

    if (isUUID) {
      query = query.eq('id', slug);
    } else {
      query = query.eq('slug', slug);
    }

    const { data, error } = await query.select(`
      *,
      provider:game_providers(id, name, slug, logo_url)
    `).single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Game PUT API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = await createClient();

    // Check if slug is a UUID (id) or actual slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    let query = supabase.from('games').delete();

    if (isUUID) {
      query = query.eq('id', slug);
    } else {
      query = query.eq('slug', slug);
    }

    const { error } = await query;

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Game DELETE API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
