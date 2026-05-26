import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let query = supabase
      .from('security_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching security incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security incidents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('security_incidents')
      .insert({
        tenant_id: body.tenant_id,
        incident_type: body.incident_type,
        severity: body.severity,
        title: body.title,
        description: body.description,
        affected_users: body.affected_users || [],
        affected_resources: body.affected_resources || [],
        source_ip: body.source_ip,
        evidence: body.evidence || {},
        status: 'open'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating security incident:', error);
    return NextResponse.json(
      { error: 'Failed to create security incident' },
      { status: 500 }
    );
  }
}
