import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึง approval workflows
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const workflowType = searchParams.get('workflow_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('approval_workflows')
      .select('*', { count: 'exact' })
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (workflowType) {
      query = query.eq('workflow_type', workflowType);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data, total: count });
  } catch (error) {
    console.error('Error fetching approval workflows:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch approval workflows' },
      { status: 500 }
    );
  }
}

// POST - สร้าง approval workflow ใหม่
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const {
      workflow_type,
      entity_type,
      entity_id,
      requested_by,
      amount,
      current_value,
      new_value,
      reason,
      expires_at,
      metadata
    } = body;

    if (!workflow_type || !entity_type || !entity_id || !requested_by) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('approval_workflows')
      .insert({
        workflow_type,
        entity_type,
        entity_id,
        requested_by,
        amount,
        current_value,
        new_value,
        reason,
        expires_at,
        metadata,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error creating approval workflow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create approval workflow' },
      { status: 500 }
    );
  }
}

// PATCH - อนุมัติ/ปฏิเสธ workflow
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { id, action, actor_id, rejection_reason } = body;

    if (!id || !action || !actor_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let updateData: Record<string, unknown> = {};

    if (action === 'approve') {
      updateData = {
        status: 'approved',
        approved_by: actor_id,
        approved_at: new Date().toISOString()
      };
    } else if (action === 'reject') {
      updateData = {
        status: 'rejected',
        rejected_by: actor_id,
        rejected_at: new Date().toISOString(),
        rejection_reason
      };
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('approval_workflows')
      .update(updateData)
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating approval workflow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update approval workflow' },
      { status: 500 }
    );
  }
}
