import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';

/**
 * Tenant Management API - Full Lifecycle Management
 * Handles subscriptions, revenue share, providers, feature flags
 */

// POST - Perform management action on tenant
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { id: tenantId } = await params;
    const body = await request.json();
    const { action, ...data } = body;
    const supabase = await createClient();

    switch (action) {
      // =============== SUBSCRIPTION MANAGEMENT ===============
      case 'change_package': {
        const { package_id, billing_cycle = 'monthly', proration = true } = data;
        
        // Get current subscription
        const { data: currentSub } = await supabase
          .from('tenant_subscriptions')
          .select('*, packages(*)')
          .eq('tenant_id', tenantId)
          .single();

        // Get new package
        const { data: newPackage, error: pkgError } = await supabase
          .from('packages')
          .select('*')
          .eq('id', package_id)
          .single();

        if (pkgError || !newPackage) {
          return NextResponse.json({ error: 'Package not found' }, { status: 404 });
        }

        // Calculate proration if upgrading
        let prorationAmount = 0;
        if (proration && currentSub) {
          const currentPeriodEnd = new Date(currentSub.current_period_end);
          const now = new Date();
          const daysRemaining = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const dailyRate = (newPackage.price_monthly - (currentSub.packages?.price_monthly || 0)) / 30;
          prorationAmount = dailyRate * daysRemaining;
        }

        // Create change request
        const changeType = currentSub?.packages?.tier < newPackage.tier ? 'upgrade' : 'downgrade';
        
        const { data: changeRequest, error: crError } = await supabase
          .from('subscription_change_requests')
          .insert({
            tenant_id: tenantId,
            current_package_id: currentSub?.package_id,
            requested_package_id: package_id,
            change_type: changeType,
            status: 'approved',
            effective_date: new Date().toISOString().split('T')[0],
            proration_amount: prorationAmount,
            approved_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })
          .select()
          .single();

        if (crError) throw crError;

        // Update or create subscription
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + (billing_cycle === 'yearly' ? 12 : 1));

        if (currentSub) {
          await supabase
            .from('tenant_subscriptions')
            .update({
              package_id,
              billing_cycle,
              current_period_start: new Date().toISOString(),
              current_period_end: periodEnd.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('tenant_id', tenantId);
        } else {
          await supabase
            .from('tenant_subscriptions')
            .insert({
              tenant_id: tenantId,
              package_id,
              status: 'active',
              billing_cycle,
              current_period_start: new Date().toISOString(),
              current_period_end: periodEnd.toISOString()
            });
        }

        // Update tenant limits based on package
        await supabase
          .from('tenants')
          .update({
            plan: newPackage.code,
            max_customers: newPackage.max_customers,
            max_agents: newPackage.max_agents,
            max_daily_bets: newPackage.max_daily_bets,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantId);

        // Log subscription event
        await supabase
          .from('subscription_events')
          .insert({
            tenant_id: tenantId,
            event_type: changeType === 'upgrade' ? 'upgraded' : 'downgraded',
            from_plan: currentSub?.packages?.code,
            to_plan: newPackage.code,
            details: { proration_amount: prorationAmount, billing_cycle }
          });

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'package_changed',
            actor_type: 'super_admin',
            details: {
              from_package: currentSub?.packages?.name,
              to_package: newPackage.name,
              change_type: changeType,
              proration_amount: prorationAmount
            }
          });

        return NextResponse.json({ 
          success: true, 
          change_request: changeRequest,
          new_package: newPackage 
        });
      }

      // =============== TRIAL MANAGEMENT ===============
      case 'extend_trial': {
        const { days, reason } = data;
        
        const { data: sub } = await supabase
          .from('tenant_subscriptions')
          .select('trial_ends_at')
          .eq('tenant_id', tenantId)
          .single();

        const originalEndDate = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
        const newEndDate = new Date(originalEndDate);
        newEndDate.setDate(newEndDate.getDate() + days);

        // Update subscription
        await supabase
          .from('tenant_subscriptions')
          .update({
            trial_ends_at: newEndDate.toISOString(),
            status: 'trial'
          })
          .eq('tenant_id', tenantId);

        // Update tenant
        await supabase
          .from('tenants')
          .update({ 
            trial_ends_at: newEndDate.toISOString(),
            status: 'trial'
          })
          .eq('id', tenantId);

        // Log extension
        await supabase
          .from('trial_extensions')
          .insert({
            tenant_id: tenantId,
            original_end_date: originalEndDate.toISOString(),
            extended_to: newEndDate.toISOString(),
            extension_days: days,
            reason
          });

        return NextResponse.json({ 
          success: true, 
          new_trial_end: newEndDate.toISOString() 
        });
      }

      // =============== REVENUE SHARE MANAGEMENT ===============
      case 'set_revenue_share': {
        const { 
          game_type = 'all',
          tenant_share_percent,
          platform_share_percent,
          provider_share_percent = 0,
          settlement_frequency = 'daily'
        } = data;

        // Validate percentages total 100
        const total = tenant_share_percent + platform_share_percent + provider_share_percent;
        if (Math.abs(total - 100) > 0.01) {
          return NextResponse.json({ error: 'Share percentages must total 100%' }, { status: 400 });
        }

        // Upsert revenue share config
        const { data: config, error } = await supabase
          .from('revenue_share_configs')
          .upsert({
            tenant_id: tenantId,
            config_type: 'tenant',
            game_type,
            tenant_share_percent,
            platform_share_percent,
            provider_share_percent,
            settlement_frequency,
            is_active: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'tenant_id,config_type,game_type'
          })
          .select()
          .single();

        if (error) {
          // If upsert fails, try insert
          const { data: newConfig, error: insertError } = await supabase
            .from('revenue_share_configs')
            .insert({
              tenant_id: tenantId,
              config_type: 'tenant',
              game_type,
              tenant_share_percent,
              platform_share_percent,
              provider_share_percent,
              settlement_frequency,
              is_active: true
            })
            .select()
            .single();
          
          if (insertError) throw insertError;
          
          // Audit log
          await supabase
            .from('tenant_activity_logs')
            .insert({
              tenant_id: tenantId,
              action: 'revenue_share_updated',
              actor_type: 'super_admin',
              details: { game_type, tenant_share_percent, platform_share_percent, provider_share_percent }
            });
          
          return NextResponse.json({ success: true, config: newConfig });
        }

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'revenue_share_updated',
            actor_type: 'super_admin',
            details: { game_type, tenant_share_percent, platform_share_percent, provider_share_percent }
          });

        return NextResponse.json({ success: true, config });
      }

      // =============== PROVIDER MANAGEMENT ===============
      case 'attach_provider': {
        const { provider_id, config = {} } = data;

        // Get provider
        const { data: provider, error: provError } = await supabase
          .from('provider_plugins')
          .select('*')
          .eq('id', provider_id)
          .single();

        if (provError || !provider) {
          return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        // Add tenant to provider's tenant_ids array
        const tenantIds = provider.tenant_ids || [];
        if (!tenantIds.includes(tenantId)) {
          tenantIds.push(tenantId);
        }

        await supabase
          .from('provider_plugins')
          .update({ 
            tenant_ids: tenantIds,
            updated_at: new Date().toISOString()
          })
          .eq('id', provider_id);

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'provider_attached',
            actor_type: 'super_admin',
            details: { provider_id, provider_name: provider.name, config }
          });

        return NextResponse.json({ success: true, provider });
      }

      case 'detach_provider': {
        const { provider_id } = data;

        // Get provider
        const { data: provider } = await supabase
          .from('provider_plugins')
          .select('*')
          .eq('id', provider_id)
          .single();

        if (provider) {
          const tenantIds = (provider.tenant_ids || []).filter((t: string) => t !== tenantId);
          await supabase
            .from('provider_plugins')
            .update({ tenant_ids: tenantIds })
            .eq('id', provider_id);
        }

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'provider_detached',
            actor_type: 'super_admin',
            details: { provider_id, provider_name: provider?.name }
          });

        return NextResponse.json({ success: true });
      }

      // =============== FEATURE FLAG MANAGEMENT ===============
      case 'set_feature_flag': {
        const { feature_code, is_enabled, value, expires_at, override_reason } = data;

        const { data: flag, error } = await supabase
          .from('tenant_feature_flags')
          .upsert({
            tenant_id: tenantId,
            feature_code,
            is_enabled,
            value: value || is_enabled,
            override_reason,
            expires_at,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'tenant_id,feature_code'
          })
          .select()
          .single();

        if (error) throw error;

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'feature_flag_updated',
            actor_type: 'super_admin',
            details: { feature_code, is_enabled, value }
          });

        return NextResponse.json({ success: true, flag });
      }

      // =============== ADDON MANAGEMENT ===============
      case 'add_addon': {
        const { addon_id, price_override } = data;

        const { data: addon, error: addonError } = await supabase
          .from('package_addons')
          .select('*')
          .eq('id', addon_id)
          .single();

        if (addonError || !addon) {
          return NextResponse.json({ error: 'Addon not found' }, { status: 404 });
        }

        const { data: tenantAddon, error } = await supabase
          .from('tenant_addons')
          .insert({
            tenant_id: tenantId,
            addon_id,
            status: 'active',
            price_paid: price_override || addon.price_monthly
          })
          .select()
          .single();

        if (error) throw error;

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'addon_added',
            actor_type: 'super_admin',
            details: { addon_id, addon_name: addon.name }
          });

        return NextResponse.json({ success: true, tenant_addon: tenantAddon });
      }

      case 'remove_addon': {
        const { addon_id } = data;

        await supabase
          .from('tenant_addons')
          .update({ status: 'cancelled' })
          .eq('tenant_id', tenantId)
          .eq('addon_id', addon_id);

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'addon_removed',
            actor_type: 'super_admin',
            details: { addon_id }
          });

        return NextResponse.json({ success: true });
      }

      // =============== FINANCIAL CONTROLS ===============
      case 'freeze_wallet': {
        const { freeze, reason } = data;

        await supabase
          .from('tenants')
          .update({ 
            wallet_frozen: freeze,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantId);

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: freeze ? 'wallet_frozen' : 'wallet_unfrozen',
            actor_type: 'super_admin',
            details: { reason }
          });

        return NextResponse.json({ success: true, wallet_frozen: freeze });
      }

      case 'freeze_settlement': {
        const { freeze, reason } = data;

        await supabase
          .from('tenants')
          .update({ 
            settlement_frozen: freeze,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantId);

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: freeze ? 'settlement_frozen' : 'settlement_unfrozen',
            actor_type: 'super_admin',
            details: { reason }
          });

        return NextResponse.json({ success: true, settlement_frozen: freeze });
      }

      case 'set_limits': {
        const { max_daily_payout, max_single_payout, max_exposure, max_daily_bets } = data;

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (max_daily_payout !== undefined) updateData.max_daily_payout = max_daily_payout;
        if (max_single_payout !== undefined) updateData.max_single_payout = max_single_payout;
        if (max_exposure !== undefined) updateData.max_exposure = max_exposure;
        if (max_daily_bets !== undefined) updateData.max_daily_bets = max_daily_bets;

        await supabase
          .from('tenants')
          .update(updateData)
          .eq('id', tenantId);

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'limits_updated',
            actor_type: 'super_admin',
            details: { max_daily_payout, max_single_payout, max_exposure, max_daily_bets }
          });

        return NextResponse.json({ success: true });
      }

      // =============== TENANT MODE ===============
      case 'set_mode': {
        const { mode } = data; // 'auto_only' | 'manual_key_only' | 'hybrid'

        let auto_system_enabled = false;
        let manual_key_enabled = false;

        switch (mode) {
          case 'auto_only':
            auto_system_enabled = true;
            manual_key_enabled = false;
            break;
          case 'manual_key_only':
            auto_system_enabled = false;
            manual_key_enabled = true;
            break;
          case 'hybrid':
            auto_system_enabled = true;
            manual_key_enabled = true;
            break;
        }

        await supabase
          .from('tenants')
          .update({ 
            auto_system_enabled,
            manual_key_enabled,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantId);

        // Audit log
        await supabase
          .from('tenant_activity_logs')
          .insert({
            tenant_id: tenantId,
            action: 'mode_changed',
            actor_type: 'super_admin',
            details: { mode, auto_system_enabled, manual_key_enabled }
          });

        return NextResponse.json({ success: true, mode });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('Tenant management error:', err);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
