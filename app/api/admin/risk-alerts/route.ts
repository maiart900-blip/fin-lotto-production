import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// Risk detection thresholds
const THRESHOLDS = {
  FREQUENT_DEPOSIT_COUNT: 5,      // ฝากเกิน 5 ครั้งใน 1 ชั่วโมง
  FREQUENT_DEPOSIT_HOURS: 1,
  LARGE_AMOUNT_SINGLE: 50000,     // ยอดเดียวเกิน 50,000
  LARGE_AMOUNT_DAILY: 200000,     // ยอดรวมต่อวันเกิน 200,000
  RAPID_WITHDRAWAL_MINUTES: 30,  // ถอนภายใน 30 นาทีหลังฝาก
  NEW_ACCOUNT_DAYS: 7,           // บัญชีใหม่ (น้อยกว่า 7 วัน)
  NEW_ACCOUNT_LARGE_TX: 10000,   // บัญชีใหม่ทำรายการเกิน 10,000
};

export async function GET(request: NextRequest) {
  try {
    // Auth guard
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Try to fetch from risk_alerts table if exists
    let alerts: any[] = [];
    let summary = { critical: 0, high: 0, medium: 0, low: 0 };

    try {
      let query = supabase
        .from('risk_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (!error && data) {
        alerts = data;
        
        // Calculate summary
        const pendingAlerts = data.filter((a: any) => a.status === 'pending');
        summary = {
          critical: pendingAlerts.filter((a: any) => a.severity === 'critical').length,
          high: pendingAlerts.filter((a: any) => a.severity === 'high').length,
          medium: pendingAlerts.filter((a: any) => a.severity === 'medium').length,
          low: pendingAlerts.filter((a: any) => a.severity === 'low').length,
        };
      }
    } catch {
      // Table doesn't exist, return mock/empty data
      alerts = [];
    }

    return NextResponse.json({ alerts, summary });
  } catch (error) {
    console.error('Risk alerts GET error:', error);
    return NextResponse.json({ alerts: [], summary: { critical: 0, high: 0, medium: 0, low: 0 } });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Auth guard
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('risk_alerts')
      .update({
        status,
        reviewed_by: session.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Risk alert update error:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Risk alerts PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new risk alert (for internal use or cron jobs)
export async function POST(request: NextRequest) {
  try {
    // Auth guard
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const supabase = await createClient();
    const body = await request.json();
    
    const {
      type,
      severity,
      customer_id,
      customer_name,
      customer_phone,
      description,
      amount,
      count,
    } = body;

    if (!type || !severity || !customer_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('risk_alerts')
      .insert({
        type,
        severity,
        customer_id,
        customer_name,
        customer_phone,
        description,
        amount,
        count,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Risk alert create error:', error);
      return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
    }

    return NextResponse.json({ success: true, alert: data });
  } catch (error) {
    console.error('Risk alerts POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
