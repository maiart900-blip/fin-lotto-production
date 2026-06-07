import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      tenant_id, 
      error_type = 'error', 
      title, 
      message, 
      path, 
      user_agent,
      stack_trace 
    } = body;
    
    const supabase = await createClient();
    
    // Get tenant info
    let tenantId = tenant_id;
    
    if (!tenantId) {
      // Get master tenant as fallback
      const { data: masterTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('is_master', true)
        .single();
      
      tenantId = masterTenant?.id;
    }
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }
    
    // Create alert
    const { data: alert, error: insertError } = await supabase
      .from('tenant_alerts')
      .insert({
        tenant_id: tenantId,
        alert_type: error_type,
        title: title || 'Unknown Error',
        message: JSON.stringify({
          message,
          path,
          user_agent,
          stack_trace,
          timestamp: new Date().toISOString(),
        }),
        is_read: false,
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // TODO: Send Telegram notification
    // await sendTelegramAlert(alert);
    
    return NextResponse.json({
      success: true,
      alert_id: alert?.id,
    });
  } catch (error) {
    console.error('Error report failed:', error);
    return NextResponse.json({ error: 'Failed to report error' }, { status: 500 });
  }
}

// GET: Fetch all unread alerts (Master Admin)
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: alerts, error } = await supabase
      .from('tenant_alerts')
      .select(`
        *,
        tenants:tenant_id (name, slug)
      `)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    return NextResponse.json(alerts || []);
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
