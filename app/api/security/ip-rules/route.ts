import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const ruleType = searchParams.get('type');
    const appliesTo = searchParams.get('applies_to');
    const activeOnly = searchParams.get('active_only') !== 'false';
    
    let query = supabase
      .from('ip_access_rules')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (ruleType && ruleType !== 'all') {
      query = query.eq('rule_type', ruleType);
    }
    
    if (appliesTo && appliesTo !== 'all') {
      query = query.eq('applies_to', appliesTo);
    }
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Filter out expired rules
    const now = new Date();
    const filteredData = (data || []).filter(rule => 
      !rule.expires_at || new Date(rule.expires_at) > now
    );
    
    return NextResponse.json(filteredData);
  } catch (error) {
    console.error('Error fetching IP rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IP rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('ip_access_rules')
      .insert({
        tenant_id: body.tenant_id,
        rule_type: body.rule_type,
        ip_address: body.ip_address,
        ip_range_start: body.ip_range_start,
        ip_range_end: body.ip_range_end,
        cidr: body.cidr,
        description: body.description,
        applies_to: body.applies_to || 'all',
        rate_limit_requests: body.rate_limit_requests,
        rate_limit_window_seconds: body.rate_limit_window_seconds,
        is_active: true,
        expires_at: body.expires_at,
        created_by: body.created_by
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Log the action
    await supabase.from('audit_logs').insert({
      tenant_id: body.tenant_id,
      actor_id: body.created_by,
      actor_type: 'admin',
      action: `ip_${body.rule_type}_created`,
      resource_type: 'ip_access_rule',
      resource_id: data.id,
      details: { ip_address: body.ip_address || body.cidr, applies_to: body.applies_to }
    });
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating IP rule:', error);
    return NextResponse.json(
      { error: 'Failed to create IP rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const ruleId = searchParams.get('id');
    
    if (!ruleId) {
      return NextResponse.json(
        { error: 'Missing rule ID' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('ip_access_rules')
      .delete()
      .eq('id', ruleId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'IP rule deleted' });
  } catch (error) {
    console.error('Error deleting IP rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete IP rule' },
      { status: 500 }
    );
  }
}
