import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Auth guard - require super_admin for platform-wide KPIs
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult
    
    const supabase = await createClient()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

    // Parallel queries for all KPIs
    const [
      customersResult,
      entriesResult,
      payoutsResult,
      exposureResult,
      settlementResult,
      failedJobsResult,
      globalControlsResult,
      recentActivityResult,
    ] = await Promise.all([
      // Active users today
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('is_active', true),
      
      // Betting volume today
      supabase.from('entries').select('amount').gte('created_at', todayStart).not('legacy_orphan', 'eq', true),
      
      // Payouts today
      supabase.from('entries').select('payout_amount').eq('status', 'won').gte('created_at', todayStart),
      
      // Current exposure (pending bets)
      supabase.from('entries').select('amount').in('status', ['pending', 'confirmed', 'active']).not('legacy_orphan', 'eq', true),
      
      // Settlement speed (avg processing time for results today)
      supabase.from('lottery_results').select('processing_started_at, created_at').eq('is_processed', true).gte('created_at', todayStart),
      
      // Failed jobs in last hour
      supabase.from('production_logs').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', hourAgo),
      
      // System status from global_controls
      supabase.from('global_controls').select('control_key, is_enabled'),
      
      // Recent activity (entries in last hour)
      supabase.from('entries').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo).not('legacy_orphan', 'eq', true),
    ])

    // Calculate KPIs
    const activeUsers = customersResult.count || 0
    const bettingVolume = (entriesResult.data || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const payoutTotal = (payoutsResult.data || []).reduce((sum, e) => sum + (Number(e.payout_amount) || 0), 0)
    const currentExposure = (exposureResult.data || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const failedJobs = failedJobsResult.count || 0
    const recentActivity = recentActivityResult.count || 0

    // Settlement speed calculation
    let avgSettlementMs = 0
    const settlements = settlementResult.data || []
    if (settlements.length > 0) {
      const totalMs = settlements.reduce((sum, s) => {
        if (s.processing_started_at && s.created_at) {
          return sum + (new Date(s.processing_started_at).getTime() - new Date(s.created_at).getTime())
        }
        return sum
      }, 0)
      avgSettlementMs = totalMs / settlements.length
    }

    // System health based on global controls
    const controls = globalControlsResult.data || []
    const disabledControls = controls.filter(c => !c.is_enabled).map(c => c.control_key)
    const systemHealth = disabledControls.length === 0 ? 'healthy' : 
                         disabledControls.length <= 2 ? 'degraded' : 'critical'

    // Uptime calculation (simplified - based on errors)
    const uptime = failedJobs === 0 ? 100 : Math.max(0, 100 - (failedJobs * 2))

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      kpis: {
        activeUsers,
        bettingVolume,
        payoutTotal,
        currentExposure,
        avgSettlementMs: Math.round(avgSettlementMs),
        failedJobs,
        recentActivity,
        uptime,
        systemHealth,
        disabledControls,
      },
      trends: {
        // Placeholder for trend data - would need historical comparison
        bettingTrend: 'stable',
        payoutTrend: 'stable',
        errorTrend: failedJobs > 5 ? 'up' : 'stable',
      }
    })
  } catch (error) {
    console.error('KPI fetch error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch KPIs' 
    }, { status: 500 })
  }
}
