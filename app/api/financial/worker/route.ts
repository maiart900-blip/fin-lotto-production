/**
 * Worker API Routes
 * Handles worker execution triggers and status monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWorkerProcessor, WorkerType } from '@/lib/worker-processor'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser()
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    const workerType = searchParams.get('worker_type') as WorkerType | undefined
    
    const processor = getWorkerProcessor()

    switch (action) {
      case 'status': {
        const runs = await processor.getWorkerStatus(workerType)
        return NextResponse.json({ success: true, data: runs })
      }

      case 'metrics': {
        if (!workerType) {
          return NextResponse.json({ error: 'worker_type required' }, { status: 400 })
        }
        const metricName = searchParams.get('metric_name') || undefined
        const hoursBack = parseInt(searchParams.get('hours_back') || '24')
        const metrics = await processor.getWorkerMetrics(workerType, metricName, hoursBack)
        return NextResponse.json({ success: true, data: metrics })
      }

      case 'dead_letter': {
        const status = searchParams.get('status') || undefined
        const limit = parseInt(searchParams.get('limit') || '50')
        const jobs = await processor.getDeadLetterJobs(status, limit)
        return NextResponse.json({ success: true, data: jobs })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[Worker API] Error:', err)
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
    const { action, workerType } = body
    const processor = getWorkerProcessor()

    switch (action) {
      case 'run': {
        if (!workerType) {
          return NextResponse.json({ error: 'workerType required' }, { status: 400 })
        }

        let result
        switch (workerType as WorkerType) {
          case 'settlement':
            result = await processor.processSettlementWorker()
            break
          case 'payout':
            result = await processor.processPayoutWorker()
            break
          case 'retry':
            result = await processor.processRetryWorker()
            break
          case 'cleanup':
            result = await processor.processCleanupWorker()
            break
          default:
            return NextResponse.json({ error: 'Invalid workerType' }, { status: 400 })
        }

        return NextResponse.json({ success: true, data: result })
      }

      case 'resolve_dead_letter': {
        const { jobId, notes } = body
        if (!jobId) {
          return NextResponse.json({ error: 'jobId required' }, { status: 400 })
        }

        await processor.resolveDeadLetterJob(jobId, authResult.user.id, notes)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[Worker API] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
