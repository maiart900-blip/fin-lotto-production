import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('user_id');
    const tableName = searchParams.get('table_name');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        user:users(id, username, display_name),
        customer:customers(id, name, phone)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action && action !== 'all') {
      query = query.eq('action', action);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (tableName) {
      query = query.eq('table_name', tableName);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Get unique actions for filter
    const { data: actions } = await supabase
      .from('audit_logs')
      .select('action')
      .limit(1000);

    const uniqueActions = [...new Set(actions?.map(a => a.action) || [])];

    return NextResponse.json({ 
      logs: data, 
      total: count,
      actions: uniqueActions,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating audit log:', error);
    return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 });
  }
}
