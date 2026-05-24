import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Activity Logs API
 * บันทึกทุกความเคลื่อนไหวของแอดมินและลูกสาย
 * เพื่อความโปร่งใสและตรวจสอบได้ 100%
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action');
    const userId = searchParams.get('user_id');
    const entityType = searchParams.get('entity_type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (action) query = query.eq('action', action);
    if (userId) query = query.eq('performed_by', userId);
    if (entityType) query = query.eq('entity_type', entityType);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: logs, error, count } = await query;

    if (error) throw error;

    // Get user details for logs
    const userIds = [...new Set(logs?.map(log => log.performed_by).filter(Boolean))];
    
    let users: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .in('id', userIds);
      
      userData?.forEach(user => {
        users[user.id] = user;
      });
    }

    // Enrich logs with user data
    const enrichedLogs = logs?.map(log => ({
      ...log,
      user: log.performed_by ? users[log.performed_by] : null,
    }));

    return NextResponse.json({
      success: true,
      logs: enrichedLogs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Activity logs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create activity log
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, entityType, entityId, details, performedBy, ipAddress, userAgent } = body;

    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        performed_by: performedBy,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, log: data });
  } catch (error: any) {
    console.error('Create activity log error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
