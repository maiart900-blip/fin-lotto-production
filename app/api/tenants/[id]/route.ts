import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

// GET - Get tenant details with full stats and subscriptions
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Get tenant with all related data
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select(`
        *,
        tenant_stats (
          total_bets,
          total_payouts,
          total_deposits,
          total_withdrawals,
          profit_loss,
          active_users,
          new_users,
          stat_date
        ),
        tenant_alerts (
          id,
          alert_type,
          title,
          message,
          is_read,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Get subscription info
    const { data: subscription } = await supabase
      .from('tenant_subscriptions')
      .select('*, packages(*)')
      .eq('tenant_id', id)
      .single();

    // Get feature flags
    const { data: featureFlags } = await supabase
      .from('tenant_feature_flags')
      .select('*')
      .eq('tenant_id', id);

    // Get tenant addons
    const { data: addons } = await supabase
      .from('tenant_addons')
      .select('*, package_addons(*)')
      .eq('tenant_id', id)
      .eq('status', 'active');

    // Get revenue share configs
    const { data: revenueConfigs } = await supabase
      .from('revenue_share_configs')
      .select('*')
      .eq('tenant_id', id)
      .eq('is_active', true);

    // Get provider access
    const { data: providers } = await supabase
      .from('provider_plugins')
      .select('id, name, type, status')
      .contains('tenant_ids', [id]);

    // Get users for this tenant
    const { data: users, count } = await supabase
      .from('users')
      .select('id, username, display_name, role, credit_balance, is_active, created_at', { count: 'exact' })
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    // Get tenant health
    const { data: health } = await supabase
      .from('tenant_health')
      .select('*')
      .eq('tenant_id', id)
      .single();

    return NextResponse.json({
      ...tenant,
      subscription: subscription || null,
      feature_flags: featureFlags || [],
      addons: addons || [],
      revenue_configs: revenueConfigs || [],
      providers: providers || [],
      users: users || [],
      user_count: count || 0,
      health: health || null
    });
  } catch (err) {
    console.error('Get tenant error:', err);
    return NextResponse.json({ error: 'ไม่พบข้อมูลเว็บลูก' }, { status: 404 });
  }
}

// PUT - Update tenant (full edit capabilities)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard - require super admin
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Get current tenant state for audit log
    const { data: currentTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (!currentTenant) {
      return NextResponse.json({ error: 'ไม่พบเว็บลูก' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    // Basic info
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) {
      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', body.slug)
        .neq('id', id)
        .single();
      
      if (existing) {
        return NextResponse.json({ error: 'Slug นี้ถูกใช้งานแล้ว' }, { status: 400 });
      }
      updateData.slug = body.slug;
    }
    if (body.domain !== undefined) updateData.domain = body.domain;
    
    // Status
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.status !== undefined) updateData.status = body.status;
    
    // Tenant mode
    if (body.auto_system_enabled !== undefined) updateData.auto_system_enabled = body.auto_system_enabled;
    if (body.manual_key_enabled !== undefined) updateData.manual_key_enabled = body.manual_key_enabled;
    
    // Sync settings
    if (body.sync_payout_rates !== undefined) updateData.sync_payout_rates = body.sync_payout_rates;
    if (body.sync_blocked_numbers !== undefined) updateData.sync_blocked_numbers = body.sync_blocked_numbers;
    if (body.sync_lottery_status !== undefined) updateData.sync_lottery_status = body.sync_lottery_status;
    
    // Financial controls
    if (body.deposit_fee_percent !== undefined) updateData.deposit_fee_percent = body.deposit_fee_percent;
    if (body.withdraw_fee_percent !== undefined) updateData.withdraw_fee_percent = body.withdraw_fee_percent;
    if (body.wallet_frozen !== undefined) updateData.wallet_frozen = body.wallet_frozen;
    if (body.settlement_frozen !== undefined) updateData.settlement_frozen = body.settlement_frozen;
    if (body.max_daily_payout !== undefined) updateData.max_daily_payout = body.max_daily_payout;
    if (body.max_single_payout !== undefined) updateData.max_single_payout = body.max_single_payout;
    if (body.max_exposure !== undefined) updateData.max_exposure = body.max_exposure;
    
    // Package/plan
    if (body.plan !== undefined) updateData.plan = body.plan;
    if (body.max_customers !== undefined) updateData.max_customers = body.max_customers;
    if (body.max_agents !== undefined) updateData.max_agents = body.max_agents;
    if (body.max_daily_bets !== undefined) updateData.max_daily_bets = body.max_daily_bets;
    
    // Branding
    if (body.theme_config !== undefined) updateData.theme_config = body.theme_config;
    
    // Security settings
    if (body.security_settings !== undefined) updateData.security_settings = body.security_settings;
    
    // Contact info
    if (body.billing_email !== undefined) updateData.billing_email = body.billing_email;
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone;
    
    // Trial/subscription dates
    if (body.trial_ends_at !== undefined) updateData.trial_ends_at = body.trial_ends_at;
    if (body.subscription_ends_at !== undefined) updateData.subscription_ends_at = body.subscription_ends_at;

    // Update tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Create audit log entry
    await supabase
      .from('tenant_activity_logs')
      .insert({
        tenant_id: id,
        action: 'tenant_updated',
        actor_type: 'super_admin',
        details: {
          changes: Object.keys(updateData).filter(k => k !== 'updated_at'),
          before: currentTenant,
          after: tenant
        }
      });

    return NextResponse.json(tenant);
  } catch (err) {
    console.error('Update tenant error:', err);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตเว็บลูกได้' }, { status: 500 });
  }
}

// DELETE - Delete tenant (soft delete by setting is_active = false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard - require super admin
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const supabase = await createClient();

    // Check if it's master tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('is_master, name')
      .eq('id', id)
      .single();

    if (tenant?.is_master) {
      return NextResponse.json(
        { error: 'ไม่สามารถลบเว็บแม่ได้' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('tenants')
      .update({ 
        is_active: false,
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    // Create audit log entry
    await supabase
      .from('tenant_activity_logs')
      .insert({
        tenant_id: id,
        action: 'tenant_deleted',
        actor_type: 'super_admin',
        details: { tenant_name: tenant?.name }
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete tenant error:', err);
    return NextResponse.json({ error: 'ไม่สามารถลบเว็บลูกได้' }, { status: 500 });
  }
}
