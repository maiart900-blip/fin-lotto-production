import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/api-auth';

// API สำหรับเว็บกลาง - จัดการยอดส่งของเอเย่น

export async function GET(request: Request) {
  try {
    // Auth guard - require super_admin for master settlements
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const agentId = searchParams.get('agent_id');

    const supabase = await createClient();

    let query = supabase
      .from('agent_settlements')
      .select(`
        *,
        agents:agent_id (id, name, code)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq('status', status);
    }

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data: settlements, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      settlements: settlements || [],
    });
  } catch (error) {
    console.error('Master settlements error:', error);
    return NextResponse.json({ error: 'Failed to get settlements' }, { status: 500 });
  }
}

// PATCH - อัพเดทสถานะยอดส่ง
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { settlement_id, status, note } = body;

    if (!settlement_id || !status) {
      return NextResponse.json({ error: 'settlement_id and status are required' }, { status: 400 });
    }

    const supabase = await createClient();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    if (note) {
      updateData.note = note;
    }

    const { data, error } = await supabase
      .from('agent_settlements')
      .update(updateData)
      .eq('id', settlement_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      settlement: data,
    });
  } catch (error: any) {
    console.error('Master settlement update error:', error);
    return NextResponse.json({ error: 'Failed to update settlement', detail: error?.message }, { status: 500 });
  }
}
