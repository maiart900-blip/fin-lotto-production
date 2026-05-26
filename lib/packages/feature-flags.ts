import { createClient } from '@/lib/supabase/server'
import { getTenantSubscription } from './subscription-manager'
import { getPackageById } from './package-manager'

export interface TenantFeatureFlag {
  id: string
  tenant_id: string
  feature_code: string
  is_enabled: boolean
  value: unknown
  override_reason: string | null
  granted_by: string | null
  expires_at: string | null
}

export interface FeatureCheckResult {
  enabled: boolean
  source: 'package' | 'override' | 'addon' | 'default'
  value: unknown
  expiresAt?: string
}

// ============= FEATURE FLAG CHECKS =============

export async function checkFeature(
  tenantId: string,
  featureCode: string
): Promise<FeatureCheckResult> {
  const supabase = await createClient()
  
  // 1. Check for tenant-specific override first
  const { data: override } = await supabase
    .from('tenant_feature_flags')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('feature_code', featureCode)
    .single()
  
  if (override) {
    // Check if override has expired
    if (override.expires_at && new Date(override.expires_at) < new Date()) {
      // Delete expired override
      await supabase
        .from('tenant_feature_flags')
        .delete()
        .eq('id', override.id)
    } else {
      return {
        enabled: override.is_enabled,
        source: 'override',
        value: override.value,
        expiresAt: override.expires_at || undefined,
      }
    }
  }
  
  // 2. Check subscription package features
  const subscription = await getTenantSubscription(tenantId)
  if (subscription && subscription.package) {
    const packageFeatures = subscription.package.included_features as string[]
    if (packageFeatures.includes(featureCode)) {
      return {
        enabled: true,
        source: 'package',
        value: true,
      }
    }
    
    // Check if explicitly excluded
    const excludedFeatures = subscription.package.excluded_features as string[]
    if (excludedFeatures.includes(featureCode)) {
      return {
        enabled: false,
        source: 'package',
        value: false,
      }
    }
  }
  
  // 3. Check tenant addons
  const { data: addons } = await supabase
    .from('tenant_addons')
    .select('*, package_addons(*)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
  
  if (addons) {
    for (const addon of addons) {
      const grantedFeatures = (addon.package_addons as any)?.grants_features as string[]
      if (grantedFeatures?.includes(featureCode)) {
        return {
          enabled: true,
          source: 'addon',
          value: true,
        }
      }
    }
  }
  
  // 4. Return default (disabled)
  return {
    enabled: false,
    source: 'default',
    value: false,
  }
}

export async function checkMultipleFeatures(
  tenantId: string,
  featureCodes: string[]
): Promise<Record<string, FeatureCheckResult>> {
  const results: Record<string, FeatureCheckResult> = {}
  
  // For efficiency, we could batch this, but for now we'll do individual checks
  await Promise.all(
    featureCodes.map(async (code) => {
      results[code] = await checkFeature(tenantId, code)
    })
  )
  
  return results
}

export async function hasFeature(tenantId: string, featureCode: string): Promise<boolean> {
  const result = await checkFeature(tenantId, featureCode)
  return result.enabled
}

// ============= FEATURE FLAG MANAGEMENT =============

export async function grantFeature(
  tenantId: string,
  featureCode: string,
  options: {
    value?: unknown
    reason?: string
    grantedBy?: string
    expiresAt?: Date
  } = {}
): Promise<TenantFeatureFlag> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tenant_feature_flags')
    .upsert({
      tenant_id: tenantId,
      feature_code: featureCode,
      is_enabled: true,
      value: options.value ?? true,
      override_reason: options.reason,
      granted_by: options.grantedBy,
      expires_at: options.expiresAt?.toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id,feature_code'
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function revokeFeature(
  tenantId: string,
  featureCode: string,
  reason?: string
): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('tenant_feature_flags')
    .upsert({
      tenant_id: tenantId,
      feature_code: featureCode,
      is_enabled: false,
      value: false,
      override_reason: reason || 'Revoked',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'tenant_id,feature_code'
    })
  
  if (error) throw error
}

export async function removeFeatureOverride(
  tenantId: string,
  featureCode: string
): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('tenant_feature_flags')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('feature_code', featureCode)
  
  if (error) throw error
}

export async function getTenantFeatureOverrides(tenantId: string): Promise<TenantFeatureFlag[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tenant_feature_flags')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('feature_code', { ascending: true })
  
  if (error) throw error
  return data || []
}

// ============= LIMIT CHECKS =============

export async function checkLimit(
  tenantId: string,
  limitType: 'customers' | 'agents' | 'daily_bets' | 'api_calls' | 'storage'
): Promise<{
  limit: number
  current: number
  remaining: number
  isUnlimited: boolean
  percentUsed: number
}> {
  const supabase = await createClient()
  
  const subscription = await getTenantSubscription(tenantId)
  if (!subscription || !subscription.package) {
    return { limit: 0, current: 0, remaining: 0, isUnlimited: false, percentUsed: 100 }
  }
  
  const pkg = subscription.package
  let limit = 0
  let current = 0
  
  switch (limitType) {
    case 'customers': {
      limit = pkg.max_customers
      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
      current = count || 0
      break
    }
    case 'agents': {
      limit = pkg.max_agents
      const { count } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
      current = count || 0
      break
    }
    case 'daily_bets': {
      limit = pkg.max_daily_bets
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', today)
      current = count || 0
      break
    }
    case 'api_calls': {
      limit = pkg.max_api_calls_daily
      // Would need API call tracking table
      current = 0
      break
    }
    case 'storage': {
      limit = pkg.max_storage_mb
      // Would need storage tracking
      current = 0
      break
    }
  }
  
  // Check for addon increases
  const { data: addons } = await supabase
    .from('tenant_addons')
    .select('*, package_addons(*)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
  
  if (addons) {
    for (const addon of addons) {
      const increases = (addon.package_addons as any)?.increases_limits as Record<string, number>
      if (increases && increases[limitType]) {
        limit += increases[limitType]
      }
    }
  }
  
  const isUnlimited = limit === -1
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - current)
  const percentUsed = isUnlimited ? 0 : limit > 0 ? Math.round((current / limit) * 100) : 100
  
  return { limit, current, remaining, isUnlimited, percentUsed }
}

export async function canAddMore(
  tenantId: string,
  limitType: 'customers' | 'agents' | 'daily_bets',
  amount = 1
): Promise<{ allowed: boolean; reason?: string }> {
  const check = await checkLimit(tenantId, limitType)
  
  if (check.isUnlimited) {
    return { allowed: true }
  }
  
  if (check.remaining >= amount) {
    return { allowed: true }
  }
  
  return {
    allowed: false,
    reason: `Limit reached: ${check.current}/${check.limit} ${limitType}. Please upgrade your plan.`
  }
}
