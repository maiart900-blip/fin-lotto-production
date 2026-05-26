import { createClient } from '@/lib/supabase/server'
import { getPackageById, Package } from './package-manager'

export interface TenantSubscription {
  id: string
  tenant_id: string
  package_id: string
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired'
  billing_cycle: 'monthly' | 'yearly' | 'custom'
  started_at: string
  current_period_start: string
  current_period_end: string | null
  trial_ends_at: string | null
  cancelled_at: string | null
  cancel_at_period_end: boolean
  price_override: number | null
  discount_percent: number
  discount_reason: string | null
  payment_method: string | null
  last_payment_at: string | null
  next_billing_at: string | null
  metadata: Record<string, unknown>
  package?: Package
}

export interface SubscriptionChangeRequest {
  id: string
  tenant_id: string
  current_package_id: string | null
  requested_package_id: string
  change_type: 'upgrade' | 'downgrade' | 'addon_add' | 'addon_remove'
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  effective_date: string | null
  proration_amount: number | null
  reason: string | null
  approved_by: string | null
  approved_at: string | null
  completed_at: string | null
  created_at: string
}

// ============= SUBSCRIPTION QUERIES =============

export async function getTenantSubscription(tenantId: string): Promise<TenantSubscription | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select('*, packages(*)')
    .eq('tenant_id', tenantId)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  
  if (data) {
    return {
      ...data,
      package: data.packages as Package
    }
  }
  
  return null
}

export async function getAllSubscriptions(filters?: {
  status?: string
  packageId?: string
}): Promise<TenantSubscription[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('tenant_subscriptions')
    .select('*, packages(*), tenants(name, slug)')
    .order('created_at', { ascending: false })
  
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.packageId) {
    query = query.eq('package_id', filters.packageId)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  return data || []
}

// ============= SUBSCRIPTION MANAGEMENT =============

export async function createSubscription(
  tenantId: string,
  packageId: string,
  options: {
    billingCycle?: 'monthly' | 'yearly'
    trialDays?: number
    priceOverride?: number
    discountPercent?: number
    discountReason?: string
  } = {}
): Promise<TenantSubscription> {
  const supabase = await createClient()
  
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + (options.billingCycle === 'yearly' ? 12 : 1))
  
  let trialEndsAt: string | null = null
  let status: TenantSubscription['status'] = 'active'
  
  if (options.trialDays && options.trialDays > 0) {
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + options.trialDays)
    trialEndsAt = trialEnd.toISOString()
    status = 'trial'
  }
  
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .insert({
      tenant_id: tenantId,
      package_id: packageId,
      status,
      billing_cycle: options.billingCycle || 'monthly',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_ends_at: trialEndsAt,
      next_billing_at: trialEndsAt || periodEnd.toISOString(),
      price_override: options.priceOverride,
      discount_percent: options.discountPercent || 0,
      discount_reason: options.discountReason,
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Log subscription event
  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: status === 'trial' ? 'trial_started' : 'created',
    to_plan: packageId,
    details: { billing_cycle: options.billingCycle, trial_days: options.trialDays }
  })
  
  return data
}

export async function upgradeSubscription(
  tenantId: string,
  newPackageId: string,
  options: {
    immediate?: boolean
    proration?: boolean
    reason?: string
  } = {}
): Promise<SubscriptionChangeRequest> {
  const supabase = await createClient()
  
  const current = await getTenantSubscription(tenantId)
  if (!current) throw new Error('No active subscription found')
  
  const newPackage = await getPackageById(newPackageId)
  if (!newPackage) throw new Error('Package not found')
  
  let prorationAmount: number | null = null
  
  if (options.proration && current.current_period_end) {
    const now = new Date()
    const periodEnd = new Date(current.current_period_end)
    const periodStart = new Date(current.current_period_start)
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
    const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (remainingDays > 0 && current.package) {
      const currentDaily = current.package.price_monthly / 30
      const newDaily = newPackage.price_monthly / 30
      prorationAmount = (newDaily - currentDaily) * remainingDays
    }
  }
  
  const effectiveDate = options.immediate ? new Date().toISOString().split('T')[0] : current.current_period_end?.split('T')[0]
  
  const { data, error } = await supabase
    .from('subscription_change_requests')
    .insert({
      tenant_id: tenantId,
      current_package_id: current.package_id,
      requested_package_id: newPackageId,
      change_type: 'upgrade',
      status: options.immediate ? 'completed' : 'pending',
      effective_date: effectiveDate,
      proration_amount: prorationAmount,
      reason: options.reason,
      completed_at: options.immediate ? new Date().toISOString() : null,
    })
    .select()
    .single()
  
  if (error) throw error
  
  if (options.immediate) {
    await supabase
      .from('tenant_subscriptions')
      .update({
        package_id: newPackageId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
    
    await supabase.from('subscription_events').insert({
      tenant_id: tenantId,
      event_type: 'upgraded',
      from_plan: current.package_id,
      to_plan: newPackageId,
      details: { proration: prorationAmount, immediate: true }
    })
  }
  
  return data
}

export async function downgradeSubscription(
  tenantId: string,
  newPackageId: string,
  options: {
    atPeriodEnd?: boolean
    reason?: string
  } = {}
): Promise<SubscriptionChangeRequest> {
  const supabase = await createClient()
  
  const current = await getTenantSubscription(tenantId)
  if (!current) throw new Error('No active subscription found')
  
  const effectiveDate = options.atPeriodEnd !== false 
    ? current.current_period_end?.split('T')[0]
    : new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('subscription_change_requests')
    .insert({
      tenant_id: tenantId,
      current_package_id: current.package_id,
      requested_package_id: newPackageId,
      change_type: 'downgrade',
      status: 'pending',
      effective_date: effectiveDate,
      reason: options.reason,
    })
    .select()
    .single()
  
  if (error) throw error
  
  return data
}

export async function cancelSubscription(
  tenantId: string,
  options: {
    immediate?: boolean
    reason?: string
  } = {}
): Promise<void> {
  const supabase = await createClient()
  
  const updates: Record<string, unknown> = {
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  
  if (options.immediate) {
    updates.status = 'cancelled'
  } else {
    updates.cancel_at_period_end = true
  }
  
  const { error } = await supabase
    .from('tenant_subscriptions')
    .update(updates)
    .eq('tenant_id', tenantId)
  
  if (error) throw error
  
  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: 'cancelled',
    details: { immediate: options.immediate, reason: options.reason }
  })
}

export async function reactivateSubscription(tenantId: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('tenant_subscriptions')
    .update({
      status: 'active',
      cancelled_at: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
  
  if (error) throw error
  
  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: 'reactivated',
  })
}

// ============= TRIAL MANAGEMENT =============

export async function extendTrial(
  tenantId: string,
  days: number,
  reason: string,
  grantedBy?: string
): Promise<void> {
  const supabase = await createClient()
  
  const sub = await getTenantSubscription(tenantId)
  if (!sub || sub.status !== 'trial' || !sub.trial_ends_at) {
    throw new Error('No active trial to extend')
  }
  
  const originalEnd = new Date(sub.trial_ends_at)
  const newEnd = new Date(originalEnd)
  newEnd.setDate(newEnd.getDate() + days)
  
  await supabase.from('trial_extensions').insert({
    tenant_id: tenantId,
    original_end_date: originalEnd.toISOString(),
    extended_to: newEnd.toISOString(),
    extension_days: days,
    reason,
    granted_by: grantedBy,
  })
  
  await supabase
    .from('tenant_subscriptions')
    .update({
      trial_ends_at: newEnd.toISOString(),
      next_billing_at: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
}

export async function convertTrialToActive(tenantId: string): Promise<void> {
  const supabase = await createClient()
  
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  
  await supabase
    .from('tenant_subscriptions')
    .update({
      status: 'active',
      trial_ends_at: null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_billing_at: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('tenant_id', tenantId)
  
  await supabase.from('subscription_events').insert({
    tenant_id: tenantId,
    event_type: 'trial_ended',
    details: { converted_to_paid: true }
  })
}

// ============= SUBSCRIPTION STATUS CHECKS =============

export function isSubscriptionActive(sub: TenantSubscription): boolean {
  return ['active', 'trial'].includes(sub.status) && !sub.cancel_at_period_end
}

export function isTrialExpired(sub: TenantSubscription): boolean {
  if (sub.status !== 'trial' || !sub.trial_ends_at) return false
  return new Date(sub.trial_ends_at) < new Date()
}

export function getDaysUntilRenewal(sub: TenantSubscription): number | null {
  if (!sub.next_billing_at) return null
  const diff = new Date(sub.next_billing_at).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getDaysLeftInTrial(sub: TenantSubscription): number | null {
  if (sub.status !== 'trial' || !sub.trial_ends_at) return null
  const diff = new Date(sub.trial_ends_at).getTime() - new Date().getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
