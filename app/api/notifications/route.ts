import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const isRead = searchParams.get('is_read');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (isRead !== null && isRead !== 'all') {
      query = query.eq('is_read', isRead === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get unread count
    let countQuery = supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('is_read', false);

    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    }

    const { count: unreadCount } = await countQuery;

    return NextResponse.json({ notifications: data, unreadCount: unreadCount || 0 });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('notifications')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ids, is_read } = body;

    if (ids && Array.isArray(ids)) {
      // Mark multiple as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read })
        .in('id', ids);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (id) {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'ID or IDs required' }, { status: 400 });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clear_all');
    const userId = searchParams.get('user_id');

    if (clearAll === 'true' && userId) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .eq('is_read', true);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (id) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}
