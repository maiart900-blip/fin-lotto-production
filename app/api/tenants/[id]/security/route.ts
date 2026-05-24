import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get tenant security settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, security_settings')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Default security settings
    const defaultSettings = {
      require_2fa_admin: true,
      require_2fa_agent: false,
      require_2fa_member: false,
      max_login_attempts: 5,
      session_timeout_minutes: 60,
      ip_whitelist_enabled: false,
      ip_whitelist: [],
      password_min_length: 8,
      password_require_uppercase: true,
      password_require_number: true,
      password_require_special: false,
      auto_logout_idle_minutes: 30,
      device_lock_enabled: false,
      max_devices_per_user: 3,
    };

    return NextResponse.json({
      tenantId: tenant.id,
      tenantName: tenant.name,
      settings: { ...defaultSettings, ...(tenant.security_settings || {}) },
    });
  } catch (err) {
    console.error('Get tenant security error:', err);
    return NextResponse.json({ error: 'Failed to get security settings' }, { status: 500 });
  }
}

// POST - Update tenant security settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Get current settings
    const { data: tenant } = await supabase
      .from('tenants')
      .select('security_settings')
      .eq('id', id)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Merge with new settings
    const updatedSettings = {
      ...(tenant.security_settings || {}),
      ...body,
      updated_at: new Date().toISOString(),
    };

    // Update tenant
    const { error } = await supabase
      .from('tenants')
      .update({ security_settings: updatedSettings })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
      message: 'บันทึกการตั้งค่าความปลอดภัยเรียบร้อย',
    });
  } catch (err) {
    console.error('Update tenant security error:', err);
    return NextResponse.json({ error: 'Failed to update security settings' }, { status: 500 });
  }
}
