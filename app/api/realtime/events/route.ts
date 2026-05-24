import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRecentEvents } from '@/lib/realtime-events';

/**
 * GET /api/realtime/events
 * Polling endpoint for environments without WebSocket support
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get('channel') || 'admin_dashboard';
    const limit = parseInt(searchParams.get('limit') || '50');
    const since = searchParams.get('since'); // ISO timestamp

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from('realtime_events')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gt('created_at', since);
    }

    const { data: events, error } = await query;

    if (error) {
      // Fallback to Redis
      const redisEvents = await getRecentEvents(channel, limit);
      return NextResponse.json({ events: redisEvents, source: 'redis' });
    }

    // Transform to RealtimeEvent format
    const formattedEvents = events?.map(e => ({
      type: e.event_type,
      channel: e.channel,
      data: e.payload,
      timestamp: e.created_at,
      source: e.source,
    })) || [];

    return NextResponse.json({ 
      events: formattedEvents, 
      source: 'supabase',
      count: formattedEvents.length,
    });
  } catch (error) {
    console.error('Realtime events API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/realtime/events
 * Emit event (for internal use / testing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, channel, data, source } = body;

    if (!type || !channel || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, channel, data' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: event, error } = await supabase
      .from('realtime_events')
      .insert({
        event_type: type,
        channel,
        payload: data,
        source: source || 'api',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      event: {
        type: event.event_type,
        channel: event.channel,
        data: event.payload,
        timestamp: event.created_at,
        source: event.source,
      }
    });
  } catch (error) {
    console.error('Emit event error:', error);
    return NextResponse.json(
      { error: 'Failed to emit event' },
      { status: 500 }
    );
  }
}
