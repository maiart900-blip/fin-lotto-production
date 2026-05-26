import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('user_id');
    const ipAddress = searchParams.get('ip_address');
    const successOnly = searchParams.get('success_only') === 'true';
    const failedOnly = searchParams.get('failed_only') === 'true';
    
    let query = supabase
      .from('login_attempts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (ipAddress) {
      query = query.eq('ip_address', ipAddress);
    }
    
    if (successOnly) {
      query = query.eq('is_successful', true);
    } else if (failedOnly) {
      query = query.eq('is_successful', false);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching login attempts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch login attempts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('login_attempts')
      .insert({
        user_id: body.user_id,
        user_type: body.user_type,
        tenant_id: body.tenant_id,
        username: body.username,
        ip_address: body.ip_address || 'unknown',
        user_agent: body.user_agent,
        device_fingerprint: body.device_fingerprint,
        attempt_type: body.attempt_type || 'login',
        is_successful: body.is_successful,
        failure_reason: body.failure_reason,
        geo_location: body.geo_location || {}
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error recording login attempt:', error);
    return NextResponse.json(
      { error: 'Failed to record login attempt' },
      { status: 500 }
    );
  }
}
