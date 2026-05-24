import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Fetch all lead users with their stats
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sort') || 'profit'; // profit, win_rate, followers
    const limit = parseInt(searchParams.get('limit') || '20');
    const isAdmin = searchParams.get('admin') === 'true';
    const userId = searchParams.get('id');
    
    // Get single user by ID
    if (userId) {
      const { data: user, error } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          username,
          phone,
          avatar_url,
          lead_badge,
          bio,
          is_pinned,
          lead_user_stats (
            total_profit,
            today_profit,
            week_profit,
            month_profit,
            total_bets,
            winning_bets,
            win_rate,
            followers_count,
            copy_count
          )
        `)
        .eq('id', userId)
        .eq('is_lead_user', true)
        .single();
      
      if (error || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      return NextResponse.json(user);
    }

    // Get lead users with their stats
    const { data: leadUsers, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        username,
        ${isAdmin ? 'phone,' : ''}
        avatar_url,
        lead_badge,
        bio,
        is_pinned,
        created_at,
        lead_user_stats (
          total_profit,
          today_profit,
          week_profit,
          month_profit,
          total_bets,
          winning_bets,
          win_rate,
          followers_count,
          copy_count,
          last_bet_at
        )
      `)
      .eq('is_lead_user', true)
      .limit(limit);

    if (error) {
      console.error('[API] Error fetching lead users:', error);
      return NextResponse.json({ error: 'Failed to fetch lead users' }, { status: 500 });
    }

    // Sort by selected criteria
    const sortedUsers = (leadUsers || []).sort((a: any, b: any) => {
      const statsA = a.lead_user_stats?.[0] || {};
      const statsB = b.lead_user_stats?.[0] || {};
      
      // Pinned users always first
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      
      switch (sortBy) {
        case 'profit':
          return (statsB.total_profit || 0) - (statsA.total_profit || 0);
        case 'win_rate':
          return (statsB.win_rate || 0) - (statsA.win_rate || 0);
        case 'followers':
          return (statsB.followers_count || 0) - (statsA.followers_count || 0);
        case 'today':
          return (statsB.today_profit || 0) - (statsA.today_profit || 0);
        default:
          return (statsB.total_profit || 0) - (statsA.total_profit || 0);
      }
    });

    // Flatten stats for easier consumption
    const formattedUsers = sortedUsers.map((user: any) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      phone: user.phone,
      avatar_url: user.avatar_url,
      lead_badge: user.lead_badge,
      bio: user.bio,
      is_pinned: user.is_pinned,
      lead_user_stats: user.lead_user_stats,
      ...(user.lead_user_stats?.[0] || {
        total_profit: 0,
        today_profit: 0,
        week_profit: 0,
        month_profit: 0,
        total_bets: 0,
        winning_bets: 0,
        win_rate: 0,
        followers_count: 0,
        copy_count: 0,
        last_bet_at: null,
      }),
    }));

    return NextResponse.json(formattedUsers);
  } catch (err) {
    console.error('[API] Lead users exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add new lead user (Admin only)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { customer_id, lead_badge, bio, is_pinned } = body;
    
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
    }
    
    // Update customer to be lead user
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        is_lead_user: true,
        lead_badge: lead_badge || null,
        bio: bio || null,
        is_pinned: is_pinned || false,
      })
      .eq('id', customer_id);
    
    if (updateError) {
      console.error('[API] Error adding lead user:', updateError);
      return NextResponse.json({ error: 'Failed to add lead user' }, { status: 500 });
    }
    
    // Create stats record
    await supabase
      .from('lead_user_stats')
      .insert({ customer_id })
      .select()
      .single();
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] Add lead user exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update lead user (Admin only)
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { customer_id, lead_badge, bio, is_pinned } = body;
    
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
    }
    
    const updateData: any = {};
    if (lead_badge !== undefined) updateData.lead_badge = lead_badge;
    if (bio !== undefined) updateData.bio = bio;
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned;
    
    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customer_id);
    
    if (error) {
      console.error('[API] Error updating lead user:', error);
      return NextResponse.json({ error: 'Failed to update lead user' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] Update lead user exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove lead user status (Admin only)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { customer_id } = body;
    
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
    }
    
    // Remove lead user status
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        is_lead_user: false,
        lead_badge: null,
        is_pinned: false,
      })
      .eq('id', customer_id);
    
    if (updateError) {
      console.error('[API] Error removing lead user:', updateError);
      return NextResponse.json({ error: 'Failed to remove lead user' }, { status: 500 });
    }
    
    // Delete stats
    await supabase
      .from('lead_user_stats')
      .delete()
      .eq('customer_id', customer_id);
    
    // Delete followers
    await supabase
      .from('lead_followers')
      .delete()
      .eq('lead_user_id', customer_id);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API] Remove lead user exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
