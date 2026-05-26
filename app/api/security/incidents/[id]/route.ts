import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('security_incidents')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching incident:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incident' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    
    const updateData: Record<string, unknown> = {};
    
    if (body.status) {
      updateData.status = body.status;
      
      if (body.status === 'resolved' || body.status === 'false_positive') {
        updateData.resolution = body.resolution || 'Resolved by admin';
        updateData.resolved_at = new Date().toISOString();
      }
    }
    
    if (body.assigned_to) {
      updateData.assigned_to = body.assigned_to;
    }
    
    const { data, error } = await supabase
      .from('security_incidents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Log the update
    await supabase.from('audit_logs').insert({
      actor_type: 'admin',
      action: 'incident_updated',
      resource_type: 'security_incident',
      resource_id: id,
      details: updateData
    });
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { error: 'Failed to update incident' },
      { status: 500 }
    );
  }
}
