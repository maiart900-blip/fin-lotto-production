/**
 * Cron: Retry Worker
 * Runs every 15 minutes to retry failed jobs from dead letter queue
 * 
 * Vercel Cron Config (add to vercel.json):
 * { "crons": [{ "path": "/api/cron/retry", "schedule": "0/15 * * * *" }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkerProcessor } from '@/lib/worker-processor'

export const runtime = 'nodejs'
export const maxDuration = 120 // 2 minutes max

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const processor = getWorkerProcessor()
    const result = await processor.processRetryWorker()

    console.log(`[Cron:Retry] Completed - Processed: ${result.jobsProcessed}, Succeeded: ${result.jobsSucceeded}, Failed: ${result.jobsFailed}`)

    return NextResponse.json({
      success: true,
      data: {
        runId: result.runId,
        status: result.status,
        jobsProcessed: result.jobsProcessed,
        jobsSucceeded: result.jobsSucceeded,
        jobsFailed: result.jobsFailed,
        durationMs: result.durationMs,
      }
    })
  } catch (err) {
    console.error('[Cron:Retry] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
