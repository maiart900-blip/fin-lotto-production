import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { AutoRecovery } from '@/lib/auto-recovery'

export const runtime = 'nodejs'

// Cron job for auto-recovery / self-healing.
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
// CRON_SECRET is configured. We also accept RECOVERY_SECRET as a fallback so the
// endpoint can be triggered by an external scheduler or manual run.

/**
 * Timing-safe comparison of the presented bearer token against a configured secret.
 * Returns false when either side is missing (fail-closed).
 */
function tokenMatches(presented: string | null, secret: string | undefined): boolean {
  if (!presented || !secret) return false
  const a = Buffer.from(presented)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function isAuthorized(authHeader: string | null): { ok: boolean; configured: boolean } {
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const cronSecret = process.env.CRON_SECRET
  const recoverySecret = process.env.RECOVERY_SECRET
  const configured = Boolean(cronSecret || recoverySecret)

  // Fail closed: if no secret is configured at all, never authorize.
  if (!configured) return { ok: false, configured: false }

  const ok = tokenMatches(bearer, cronSecret) || tokenMatches(bearer, recoverySecret)
  return { ok, configured: true }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const { ok, configured } = isAuthorized(authHeader)

  if (!configured) {
    // No secret configured in the environment — refuse rather than run unprotected.
    console.error('[AutoRecovery] No CRON_SECRET or RECOVERY_SECRET configured; refusing to run')
    return NextResponse.json(
      { success: false, error: 'Server not configured for cron authentication' },
      { status: 503 },
    )
  }

  if (!ok) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const recovery = new AutoRecovery()
    const results = await recovery.runAutoRecovery()

    console.log(
      `[AutoRecovery] Completed: locks_released=${results.locks_released}, ` +
        `workers_restarted=${results.workers_restarted}, payouts_retried=${results.payouts_retried}, ` +
        `health=${results.health.overall}/${results.health.mode}`,
    )

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        locks_released: results.locks_released,
        workers_restarted: results.workers_restarted,
        payouts_retried: results.payouts_retried,
        health_overall: results.health.overall,
        system_mode: results.health.mode,
        alerts: results.health.alerts,
      },
    })
  } catch (error) {
    console.error('[AutoRecovery] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
