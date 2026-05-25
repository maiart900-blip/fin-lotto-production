/**
 * Cron: Payout Worker
 * Runs every 5 minutes to process queued payouts
 * 
 * Vercel Cron Config (add to vercel.json):
 * { "crons": [{ "path": "/api/cron/payout", "schedule": "0/5 * * * *" }] }
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
    const result = await processor.processPayoutWorker()

    console.log(`[Cron:Payout] Completed - Processed: ${result.jobsProcessed}, Succeeded: ${result.jobsSucceeded}, Failed: ${result.jobsFailed}`)

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
    console.error('[Cron:Payout] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
