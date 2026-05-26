/**
 * Payout API Routes
 * Handles payout job creation, processing, and management
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayoutOrchestrator, PayoutType, PayoutStatus } from '@/lib/payout-orchestrator'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser()
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const orchestrator = getPayoutOrchestrator()

    switch (action) {
      case 'list': {
        const memberId = searchParams.get('member_id') || undefined
        const status = searchParams.get('status') as PayoutStatus | undefined
        const payoutType = searchParams.get('payout_type') as PayoutType | undefined
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        const result = await orchestrator.listJobs({
          memberId,
          status,
          payoutType,
          limit,
          offset,
        })

        return NextResponse.json({
          success: true,
          data: result.data,
          pagination: {
            total: result.total,
            limit,
            offset,
          },
        })
      }

      case 'get': {
        const jobId = searchParams.get('job_id')
        if (!jobId) {
          return NextResponse.json({ error: 'job_id required' }, { status: 400 })
        }

        const job = await orchestrator.getJob(jobId)
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: job })
      }

      case 'stats': {
        const startDate = searchParams.get('start_date') || undefined
        const endDate = searchParams.get('end_date') || undefined
        const memberId = searchParams.get('member_id') || undefined

        const stats = await orchestrator.getStats({ startDate, endDate, memberId })

        return NextResponse.json({ success: true, data: stats })
      }

      case 'queue_status': {
        const { data } = await orchestrator.listJobs({ status: 'queued', limit: 1000 })

        return NextResponse.json({
          success: true,
          data: {
            queuedCount: data.length,
            totalAmount: data.reduce((sum, j) => sum + Number(j.amount), 0),
          },
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('[Payout API] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
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
    const orchestrator = getPayoutOrchestrator()

    switch (action) {
      case 'create': {
        const {
          memberId,
          memberName,
          amount,
          feeAmount,
          payoutType,
          bankCode,
          bankName,
          accountNumber,
          accountName,
          paymentMethod,
          settlementBatchId,
          settlementItemId,
          idempotencyKey,
          tenantId,
          metadata,
        } = body

        if (!memberId || !amount || !payoutType) {
          return NextResponse.json(
            { error: 'memberId, amount, and payoutType required' },
            { status: 400 }
          )
        }

        const job = await orchestrator.createPayout({
          memberId,
          memberName,
          amount,
          feeAmount,
          payoutType,
          bankCode,
          bankName,
          accountNumber,
          accountName,
          paymentMethod,
          settlementBatchId,
          settlementItemId,
          idempotencyKey,
          tenantId,
          metadata,
        })

        return NextResponse.json({ success: true, data: job })
      }

      case 'process': {
        const { jobId } = body

        if (!jobId) {
          return NextResponse.json({ error: 'jobId required' }, { status: 400 })
        }

        const job = await orchestrator.processJob(jobId)

        return NextResponse.json({ success: true, data: job })
      }

      case 'process_queue': {
        const { limit } = body

        const result = await orchestrator.processQueue(limit || 50)

        return NextResponse.json({
          success: true,
          data: result,
        })
      }

      case 'retry_failed': {
        const { limit } = body

        const result = await orchestrator.retryFailed(limit || 20)

        return NextResponse.json({
          success: true,
          data: result,
        })
      }

      case 'cancel': {
        const { jobId, reason } = body

        if (!jobId || !reason) {
          return NextResponse.json({ error: 'jobId and reason required' }, { status: 400 })
        }

        await orchestrator.cancelJob(jobId, reason)

        return NextResponse.json({ success: true })
      }

      case 'reverse': {
        const { jobId, reason } = body

        if (!jobId || !reason) {
          return NextResponse.json({ error: 'jobId and reason required' }, { status: 400 })
        }

        await orchestrator.reverseJob(jobId, reason, authResult.user.id)

        return NextResponse.json({ success: true })
      }

      case 'bulk_payout': {
        // Create multiple payouts at once
        const { payouts, tenantId } = body as {
          payouts: Array<{
            memberId: string
            memberName?: string
            amount: number
            payoutType: PayoutType
            bankCode?: string
            accountNumber?: string
            accountName?: string
          }>
          tenantId?: string
        }

        if (!payouts || !Array.isArray(payouts)) {
          return NextResponse.json({ error: 'payouts array required' }, { status: 400 })
        }

        const results: Array<{ memberId: string; success: boolean; jobId?: string; error?: string }> = []

        for (const payout of payouts) {
          try {
            const job = await orchestrator.createPayout({
              ...payout,
              tenantId,
              idempotencyKey: `bulk:${Date.now()}:${payout.memberId}`,
            })
            results.push({ memberId: payout.memberId, success: true, jobId: job.id })
          } catch (err) {
            results.push({
              memberId: payout.memberId,
              success: false,
              error: err instanceof Error ? err.message : 'Unknown error',
            })
          }
        }

        const successCount = results.filter(r => r.success).length

        return NextResponse.json({
          success: successCount === payouts.length,
          data: {
            total: payouts.length,
            succeeded: successCount,
            failed: payouts.length - successCount,
            results,
          },
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('[Payout API] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
