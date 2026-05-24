import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const agentId = request.nextUrl.searchParams.get('agent_id');
    
    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }
    
    // Check if agent_site_settings table exists, if not use site_settings with agent_id
    const { data, error } = await supabase
      .from('agent_site_settings')
      .select('*')
      .eq('agent_id', agentId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No data found - return defaults
      return NextResponse.json({
        agent_id: agentId,
        site_name: '',
        site_description: '',
        logo_url: '',
        favicon_url: '',
        login_background_url: '',
        primary_color: '#f59e0b',
        secondary_color: '#1f2937',
        accent_color: '#10b981',
        text_color: '#ffffff',
        background_color: '#0a0a0a',
        custom_domain: '',
        subdomain: '',
        is_active: true,
      });
    }
    
    if (error) {
      console.error('Error fetching agent site settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/agent-site-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const {
      agent_id,
      site_name,
      site_description,
      logo_url,
      favicon_url,
      login_background_url,
      primary_color,
      secondary_color,
      accent_color,
      text_color,
      background_color,
      custom_domain,
      subdomain,
      is_active,
    } = body;
    
    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from('agent_site_settings')
      .insert({
        agent_id,
        site_name,
        site_description,
        logo_url,
        favicon_url,
        login_background_url,
        primary_color,
        secondary_color,
        accent_color,
        text_color,
        background_color,
        custom_domain,
        subdomain,
        is_active: is_active ?? true,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating agent site settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/agent-site-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { id, agent_id, ...updates } = body;
    
    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }
    
    // If id exists, update by id, otherwise update by agent_id
    let query = supabase.from('agent_site_settings');
    
    if (id) {
      query = query.update(updates).eq('id', id);
    } else {
      // Upsert by agent_id
      const { data: existing } = await supabase
        .from('agent_site_settings')
        .select('id')
        .eq('agent_id', agent_id)
        .single();
      
      if (existing) {
        query = query.update(updates).eq('agent_id', agent_id);
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('agent_site_settings')
          .insert({ agent_id, ...updates })
          .select()
          .single();
        
        if (error) {
          console.error('Error inserting agent site settings:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        return NextResponse.json(data);
      }
    }
    
    const { data, error } = await query.select().single();
    
    if (error) {
      console.error('Error updating agent site settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in PUT /api/agent-site-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
