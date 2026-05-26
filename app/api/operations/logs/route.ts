import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/operations/logs - View production logs
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const level = searchParams.get('level') // 'error', 'warn', 'info', 'critical'
    const category = searchParams.get('category') // 'api', 'settlement', 'payout', etc.
    const hours = parseInt(searchParams.get('hours') || '24')
    const limit = parseInt(searchParams.get('limit') || '100')
    
    let query = supabase
      .from('production_logs')
      .select('*')
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (level) {
      query = query.eq('level', level)
    }
    if (category) {
      query = query.eq('category', category)
    }
    
    const { data: logs, error } = await query
    
    if (error) {
      console.error('Failed to fetch logs:', error)
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }
    
    // Get error summary
    const { data: summary } = await supabase
      .from('production_error_summary')
      .select('*')
      .limit(48)
    
    // Get stats
    const { count: totalErrors } = await supabase
      .from('production_logs')
      .select('*', { count: 'exact', head: true })
      .in('level', ['error', 'critical'])
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    
    const { count: totalWarnings } = await supabase
      .from('production_logs')
      .select('*', { count: 'exact', head: true })
      .eq('level', 'warn')
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    
    // Get slow requests (> 1000ms)
    const { data: slowRequests } = await supabase
      .from('production_logs')
      .select('*')
      .gt('duration_ms', 1000)
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('duration_ms', { ascending: false })
      .limit(10)
    
    return NextResponse.json({
      logs: logs || [],
      summary: summary || [],
      stats: {
        total_errors: totalErrors || 0,
        total_warnings: totalWarnings || 0,
        slow_requests: slowRequests?.length || 0,
        time_range_hours: hours,
      },
      slow_requests: slowRequests || [],
    })
  } catch (error) {
    console.error('Logs API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
