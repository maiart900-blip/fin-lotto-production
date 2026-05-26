import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  getAllPackages, 
  getPackageByCode, 
  createPackage, 
  updatePackage,
  deactivatePackage,
  getAllFeatures,
  getAllAddons
} from '@/lib/packages'

// GET /api/packages - List all packages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includePrivate = searchParams.get('includePrivate') === 'true'
    const includeFeatures = searchParams.get('includeFeatures') === 'true'
    const includeAddons = searchParams.get('includeAddons') === 'true'
    
    const packages = await getAllPackages(includePrivate)
    
    let features = null
    let addons = null
    
    if (includeFeatures) {
      features = await getAllFeatures()
    }
    
    if (includeAddons) {
      addons = await getAllAddons()
    }
    
    return NextResponse.json({
      success: true,
      data: {
        packages,
        ...(features && { features }),
        ...(addons && { addons }),
      }
    })
  } catch (error) {
    console.error('Error fetching packages:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch packages' },
      { status: 500 }
    )
  }
}

// POST /api/packages - Create new package (Super Admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // TODO: Add super admin authentication check
    
    const body = await request.json()
    
    const {
      code,
      name,
      description,
      tier,
      price_monthly,
      price_yearly,
      price_setup,
      max_customers,
      max_agents,
      max_daily_bets,
      max_monthly_volume,
      max_api_calls_daily,
      max_storage_mb,
      included_features,
      pricing_model,
      is_public,
      badge_text,
      highlight,
    } = body
    
    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Package code and name are required' },
        { status: 400 }
      )
    }
    
    // Check for duplicate code
    const existing = await getPackageByCode(code)
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Package code already exists' },
        { status: 409 }
      )
    }
    
    const newPackage = await createPackage({
      code,
      name,
      description,
      tier: tier || 1,
      price_monthly: price_monthly || 0,
      price_yearly: price_yearly || 0,
      price_setup: price_setup || 0,
      max_customers: max_customers || 100,
      max_agents: max_agents || 10,
      max_daily_bets: max_daily_bets || 1000,
      max_monthly_volume: max_monthly_volume || 1000000,
      max_api_calls_daily: max_api_calls_daily || 10000,
      max_storage_mb: max_storage_mb || 1000,
      included_features: included_features || [],
      pricing_model: pricing_model || 'flat',
      is_public: is_public !== false,
      badge_text,
      highlight: highlight || false,
    })
    
    // Log action
    await supabase.from('admin_action_timeline').insert({
      action_type: 'package_created',
      target_type: 'package',
      target_id: newPackage.id,
      description: `Created package: ${name} (${code})`,
      after_state: newPackage,
    })
    
    return NextResponse.json({
      success: true,
      data: newPackage
    })
  } catch (error) {
    console.error('Error creating package:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create package' },
      { status: 500 }
    )
  }
}

// PUT /api/packages - Update package
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, ...updates } = body
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Package ID is required' },
        { status: 400 }
      )
    }
    
    const updated = await updatePackage(id, updates)
    
    await supabase.from('admin_action_timeline').insert({
      action_type: 'package_updated',
      target_type: 'package',
      target_id: id,
      description: `Updated package: ${updated.name}`,
      after_state: updates,
    })
    
    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating package:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update package' },
      { status: 500 }
    )
  }
}

// DELETE /api/packages - Deactivate package
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Package ID is required' },
        { status: 400 }
      )
    }
    
    // Check if any tenants are using this package
    const { count } = await supabase
      .from('tenant_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('package_id', id)
      .in('status', ['active', 'trial'])
    
    if (count && count > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot deactivate: ${count} active subscriptions` },
        { status: 400 }
      )
    }
    
    await deactivatePackage(id)
    
    await supabase.from('admin_action_timeline').insert({
      action_type: 'package_deactivated',
      target_type: 'package',
      target_id: id,
      description: 'Deactivated package',
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating package:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate package' },
      { status: 500 }
    )
  }
}
