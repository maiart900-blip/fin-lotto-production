import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { clearFeatureCache } from '@/lib/tenant-features';
import { auditLogger } from '@/lib/audit-logger';

// GET: Fetch all features for a tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;
  
  const { id: tenantId } = await params;
  const supabase = await createClient();
  
  try {
    const { data: features, error } = await supabase
      .from('tenant_features')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('[v0] Error fetching tenant features:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ features: features || [] });
  } catch (error) {
    console.error('[v0] Tenant features GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch features' }, { status: 500 });
  }
}

// POST: Toggle a feature for a tenant (Real-time activation)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const session = authResult;
  
  const { id: tenantId } = await params;
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { feature_key, is_enabled, config } = body;
    
    if (!feature_key) {
      return NextResponse.json({ error: 'feature_key is required' }, { status: 400 });
    }
    
    // Check if feature exists
    const { data: existingFeature } = await supabase
      .from('tenant_features')
      .select('id, is_enabled')
      .eq('tenant_id', tenantId)
      .eq('feature_key', feature_key)
      .maybeSingle();
    
    let result;
    const previousState = existingFeature?.is_enabled;
    
    if (existingFeature) {
      // Update existing feature
      const { data, error } = await supabase
        .from('tenant_features')
        .update({
          is_enabled,
          config: config || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingFeature.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Insert new feature
      const { data, error } = await supabase
        .from('tenant_features')
        .insert({
          tenant_id: tenantId,
          feature_key,
          is_enabled,
          config: config || {},
        })
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    // Clear feature cache immediately for real-time effect
    clearFeatureCache(tenantId);
    
    // Audit log
    await auditLogger({
      action: 'tenant_feature_toggle',
      entity_type: 'tenant_features',
      entity_id: result.id,
      user_id: session.id,
      changes: {
        tenant_id: tenantId,
        feature_key,
        previous_state: previousState,
        new_state: is_enabled,
      },
    });
    
    // If this is a master feature being enabled, also enable dependencies
    if (is_enabled && feature_key === 'lottery_auto') {
      // Auto-enable related features for Auto Agent
      const dependencyFeatures = ['slots', 'casino', 'payment_gateway', 'auto_deposit', 'auto_slip_bot'];
      
      for (const depFeature of dependencyFeatures) {
        const { data: existing } = await supabase
          .from('tenant_features')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('feature_key', depFeature)
          .maybeSingle();
        
        if (!existing) {
          await supabase
            .from('tenant_features')
            .insert({
              tenant_id: tenantId,
              feature_key: depFeature,
              is_enabled: true,
            });
        }
      }
      
      // Clear cache again after dependency seeding
      clearFeatureCache(tenantId);
    }
    
    return NextResponse.json({
      success: true,
      feature: result,
      message: `${feature_key} ${is_enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}แล้ว`,
    });
  } catch (error) {
    console.error('[v0] Tenant feature toggle error:', error);
    return NextResponse.json({ error: 'Failed to update feature' }, { status: 500 });
  }
}

// DELETE: Remove a feature (reset to default)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;
  
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const featureKey = searchParams.get('feature_key');
  
  if (!featureKey) {
    return NextResponse.json({ error: 'feature_key is required' }, { status: 400 });
  }
  
  const supabase = await createClient();
  
  try {
    const { error } = await supabase
      .from('tenant_features')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('feature_key', featureKey);
    
    if (error) throw error;
    
    // Clear cache
    clearFeatureCache(tenantId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] Tenant feature delete error:', error);
    return NextResponse.json({ error: 'Failed to delete feature' }, { status: 500 });
  }
}
