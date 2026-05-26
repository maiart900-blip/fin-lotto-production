import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTenantSubscription,
  createSubscription,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  extendTrial,
  convertTrialToActive,
  getDaysLeftInTrial,
  getDaysUntilRenewal,
  isSubscriptionActive,
} from '@/lib/packages'
import { checkLimit } from '@/lib/packages/feature-flags'

// GET /api/subscriptions - Get current tenant subscription
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      )
    }
    
    const subscription = await getTenantSubscription(tenantId)
    
    if (!subscription) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No subscription found'
      })
    }
    
    // Get usage stats
    const [customersLimit, agentsLimit, dailyBetsLimit] = await Promise.all([
      checkLimit(tenantId, 'customers'),
      checkLimit(tenantId, 'agents'),
      checkLimit(tenantId, 'daily_bets'),
    ])
    
    return NextResponse.json({
      success: true,
      data: {
        subscription,
        isActive: isSubscriptionActive(subscription),
        daysLeftInTrial: getDaysLeftInTrial(subscription),
        daysUntilRenewal: getDaysUntilRenewal(subscription),
        usage: {
          customers: customersLimit,
          agents: agentsLimit,
          dailyBets: dailyBetsLimit,
        }
      }
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

// POST /api/subscriptions - Create subscription or perform actions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, tenantId, ...params } = body
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      )
    }
    
    let result
    
    switch (action) {
      case 'create': {
        const { packageId, billingCycle, trialDays, priceOverride, discountPercent, discountReason } = params
        if (!packageId) {
          return NextResponse.json(
            { success: false, error: 'Package ID is required' },
            { status: 400 }
          )
        }
        result = await createSubscription(tenantId, packageId, {
          billingCycle,
          trialDays,
          priceOverride,
          discountPercent,
          discountReason,
        })
        break
      }
      
      case 'upgrade': {
        const { newPackageId, immediate, proration, reason } = params
        if (!newPackageId) {
          return NextResponse.json(
            { success: false, error: 'New package ID is required' },
            { status: 400 }
          )
        }
        result = await upgradeSubscription(tenantId, newPackageId, {
          immediate: immediate !== false,
          proration: proration !== false,
          reason,
        })
        break
      }
      
      case 'downgrade': {
        const { newPackageId, atPeriodEnd, reason } = params
        if (!newPackageId) {
          return NextResponse.json(
            { success: false, error: 'New package ID is required' },
            { status: 400 }
          )
        }
        result = await downgradeSubscription(tenantId, newPackageId, {
          atPeriodEnd,
          reason,
        })
        break
      }
      
      case 'cancel': {
        const { immediate, reason } = params
        await cancelSubscription(tenantId, { immediate, reason })
        result = { cancelled: true }
        break
      }
      
      case 'reactivate': {
        await reactivateSubscription(tenantId)
        result = { reactivated: true }
        break
      }
      
      case 'extend_trial': {
        const { days, reason, grantedBy } = params
        if (!days || days < 1) {
          return NextResponse.json(
            { success: false, error: 'Extension days required' },
            { status: 400 }
          )
        }
        await extendTrial(tenantId, days, reason, grantedBy)
        result = { extended: true, days }
        break
      }
      
      case 'convert_trial': {
        await convertTrialToActive(tenantId)
        result = { converted: true }
        break
      }
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
    
    // Log admin action
    await supabase.from('admin_action_timeline').insert({
      action_type: `subscription_${action}`,
      target_type: 'subscription',
      target_id: tenantId,
      description: `Subscription action: ${action}`,
      after_state: params,
    })
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error processing subscription action:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process action' },
      { status: 500 }
    )
  }
}
