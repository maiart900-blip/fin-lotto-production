import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Get tenant alerts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    
    const supabase = await createClient();
    
    let query = supabase
      .from('tenant_alerts')
      .select('*')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: alerts, error } = await query;

    if (error) throw error;

    return NextResponse.json(alerts || []);
  } catch (err) {
    console.error('Get tenant alerts error:', err);
    return NextResponse.json({ error: 'ไม่สามารถโหลดการแจ้งเตือนได้' }, { status: 500 });
  }
}

// POST - Create new alert (called from sub-sites on error)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { alert_type, title, message } = body;

    if (!alert_type || !title) {
      return NextResponse.json(
        { error: 'กรุณาระบุประเภทและหัวข้อการแจ้งเตือน' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: alert, error } = await supabase
      .from('tenant_alerts')
      .insert({
        tenant_id: id,
        alert_type,
        title,
        message,
        is_read: false
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Send Telegram notification for critical alerts
    if (alert_type === 'critical' || alert_type === 'error') {
      // await sendTelegramNotification(alert);
      console.log(`[ALERT] ${alert_type}: ${title} - ${message}`);
    }

    return NextResponse.json(alert);
  } catch (err) {
    console.error('Create alert error:', err);
    return NextResponse.json({ error: 'ไม่สามารถสร้างการแจ้งเตือนได้' }, { status: 500 });
  }
}

// PATCH - Mark alerts as read
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { alert_ids, mark_all_read } = body;

    const supabase = await createClient();

    if (mark_all_read) {
      await supabase
        .from('tenant_alerts')
        .update({ is_read: true })
        .eq('tenant_id', id)
        .eq('is_read', false);
    } else if (alert_ids?.length) {
      await supabase
        .from('tenant_alerts')
        .update({ is_read: true })
        .in('id', alert_ids);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Mark alerts read error:', err);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตการแจ้งเตือนได้' }, { status: 500 });
  }
}
