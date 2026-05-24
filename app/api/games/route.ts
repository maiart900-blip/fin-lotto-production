import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const type = searchParams.get('type'); // slots, casino, arcade
  const provider = searchParams.get('provider');
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const hot = searchParams.get('hot');
  const featured = searchParams.get('featured');
  const isNew = searchParams.get('new');
  const activeOnly = searchParams.get('active') !== 'false';
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('games')
    .select(`
      *,
      provider:game_providers(id, name, slug, logo_url)
    `)
    .order('sort_order', { ascending: true })
    .order('is_hot', { ascending: false })
    .order('created_at', { ascending: false });

  // Apply filters
  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  if (type) {
    query = query.eq('game_type', type);
  }
  
  if (provider) {
    query = query.eq('provider_id', provider);
  }
  
  if (category) {
    query = query.eq('category_id', category);
  }
  
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  
  if (hot === 'true') {
    query = query.eq('is_hot', true);
  }
  
  if (featured === 'true') {
    query = query.eq('is_featured', true);
  }
  
  if (isNew === 'true') {
    query = query.eq('is_new', true);
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    games: data || [],
    count: data?.length || 0,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('games')
    .insert([{
      name: body.name,
      slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
      game_type: body.game_type || 'slots',
      category_id: body.category_id,
      provider_id: body.provider_id,
      description: body.description,
      image_url: body.image_url,
      game_url: body.game_url,
      rtp: body.rtp,
      volatility: body.volatility,
      min_bet: body.min_bet || 1,
      max_bet: body.max_bet || 10000,
      is_hot: body.is_hot || false,
      is_new: body.is_new || false,
      is_featured: body.is_featured || false,
      is_jackpot: body.is_jackpot || false,
      is_live: body.is_live || false,
      tags: body.tags || [],
      sort_order: body.sort_order || 0,
      is_active: body.is_active !== false,
    }])
    .select(`
      *,
      provider:game_providers(id, name, slug, logo_url)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
