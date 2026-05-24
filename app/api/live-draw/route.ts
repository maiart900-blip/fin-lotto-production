import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery_id');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    let query = supabase
      .from('live_draw_sessions')
      .select(`
        *,
        lottery:lotteries(id, name, icon, result_time)
      `)
      .eq('draw_date', date)
      .order('created_at', { ascending: false });

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[v0] Live draw GET error:', error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[v0] Live draw GET exception:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lottery_id, draw_date } = body;

    if (!lottery_id || !draw_date) {
      return NextResponse.json({ error: 'lottery_id and draw_date are required' }, { status: 400 });
    }

    // Check if session already exists
    const { data: existing } = await supabase
      .from('live_draw_sessions')
      .select('id')
      .eq('lottery_id', lottery_id)
      .eq('draw_date', draw_date)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Session already exists for this lottery and date' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('live_draw_sessions')
      .insert({
        lottery_id,
        draw_date,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating live draw session:', error);
    return NextResponse.json({ error: 'Failed to create live draw session' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, action, top_result, bottom_result } = body;

    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'start_spinning':
        updateData = {
          status: 'spinning',
          spinning_started_at: new Date().toISOString(),
        };
        break;
      case 'stop':
        updateData = {
          status: 'stopped',
          stopped_at: new Date().toISOString(),
          top_result,
          bottom_result,
        };
        break;
      case 'complete':
        // Get session first
        const { data: session } = await supabase
          .from('live_draw_sessions')
          .select('*')
          .eq('id', id)
          .single();

        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Calculate derived results
        const sixTop = session.top_result || top_result;
        const threeTop = sixTop ? sixTop.slice(-3) : null;
        const twoTop = threeTop ? threeTop.slice(-2) : null;
        const twoBot = session.bottom_result || bottom_result;
        const runTop = threeTop ? threeTop.slice(-1) : null;
        const runBot = twoBot ? twoBot.slice(-1) : null;

        // Update session status
        updateData = { status: 'completed' };

        // Create or update lottery_results
        const { error: resultError } = await supabase
          .from('lottery_results')
          .upsert({
            lottery_id: session.lottery_id,
            draw_date: session.draw_date,
            six_top: sixTop,
            three_top: threeTop,
            two_top: twoTop,
            two_bot: twoBot,
            run_top: runTop,
            run_bot: runBot,
          }, {
            onConflict: 'lottery_id,draw_date',
          });

        if (resultError) {
          console.error('Error saving lottery result:', resultError);
        }
        break;
      case 'update_result':
        updateData = {
          top_result: top_result || undefined,
          bottom_result: bottom_result || undefined,
        };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('live_draw_sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating live draw session:', error);
    return NextResponse.json({ error: 'Failed to update live draw session' }, { status: 500 });
  }
}
