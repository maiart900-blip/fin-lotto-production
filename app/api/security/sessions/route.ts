import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('user_id');
    const userType = searchParams.get('user_type');
    
    let query = supabase
      .from('active_sessions')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('last_activity_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (userType) {
      query = query.eq('user_type', userType);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const sessionId = searchParams.get('session_id');
    const userId = searchParams.get('user_id');
    const terminateAll = searchParams.get('all') === 'true';
    
    if (sessionId) {
      // Log termination event
      await supabase.from('session_events').insert({
        session_id: sessionId,
        event_type: 'terminated',
        details: { terminated_by: 'admin', reason: 'Manual termination' }
      });
      
      // Delete single session
      const { error } = await supabase
        .from('active_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
      
      return NextResponse.json({ success: true, message: 'Session terminated' });
    }
    
    if (userId && terminateAll) {
      // Get all sessions for user
      const { data: sessions } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('user_id', userId);
      
      if (sessions?.length) {
        // Log termination events
        const events = sessions.map(s => ({
          session_id: s.id,
          event_type: 'terminated' as const,
          details: { terminated_by: 'admin', reason: 'All sessions terminated' }
        }));
        
        await supabase.from('session_events').insert(events);
        
        // Delete all sessions
        await supabase
          .from('active_sessions')
          .delete()
          .eq('user_id', userId);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Terminated ${sessions?.length || 0} sessions` 
      });
    }
    
    return NextResponse.json(
      { error: 'Missing session_id or user_id parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error terminating session:', error);
    return NextResponse.json(
      { error: 'Failed to terminate session' },
      { status: 500 }
    );
  }
}
