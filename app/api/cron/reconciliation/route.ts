/**
 * Cron: Reconciliation Worker
 * Runs daily at 2 AM to reconcile all financial data
 * 
 * Vercel Cron Config (add to vercel.json):
 * {
 *   "crons": [
 *     { "path": "/api/cron/reconciliation", "schedule": "0 2 * * *" }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getReconciliationEngine } from '@/lib/reconciliation-engine'
import { getWorkerProcessor } from '@/lib/worker-processor'

export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes max

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workerProcessor = getWorkerProcessor()
  const runId = `reconciliation-cron-${Date.now()}`
  const startTime = Date.now()

  try {
    // Start run tracking
    await workerProcessor.recordMetric('reconciliation', 'cron_started', 1)

    const engine = getReconciliationEngine()
    
    // Run reconciliation for yesterday (complete day)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const result = await engine.runReconciliation('daily', yesterday)

    const durationMs = Date.now() - startTime
    
    // Record metrics
    await workerProcessor.recordMetric('reconciliation', 'cron_completed', 1)
    await workerProcessor.recordMetric('reconciliation', 'duration_ms', durationMs, 'ms')
    await workerProcessor.recordMetric('reconciliation', 'issues_found', result.issues.length)
    await workerProcessor.recordMetric('reconciliation', 'total_variance', result.totalVariance, 'THB')

    console.log(`[Cron:Reconciliation] Completed - Report: ${result.reportNumber}, Mismatches: ${result.hasMismatches}, Variance: ${result.totalVariance}`)

    return NextResponse.json({
      success: true,
      data: {
        reportId: result.reportId,
        reportNumber: result.reportNumber,
        status: result.status,
        hasMismatches: result.hasMismatches,
        totalVariance: result.totalVariance,
        issueCount: result.issues.length,
        durationMs,
      }
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Cron:Reconciliation] Error:', error)
    
    await workerProcessor.recordMetric('reconciliation', 'cron_failed', 1)
    
    return NextResponse.json({ error }, { status: 500 })
  }
}
