/**
 * Settlement API Routes
 * Handles settlement batch creation, processing, and management
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSettlementEngine, BetToSettle, BatchType } from '@/lib/settlement-engine'
import { getAuthenticatedUser } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser()
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const engine = getSettlementEngine()

    switch (action) {
      case 'list': {
        const status = searchParams.get('status') as string | undefined
        const batchType = searchParams.get('batch_type') as BatchType | undefined
        const referenceDate = searchParams.get('reference_date') || undefined
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')

        const result = await engine.listBatches({
          status: status as any,
          batchType,
          referenceDate,
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
        const batchId = searchParams.get('batch_id')
        if (!batchId) {
          return NextResponse.json({ error: 'batch_id required' }, { status: 400 })
        }

        const batch = await engine.getBatch(batchId)
        if (!batch) {
          return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: batch })
      }

      case 'items': {
        const batchId = searchParams.get('batch_id')
        if (!batchId) {
          return NextResponse.json({ error: 'batch_id required' }, { status: 400 })
        }

        const status = searchParams.get('status') as string | undefined
        const items = await engine.getBatchItems(batchId, status as any)

        return NextResponse.json({ success: true, data: items })
      }

      case 'stats': {
        const supabase = await createClient()

        const { data: stats } = await supabase
          .from('settlement_batches')
          .select('status, total_bets, total_bet_amount, total_winnings, total_payouts, net_revenue')

        if (!stats || stats.length === 0) {
          return NextResponse.json({
            success: true,
            data: {
              totalBatches: 0,
              totalBets: 0,
              totalBetAmount: 0,
              totalWinnings: 0,
              totalPayouts: 0,
              netRevenue: 0,
              byStatus: {},
            },
          })
        }

        const byStatus: Record<string, number> = {}
        let totalBets = 0
        let totalBetAmount = 0
        let totalWinnings = 0
        let totalPayouts = 0
        let netRevenue = 0

        for (const batch of stats) {
          byStatus[batch.status] = (byStatus[batch.status] || 0) + 1
          totalBets += batch.total_bets || 0
          totalBetAmount += Number(batch.total_bet_amount) || 0
          totalWinnings += Number(batch.total_winnings) || 0
          totalPayouts += Number(batch.total_payouts) || 0
          netRevenue += Number(batch.net_revenue) || 0
        }

        return NextResponse.json({
          success: true,
          data: {
            totalBatches: stats.length,
            totalBets,
            totalBetAmount,
            totalWinnings,
            totalPayouts,
            netRevenue,
            byStatus,
          },
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('[Settlement API] GET error:', error)
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
    const engine = getSettlementEngine()

    switch (action) {
      case 'create': {
        const { batchType, referenceType, referenceId, referenceDate, tenantId } = body

        if (!batchType) {
          return NextResponse.json({ error: 'batchType required' }, { status: 400 })
        }

        const batch = await engine.createBatch({
          batchType,
          referenceType,
          referenceId,
          referenceDate,
          createdBy: authResult.user.id,
          tenantId,
        })

        return NextResponse.json({ success: true, data: batch })
      }

      case 'add_bets': {
        const { batchId, bets } = body as { batchId: string; bets: BetToSettle[] }

        if (!batchId || !bets || !Array.isArray(bets)) {
          return NextResponse.json({ error: 'batchId and bets array required' }, { status: 400 })
        }

        const items = await engine.addBetsToSettlement(batchId, bets)

        return NextResponse.json({ success: true, data: items })
      }

      case 'process': {
        const { batchId } = body

        if (!batchId) {
          return NextResponse.json({ error: 'batchId required' }, { status: 400 })
        }

        const result = await engine.processBatch(batchId)

        return NextResponse.json({
          success: result.success,
          data: result.batch,
          processed: result.processed,
          failed: result.failed,
          errors: result.errors,
        })
      }

      case 'reverse': {
        const { batchId, reason } = body

        if (!batchId || !reason) {
          return NextResponse.json({ error: 'batchId and reason required' }, { status: 400 })
        }

        await engine.reverseBatch(batchId, reason, authResult.user.id)

        return NextResponse.json({ success: true })
      }

      case 'settle_draw': {
        // Convenience endpoint to settle a lottery draw
        const { drawId, results, tenantId } = body as {
          drawId: string
          results: Array<{
            bet_id: string
            user_id: string
            agent_id?: string
            bet_amount: number
            odds?: number
            result: 'win' | 'lose' | 'void'
            winning_amount?: number
          }>
          tenantId?: string
        }

        if (!drawId || !results || !Array.isArray(results)) {
          return NextResponse.json({ error: 'drawId and results array required' }, { status: 400 })
        }

        // Create batch
        const batch = await engine.createBatch({
          batchType: 'lottery_draw',
          referenceType: 'lottery_draw',
          referenceId: drawId,
          referenceDate: new Date().toISOString().split('T')[0],
          createdBy: authResult.user.id,
          tenantId,
        })

        // Add bets
        const bets: BetToSettle[] = results.map(r => ({
          bet_id: r.bet_id,
          user_id: r.user_id,
          agent_id: r.agent_id,
          bet_amount: r.bet_amount,
          odds: r.odds,
          result: r.result,
          winning_amount: r.winning_amount,
        }))

        await engine.addBetsToSettlement(batch.id, bets)

        // Process settlement
        const result = await engine.processBatch(batch.id)

        return NextResponse.json({
          success: result.success,
          data: {
            batch: result.batch,
            processed: result.processed,
            failed: result.failed,
          },
          errors: result.errors.length > 0 ? result.errors : undefined,
        })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('[Settlement API] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
