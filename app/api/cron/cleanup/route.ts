/**
 * Cron: Cleanup Worker
 * Runs daily at 3 AM to clean up expired locks, old metrics, etc.
 * 
 * Vercel Cron Config (add to vercel.json):
 * {
 *   "crons": [
 *     { "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkerProcessor } from '@/lib/worker-processor'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const processor = getWorkerProcessor()
    const result = await processor.processCleanupWorker()

    console.log(`[Cron:Cleanup] Completed - Processed: ${result.jobsProcessed}, Duration: ${result.durationMs}ms`)

    return NextResponse.json({
      success: true,
      data: {
        runId: result.runId,
        status: result.status,
        jobsProcessed: result.jobsProcessed,
        jobsSucceeded: result.jobsSucceeded,
        durationMs: result.durationMs,
      }
    })
  } catch (err) {
    console.error('[Cron:Cleanup] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
