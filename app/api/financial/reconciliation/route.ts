/**
 * Reconciliation API Routes
 * Handles reconciliation report creation and retrieval
 */

import { NextRequest, NextResponse } from 'next/server'
import { getReconciliationEngine, ReportType, ReportStatus } from '@/lib/reconciliation-engine'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser()
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    
    const engine = getReconciliationEngine()

    switch (action) {
      case 'list': {
        const status = searchParams.get('status') as ReportStatus | undefined
        const limit = parseInt(searchParams.get('limit') || '30')
        const reports = await engine.getReports(status, limit)
        return NextResponse.json({ success: true, data: reports })
      }

      case 'get': {
        const reportId = searchParams.get('report_id')
        if (!reportId) {
          return NextResponse.json({ error: 'report_id required' }, { status: 400 })
        }
        const report = await engine.getReport(reportId)
        if (!report) {
          return NextResponse.json({ error: 'Report not found' }, { status: 404 })
        }
        return NextResponse.json({ success: true, data: report })
      }

      case 'stats': {
        const stats = await engine.getStats()
        return NextResponse.json({ success: true, data: stats })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[Reconciliation API] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser()
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body
    const engine = getReconciliationEngine()

    switch (action) {
      case 'run': {
        const { reportType, reportDate } = body
        const type = (reportType || 'daily') as ReportType
        const date = reportDate ? new Date(reportDate) : new Date()

        const result = await engine.runReconciliation(type, date)
        return NextResponse.json({ success: true, data: result })
      }

      case 'resolve': {
        const { reportId, notes } = body
        if (!reportId) {
          return NextResponse.json({ error: 'reportId required' }, { status: 400 })
        }

        await engine.resolveReport(reportId, authResult.user.id, notes)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[Reconciliation API] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
