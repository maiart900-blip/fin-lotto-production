import { createClient } from '@/lib/supabase/server'

export interface Package {
  id: string
  code: string
  name: string
  description: string | null
  tier: number
  price_monthly: number
  price_yearly: number
  price_setup: number
  currency: string
  max_customers: number
  max_agents: number
  max_daily_bets: number
  max_monthly_volume: number
  max_api_calls_daily: number
  max_storage_mb: number
  included_features: string[]
  excluded_features: string[]
  pricing_model: 'flat' | 'usage_based' | 'tiered' | 'hybrid'
  overage_rate: Record<string, number>
  is_public: boolean
  is_active: boolean
  sort_order: number
  badge_text: string | null
  badge_color: string | null
  highlight: boolean
  created_at: string
}

export interface PackageFeature {
  id: string
  code: string
  name: string
  description: string | null
  category: string
  feature_type: 'boolean' | 'limit' | 'tier'
  default_value: unknown
  is_addon: boolean
  addon_price_monthly: number
}

export interface PackageAddon {
  id: string
  code: string
  name: string
  description: string | null
  category: string
  price_monthly: number
  price_yearly: number
  price_one_time: number
  grants_features: string[]
  increases_limits: Record<string, number>
  is_active: boolean
}

// ============= PACKAGE QUERIES =============

export async function getAllPackages(includePrivate = false): Promise<Package[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('packages')
    .select('*')
    .eq('is_active', true)
    .order('tier', { ascending: true })
  
  if (!includePrivate) {
    query = query.eq('is_public', true)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  return data || []
}

export async function getPackageByCode(code: string): Promise<Package | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('code', code)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getPackageById(id: string): Promise<Package | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data
}

// ============= FEATURE QUERIES =============

export async function getAllFeatures(): Promise<PackageFeature[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('package_features')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
  
  if (error) throw error
  return data || []
}

export async function getPackageFeatures(packageId: string): Promise<string[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('package_feature_grants')
    .select('feature_id, package_features(code)')
    .eq('package_id', packageId)
  
  if (error) throw error
  return data?.map(d => (d.package_features as any)?.code).filter(Boolean) || []
}

// ============= ADDON QUERIES =============

export async function getAllAddons(): Promise<PackageAddon[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('package_addons')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true })
  
  if (error) throw error
  return data || []
}

// ============= PACKAGE MANAGEMENT (Super Admin) =============

export async function createPackage(pkg: Partial<Package>): Promise<Package> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('packages')
    .insert(pkg)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updatePackage(id: string, updates: Partial<Package>): Promise<Package> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('packages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deactivatePackage(id: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('packages')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) throw error
}

// ============= COMPARISON HELPERS =============

export function comparePackages(current: Package, target: Package): {
  isUpgrade: boolean
  isDowngrade: boolean
  priceDifference: number
  featuresDiff: { gained: string[], lost: string[] }
  limitsDiff: Record<string, { from: number, to: number }>
} {
  const isUpgrade = target.tier > current.tier
  const isDowngrade = target.tier < current.tier
  const priceDifference = target.price_monthly - current.price_monthly
  
  const currentFeatures = new Set(current.included_features)
  const targetFeatures = new Set(target.included_features)
  
  const gained = target.included_features.filter(f => !currentFeatures.has(f))
  const lost = current.included_features.filter(f => !targetFeatures.has(f))
  
  const limitsDiff: Record<string, { from: number, to: number }> = {}
  
  if (current.max_customers !== target.max_customers) {
    limitsDiff.max_customers = { from: current.max_customers, to: target.max_customers }
  }
  if (current.max_agents !== target.max_agents) {
    limitsDiff.max_agents = { from: current.max_agents, to: target.max_agents }
  }
  if (current.max_daily_bets !== target.max_daily_bets) {
    limitsDiff.max_daily_bets = { from: current.max_daily_bets, to: target.max_daily_bets }
  }
  
  return { isUpgrade, isDowngrade, priceDifference, featuresDiff: { gained, lost }, limitsDiff }
}

export function formatPrice(amount: number, currency = 'THB'): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function calculateYearlySavings(monthly: number, yearly: number): {
  amount: number
  percent: number
} {
  const annualFromMonthly = monthly * 12
  const amount = annualFromMonthly - yearly
  const percent = annualFromMonthly > 0 ? Math.round((amount / annualFromMonthly) * 100) : 0
  
  return { amount, percent }
}
