import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/api-auth';

// GET - Fetch tenant settings
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = authResult.user;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    let tenantId = searchParams.get('tenant_id');

    // If no tenant_id specified, use session's tenant
    if (!tenantId && session.tenant_id) {
      tenantId = session.tenant_id;
    }

    // Super admin can view any tenant, others only their own
    if (session.role !== 'super_admin' && session.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    // Try to get existing settings
    let { data: settings, error } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    // If no settings exist, create default ones
    if (error && error.code === 'PGRST116') {
      const { data: newSettings, error: insertError } = await supabase
        .from('tenant_settings')
        .insert({ tenant_id: tenantId })
        .select()
        .single();

      if (insertError) {
        console.error('Create tenant settings error:', insertError);
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
      }

      settings = newSettings;
    } else if (error) {
      console.error('Fetch tenant settings error:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Tenant settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update tenant settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenant_id, ...updates } = body;

    let targetTenantId = tenant_id;

    // If no tenant_id specified, use session's tenant
    if (!targetTenantId && session.tenant_id) {
      targetTenantId = session.tenant_id;
    }

    // Super admin can update any tenant, others only their own
    if (session.role !== 'super_admin' && session.tenant_id !== targetTenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!targetTenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Filter allowed fields for non-super-admin users
    // Core system settings are locked for regular users
    const lockedFields = [
      'id', 'tenant_id', 'created_at'
    ];

    const allowedUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!lockedFields.includes(key)) {
        allowedUpdates[key] = value;
      }
    }

    // Add updated_at timestamp
    allowedUpdates.updated_at = new Date().toISOString();

    // Upsert settings
    const { data: settings, error } = await supabase
      .from('tenant_settings')
      .upsert(
        { tenant_id: targetTenantId, ...allowedUpdates },
        { onConflict: 'tenant_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Update tenant settings error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      settings,
      message: 'บันทึกการตั้งค่าสำเร็จ' 
    });
  } catch (error) {
    console.error('Tenant settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
