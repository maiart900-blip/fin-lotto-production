import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkFeature,
  checkMultipleFeatures,
  hasFeature,
  grantFeature,
  revokeFeature,
  removeFeatureOverride,
  getTenantFeatureOverrides,
  checkLimit,
  canAddMore,
} from '@/lib/packages/feature-flags'

// GET /api/features - Check feature access
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const featureCode = searchParams.get('feature')
    const features = searchParams.get('features')
    const checkLimitType = searchParams.get('checkLimit')
    const canAddMoreType = searchParams.get('canAddMore')
    const amount = searchParams.get('amount')
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      )
    }
    
    // Check single feature
    if (featureCode) {
      const result = await checkFeature(tenantId, featureCode)
      return NextResponse.json({
        success: true,
        data: result
      })
    }
    
    // Check multiple features
    if (features) {
      const featureCodes = features.split(',')
      const results = await checkMultipleFeatures(tenantId, featureCodes)
      return NextResponse.json({
        success: true,
        data: results
      })
    }
    
    // Check limit
    if (checkLimitType) {
      const limitType = checkLimitType as 'customers' | 'agents' | 'daily_bets' | 'api_calls' | 'storage'
      const result = await checkLimit(tenantId, limitType)
      return NextResponse.json({
        success: true,
        data: result
      })
    }
    
    // Can add more
    if (canAddMoreType) {
      const limitType = canAddMoreType as 'customers' | 'agents' | 'daily_bets'
      const result = await canAddMore(tenantId, limitType, amount ? parseInt(amount) : 1)
      return NextResponse.json({
        success: true,
        data: result
      })
    }
    
    // Get all overrides for tenant
    const overrides = await getTenantFeatureOverrides(tenantId)
    return NextResponse.json({
      success: true,
      data: { overrides }
    })
  } catch (error) {
    console.error('Error checking features:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check features' },
      { status: 500 }
    )
  }
}

// POST /api/features - Grant or revoke features
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, tenantId, featureCode, ...params } = body
    
    if (!tenantId || !featureCode) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID and feature code are required' },
        { status: 400 }
      )
    }
    
    let result
    
    switch (action) {
      case 'grant': {
        const { value, reason, grantedBy, expiresAt } = params
        result = await grantFeature(tenantId, featureCode, {
          value,
          reason,
          grantedBy,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        })
        break
      }
      
      case 'revoke': {
        const { reason } = params
        await revokeFeature(tenantId, featureCode, reason)
        result = { revoked: true }
        break
      }
      
      case 'remove_override': {
        await removeFeatureOverride(tenantId, featureCode)
        result = { removed: true }
        break
      }
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action (grant, revoke, remove_override)' },
          { status: 400 }
        )
    }
    
    // Log admin action
    await supabase.from('admin_action_timeline').insert({
      action_type: `feature_${action}`,
      target_type: 'feature_flag',
      target_id: tenantId,
      description: `Feature ${action}: ${featureCode}`,
      after_state: params,
    })
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error managing feature:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to manage feature' },
      { status: 500 }
    )
  }
}
