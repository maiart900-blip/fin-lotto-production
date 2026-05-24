import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงรายชื่อเอเย่นที่ถูกระงับ
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'suspended';

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, username, is_active, is_agent, suspended_at, suspended_by, suspend_reason, created_at')
      .eq('is_agent', true)
      .eq('is_active', status === 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agents:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agents: data });
  } catch (error) {
    console.error('Agent suspend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - ระงับเอเย่น
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { agent_id, action, reason, suspended_by } = body;

    if (!agent_id || !action || !suspended_by) {
      return NextResponse.json(
        { error: 'กรุณาระบุข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (action === 'suspend') {
      // ระงับเอเย่น
      const { error } = await supabase
        .from('customers')
        .update({
          is_active: false,
          suspended_at: new Date().toISOString(),
          suspended_by,
          suspend_reason: reason,
        })
        .eq('id', agent_id);

      if (error) {
        console.error('Error suspending agent:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // บันทึก audit log
      await supabase.from('audit_logs').insert({
        user_id: suspended_by,
        action: 'suspend_agent',
        table_name: 'customers',
        record_id: agent_id,
        new_data: { is_active: false, suspend_reason: reason },
      });

      return NextResponse.json({
        success: true,
        message: 'ระงับเอเย่นสำเร็จ',
      });
    } else if (action === 'unsuspend') {
      // ปลดล็อคเอเย่น
      const { error } = await supabase
        .from('customers')
        .update({
          is_active: true,
          suspended_at: null,
          suspended_by: null,
          suspend_reason: null,
        })
        .eq('id', agent_id);

      if (error) {
        console.error('Error unsuspending agent:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // บันทึก audit log
      await supabase.from('audit_logs').insert({
        user_id: suspended_by,
        action: 'unsuspend_agent',
        table_name: 'customers',
        record_id: agent_id,
        new_data: { is_active: true },
      });

      return NextResponse.json({
        success: true,
        message: 'ปลดล็อคเอเย่นสำเร็จ',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Agent suspend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
