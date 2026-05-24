import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// POST - Follow/Unfollow a lead user
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;

    if (!customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lead_user_id, action } = body; // action: 'follow' | 'unfollow'

    if (!lead_user_id) {
      return NextResponse.json({ error: 'Missing lead_user_id' }, { status: 400 });
    }

    if (lead_user_id === customerId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if lead user exists
    const { data: leadUser, error: leadError } = await supabase
      .from('customers')
      .select('id, is_lead_user')
      .eq('id', lead_user_id)
      .eq('is_lead_user', true)
      .single();

    if (leadError || !leadUser) {
      return NextResponse.json({ error: 'Lead user not found' }, { status: 404 });
    }

    if (action === 'follow') {
      // Check if already following
      const { data: existing } = await supabase
        .from('lead_followers')
        .select('id')
        .eq('follower_id', customerId)
        .eq('lead_user_id', lead_user_id)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Already following' }, { status: 400 });
      }

      // Create follow record
      const { error: followError } = await supabase
        .from('lead_followers')
        .insert({
          follower_id: customerId,
          lead_user_id: lead_user_id,
        });

      if (followError) {
        console.error('[API] Follow error:', followError);
        return NextResponse.json({ error: 'Failed to follow' }, { status: 500 });
      }

      // Update followers count
      await supabase.rpc('increment_followers_count', { user_id: lead_user_id });

      return NextResponse.json({ success: true, action: 'followed' });
    } else if (action === 'unfollow') {
      // Delete follow record
      const { error: unfollowError } = await supabase
        .from('lead_followers')
        .delete()
        .eq('follower_id', customerId)
        .eq('lead_user_id', lead_user_id);

      if (unfollowError) {
        console.error('[API] Unfollow error:', unfollowError);
        return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 });
      }

      // Decrement followers count
      await supabase.rpc('decrement_followers_count', { user_id: lead_user_id });

      return NextResponse.json({ success: true, action: 'unfollowed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[API] Follow exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Check if following a lead user
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const customerId = cookieStore.get('customer_id')?.value;

    if (!customerId) {
      return NextResponse.json({ following: [] });
    }

    const { searchParams } = new URL(request.url);
    const leadUserId = searchParams.get('lead_user_id');

    const supabase = await createClient();

    if (leadUserId) {
      // Check specific lead user
      const { data } = await supabase
        .from('lead_followers')
        .select('id')
        .eq('follower_id', customerId)
        .eq('lead_user_id', leadUserId)
        .single();

      return NextResponse.json({ is_following: !!data });
    } else {
      // Get all followed lead users
      const { data } = await supabase
        .from('lead_followers')
        .select('lead_user_id')
        .eq('follower_id', customerId);

      return NextResponse.json({ 
        following: (data || []).map(f => f.lead_user_id) 
      });
    }
  } catch (err) {
    console.error('[API] Check following exception:', err);
    return NextResponse.json({ following: [] });
  }
}
