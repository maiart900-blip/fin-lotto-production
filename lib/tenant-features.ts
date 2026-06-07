import { createClient } from '@/lib/supabase/server';

export interface TenantFeature {
  feature_key: string;
  is_enabled: boolean;
  config?: Record<string, unknown>;
}

// Feature keys for the system
export const FEATURE_KEYS = {
  // Auto features
  LOTTERY_AUTO: 'lottery_auto',
  SLOTS: 'slots',
  CASINO: 'casino',
  SPORTS: 'sports',
  
  // Manual Key features
  LOTTERY_MANUAL_KEY: 'lottery_manual_key',
  AGENT_SYSTEM: 'agent_system',
  MANUAL_DOWNLINE: 'manual_downline',
  AGENT_SETTLEMENT: 'agent_settlement',
  KEY_LOTTERY: 'key_lottery',
} as const;

// Cache for tenant features (server-side)
const featureCache = new Map<string, { features: TenantFeature[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get all feature flags for a tenant
 */
export async function getTenantFeatures(tenantId: string): Promise<TenantFeature[]> {
  // Check cache first
  const cached = featureCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.features;
  }
  
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('tenant_features')
    .select('feature_key, is_enabled, config')
    .eq('tenant_id', tenantId);
  
  if (error) {
    console.error('Error fetching tenant features:', error);
    return [];
  }
  
  const features = data || [];
  
  // Update cache
  featureCache.set(tenantId, { features, timestamp: Date.now() });
  
  return features;
}

/**
 * Check if a specific feature is enabled for a tenant
 */
export async function isFeatureEnabled(tenantId: string, featureKey: string): Promise<boolean> {
  const features = await getTenantFeatures(tenantId);
  const feature = features.find(f => f.feature_key === featureKey);
  
  // Default to true if feature not found (for backwards compatibility)
  return feature?.is_enabled ?? true;
}

/**
 * Check multiple features at once
 */
export async function checkFeatures(tenantId: string, featureKeys: string[]): Promise<Record<string, boolean>> {
  const features = await getTenantFeatures(tenantId);
  const result: Record<string, boolean> = {};
  
  for (const key of featureKeys) {
    const feature = features.find(f => f.feature_key === key);
    result[key] = feature?.is_enabled ?? true;
  }
  
  return result;
}

/**
 * Get feature config for a tenant
 */
export async function getFeatureConfig(tenantId: string, featureKey: string): Promise<Record<string, unknown> | null> {
  const features = await getTenantFeatures(tenantId);
  const feature = features.find(f => f.feature_key === featureKey);
  return feature?.config || null;
}

/**
 * Determine if tenant is Auto Agent type (no manual key features)
 */
export async function isAutoAgentTenant(tenantId: string): Promise<boolean> {
  const features = await checkFeatures(tenantId, [
    FEATURE_KEYS.LOTTERY_AUTO,
    FEATURE_KEYS.LOTTERY_MANUAL_KEY,
  ]);
  
  return features[FEATURE_KEYS.LOTTERY_AUTO] === true && 
         features[FEATURE_KEYS.LOTTERY_MANUAL_KEY] === false;
}

/**
 * Get enabled menu items based on tenant features
 */
export async function getEnabledMenuItems(tenantId: string) {
  const features = await getTenantFeatures(tenantId);
  
  const enabledFeatures = new Set(
    features.filter(f => f.is_enabled).map(f => f.feature_key)
  );
  
  return {
    lottery_auto: enabledFeatures.has(FEATURE_KEYS.LOTTERY_AUTO) || !features.length,
    lottery_manual_key: enabledFeatures.has(FEATURE_KEYS.LOTTERY_MANUAL_KEY) || !features.length,
    slots: enabledFeatures.has(FEATURE_KEYS.SLOTS) || !features.length,
    casino: enabledFeatures.has(FEATURE_KEYS.CASINO) || !features.length,
    sports: enabledFeatures.has(FEATURE_KEYS.SPORTS),
    agent_system: enabledFeatures.has(FEATURE_KEYS.AGENT_SYSTEM) || !features.length,
    manual_downline: enabledFeatures.has(FEATURE_KEYS.MANUAL_DOWNLINE) || !features.length,
    agent_settlement: enabledFeatures.has(FEATURE_KEYS.AGENT_SETTLEMENT) || !features.length,
    key_lottery: enabledFeatures.has(FEATURE_KEYS.KEY_LOTTERY) || !features.length,
  };
}

/**
 * Clear feature cache for a tenant (call after updating features)
 */
export function clearFeatureCache(tenantId?: string) {
  if (tenantId) {
    featureCache.delete(tenantId);
  } else {
    featureCache.clear();
  }
}
