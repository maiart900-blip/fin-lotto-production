import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Feature to route mapping
const FEATURE_ROUTE_MAP: Record<string, string[]> = {
  // Auto System features
  lottery_auto: ['/auto-system', '/auto-system/*'],
  slots: ['/slots', '/slots/*', '/c/slots', '/c/slots/*'],
  casino: ['/casino', '/casino/*', '/c/casino', '/c/casino/*'],
  
  // Manual Key features
  lottery_manual_key: ['/manual-key', '/manual-key/*', '/admin/key', '/admin/key/*'],
  agent_system: ['/agent-system', '/agent-system/*'],
  manual_downline: ['/manual-downline', '/manual-downline/*'],
  agent_settlement: ['/agent-system/settlement', '/agent-system/settlement/*'],
  key_lottery: ['/key-lottery', '/key-lottery/*'],
  
  // Payment features
  payment_gateway: ['/payment-gateway', '/api/webhooks/payment'],
  auto_deposit: ['/auto-deposit', '/topup/auto'],
  auto_withdraw: ['/auto-withdraw', '/withdraw/auto'],
  
  // Bot features
  auto_slip_bot: ['/slip-verify/auto', '/api/slip-verify/auto'],
  slip_ocr: ['/slip-ocr'],
  
  // Search features
  advanced_search: ['/credit-adjustments', '/transaction-history'],
  export_reports: ['/reports/export', '/api/reports/export'],
};

// Reverse map: route pattern to feature key
const ROUTE_FEATURE_MAP: Record<string, string> = {};
for (const [feature, routes] of Object.entries(FEATURE_ROUTE_MAP)) {
  for (const route of routes) {
    ROUTE_FEATURE_MAP[route] = feature;
  }
}

/**
 * Check if a route matches a pattern (supports wildcards)
 */
function matchRoute(route: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return route === prefix || route.startsWith(prefix + '/');
  }
  return route === pattern;
}

/**
 * Get the required feature key for a given route
 */
export function getRequiredFeature(pathname: string): string | null {
  for (const [pattern, feature] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (matchRoute(pathname, pattern)) {
      return feature;
    }
  }
  return null;
}

/**
 * Check if a tenant has access to a specific feature
 */
export async function checkTenantFeatureAccess(
  tenantId: string,
  featureKey: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: feature, error } = await supabase
    .from('tenant_features')
    .select('is_enabled')
    .eq('tenant_id', tenantId)
    .eq('feature_key', featureKey)
    .maybeSingle();
  
  if (error) {
    console.error('[v0] Feature check error:', error);
    // Default to allowed if check fails (for backwards compatibility)
    return true;
  }
  
  // If feature not configured, default to allowed
  if (!feature) return true;
  
  return feature.is_enabled;
}

/**
 * Middleware function to check feature access for a route
 * Returns NextResponse with 403 if access denied, null if allowed
 */
export async function requireFeatureAccess(
  pathname: string,
  tenantId: string | null
): Promise<NextResponse | null> {
  // If no tenant, allow access (super admin or non-tenant routes)
  if (!tenantId) return null;
  
  const requiredFeature = getRequiredFeature(pathname);
  
  // If no feature required for this route, allow
  if (!requiredFeature) return null;
  
  const hasAccess = await checkTenantFeatureAccess(tenantId, requiredFeature);
  
  if (!hasAccess) {
    console.log(`[v0] Feature access denied: tenant=${tenantId}, feature=${requiredFeature}, route=${pathname}`);
    
    // Return 403 Forbidden with Thai message
    return NextResponse.json(
      {
        error: 'ไม่มีสิทธิ์เข้าถึง',
        message: 'ฟีเจอร์นี้ถูกปิดใช้งานโดยผู้ดูแลระบบ',
        feature: requiredFeature,
        code: 'FEATURE_DISABLED',
      },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * Get all enabled features for a tenant (for client-side menu filtering)
 */
export async function getTenantEnabledFeatures(tenantId: string): Promise<Set<string>> {
  const supabase = await createClient();
  
  const { data: features, error } = await supabase
    .from('tenant_features')
    .select('feature_key, is_enabled')
    .eq('tenant_id', tenantId);
  
  if (error) {
    console.error('[v0] Error fetching tenant features:', error);
    return new Set();
  }
  
  const enabledFeatures = new Set<string>();
  
  for (const feature of features || []) {
    if (feature.is_enabled) {
      enabledFeatures.add(feature.feature_key);
    }
  }
  
  return enabledFeatures;
}

/**
 * Bulk check multiple features for a tenant
 */
export async function checkMultipleFeatures(
  tenantId: string,
  featureKeys: string[]
): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  
  const { data: features, error } = await supabase
    .from('tenant_features')
    .select('feature_key, is_enabled')
    .eq('tenant_id', tenantId)
    .in('feature_key', featureKeys);
  
  if (error) {
    console.error('[v0] Error checking multiple features:', error);
    // Default all to true on error
    return featureKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }
  
  const result: Record<string, boolean> = {};
  
  for (const key of featureKeys) {
    const feature = features?.find(f => f.feature_key === key);
    // Default to true if not configured
    result[key] = feature?.is_enabled ?? true;
  }
  
  return result;
}
