/**
 * Auto-Recovery endpoint + engine tests.
 *
 * Runs with: pnpm test:auto-recovery  (tsx, no external test runner required)
 *
 * SAFETY: Every test injects a fake Supabase client. No real database, Redis,
 * or network access occurs. Production data is never touched.
 */

import { AutoRecovery } from '@/lib/auto-recovery'
import { GET } from '@/app/api/cron/auto-recovery/route'

// ---------------- tiny test harness ----------------
let passed = 0
let failed = 0
const failures: string[] = []

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++
    console.log(`  ok  - ${msg}`)
  } else {
    failed++
    failures.push(msg)
    console.log(`  FAIL- ${msg}`)
  }
}
function eq(actual: unknown, expected: unknown, msg: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${msg} (got ${JSON.stringify(actual)})`)
}

// ---------------- fake Supabase ----------------
type Filter = [string, string, unknown]
interface QState {
  table: string
  op: string
  filters: Filter[]
  payload?: unknown
  single?: boolean
  head?: boolean
}
type Handler = (s: QState) => { data?: unknown; error?: unknown; count?: number }

class FakeQuery {
  s: QState
  constructor(table: string, private handler: Handler) {
    this.s = { table, op: 'select', filters: [] }
  }
  select(_cols?: unknown, opts?: { head?: boolean }) {
    if (opts?.head) this.s.head = true
    return this
  }
  insert(v: unknown) { this.s.op = 'insert'; this.s.payload = v; return this }
  update(v: unknown) { this.s.op = 'update'; this.s.payload = v; return this }
  upsert(v: unknown) { this.s.op = 'upsert'; this.s.payload = v; return this }
  delete() { this.s.op = 'delete'; return this }
  eq(k: string, v: unknown) { this.s.filters.push(['eq', k, v]); return this }
  neq(k: string, v: unknown) { this.s.filters.push(['neq', k, v]); return this }
  lt(k: string, v: unknown) { this.s.filters.push(['lt', k, v]); return this }
  lte(k: string, v: unknown) { this.s.filters.push(['lte', k, v]); return this }
  gt(k: string, v: unknown) { this.s.filters.push(['gt', k, v]); return this }
  gte(k: string, v: unknown) { this.s.filters.push(['gte', k, v]); return this }
  or(expr: string) { this.s.filters.push(['or', 'or', expr]); return this }
  limit(n: number) { this.s.filters.push(['limit', 'limit', n]); return this }
  order() { return this }
  maybeSingle() { this.s.single = true; return Promise.resolve(this.handler(this.s)) }
  single() { this.s.single = true; return Promise.resolve(this.handler(this.s)) }
  then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
    return Promise.resolve(this.handler(this.s)).then(res, rej)
  }
}

function makeClient(handler: Handler) {
  return {
    from: (t: string) => new FakeQuery(t, handler),
    rpc: (name: string, args: unknown) =>
      Promise.resolve(handler({ table: '__rpc__', op: name, filters: [], payload: args })),
  }
}

function inject(recovery: AutoRecovery, handler: Handler) {
  // getSupabase() returns this.supabase if already set → no createClient() call.
  ;(recovery as unknown as { supabase: unknown }).supabase = makeClient(handler)
}

function filterVal(s: QState, key: string): unknown {
  return s.filters.find((f) => f[1] === key)?.[2]
}

// Remove Redis config so checkRedisHealth short-circuits to "not configured".
function neutralizeRedis() {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
}

// ============================================================
async function testAuthorization() {
  console.log('\n[1] AUTHORIZATION')
  const url = 'http://localhost/api/cron/auto-recovery'
  const origCron = process.env.CRON_SECRET
  const origRecovery = process.env.RECOVERY_SECRET

  // 1a. No secret configured at all → 503 (fail closed, refuse to run)
  delete process.env.CRON_SECRET
  delete process.env.RECOVERY_SECRET
  let res = await GET(new Request(url, { headers: { authorization: 'Bearer anything' } }))
  eq(res.status, 503, 'no secret configured → 503 (refuse to run unprotected)')

  // 1b. Secret configured, missing header → 401
  process.env.CRON_SECRET = 'test-cron-secret'
  res = await GET(new Request(url))
  eq(res.status, 401, 'missing Authorization header → 401')

  // 1c. Secret configured, wrong token → 401
  res = await GET(new Request(url, { headers: { authorization: 'Bearer wrong' } }))
  eq(res.status, 401, 'wrong bearer token → 401')

  // Stub the engine so the AUTHORIZED path does not touch any real client.
  const originalRun = AutoRecovery.prototype.runAutoRecovery
  ;(AutoRecovery.prototype as unknown as { runAutoRecovery: () => Promise<unknown> }).runAutoRecovery =
    async () => ({
      locks_released: 0,
      workers_restarted: 0,
      payouts_retried: 0,
      health: { overall: 'healthy', mode: 'normal', components: [], alerts: [], last_updated: 'x' },
    })

  try {
    // 1d. Correct CRON_SECRET → 200
    res = await GET(new Request(url, { headers: { authorization: 'Bearer test-cron-secret' } }))
    eq(res.status, 200, 'correct CRON_SECRET → 200')
    const body = (await res.json()) as { success: boolean; summary: { system_mode: string } }
    assert(body.success === true, 'authorized response success=true')
    eq(body.summary.system_mode, 'normal', 'authorized response includes system_mode')

    // 1e. RECOVERY_SECRET fallback works when CRON_SECRET absent
    delete process.env.CRON_SECRET
    process.env.RECOVERY_SECRET = 'test-recovery-secret'
    res = await GET(new Request(url, { headers: { authorization: 'Bearer test-recovery-secret' } }))
    eq(res.status, 200, 'correct RECOVERY_SECRET fallback → 200')
  } finally {
    ;(AutoRecovery.prototype as unknown as { runAutoRecovery: typeof originalRun }).runAutoRecovery =
      originalRun
    if (origCron === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = origCron
    if (origRecovery === undefined) delete process.env.RECOVERY_SECRET
    else process.env.RECOVERY_SECRET = origRecovery
  }
}

// ============================================================
async function testRecoveryExecution() {
  console.log('\n[2] AUTO-RECOVERY EXECUTION (runAutoRecovery, all healthy)')
  neutralizeRedis()
  const recovery = new AutoRecovery()
  inject(recovery, (s) => {
    if (s.table === 'worker_locks' && s.op === 'select') return { data: [] }
    if (s.table === 'worker_locks' && s.op === 'delete') return { error: null }
    if (s.table === 'recovery_events' && s.op === 'insert') return { error: null }
    if (s.table === 'system_settings' && s.single) return { data: { value: 'normal' } }
    if (s.table === 'system_settings' && s.op === 'select') return { error: null }
    if (s.table === 'entries' && s.op === 'select') return { data: [] }
    if (s.table === 'background_jobs' && s.head) return { count: 0 }
    return { data: [], error: null }
  })
  const r = await recovery.runAutoRecovery()
  eq(r.locks_released, 0, 'no expired locks released')
  eq(r.workers_restarted, 0, 'no workers restarted')
  eq(r.payouts_retried, 0, 'no payouts retried when none failed')
  eq(r.health.overall, 'healthy', 'overall health = healthy')
  eq(r.health.mode, 'normal', 'system mode = normal')
  eq(r.health.components.length, 4, 'health reports 4 components (db, redis, workers, queue)')
}

// ============================================================
async function testFailedPayoutRetry() {
  console.log('\n[3] FAILED PAYOUT RETRY (success path)')
  let rpcCalls = 0
  const recovery = new AutoRecovery()
  inject(recovery, (s) => {
    if (s.table === 'entries' && s.op === 'select')
      return { data: [{ id: 'e1', customer_id: 'c1', payout_amount: 100, payout_retry_count: 0 }] }
    if (s.table === 'ledger_entries') return { data: null } // no existing credit
    if (s.table === '__rpc__' && s.op === 'safe_payout_with_ledger') {
      rpcCalls++
      return { error: null } // payout succeeds
    }
    if (s.table === 'entries' && s.op === 'update') return { error: null }
    if (s.table === 'recovery_events') return { error: null }
    return { data: [], error: null }
  })
  const r = await recovery.retryFailedPayouts()
  eq(r.retried, 1, 'retried 1 failed payout')
  eq(r.succeeded, 1, 'payout succeeded after retry')
  eq(r.failed, 0, 'no failures')
  assert(rpcCalls === 1, 'safe_payout_with_ledger RPC called exactly once')
}

// ============================================================
async function testIdempotency() {
  console.log('\n[4] IDEMPOTENCY (ledger already has payout → no double pay)')
  let rpcCalls = 0
  const recovery = new AutoRecovery()
  inject(recovery, (s) => {
    if (s.table === 'entries' && s.op === 'select')
      return { data: [{ id: 'e1', customer_id: 'c1', payout_amount: 100, payout_retry_count: 1 }] }
    if (s.table === 'ledger_entries') return { data: { id: 'existing-ledger' } } // already paid!
    if (s.table === '__rpc__') { rpcCalls++; return { error: null } }
    if (s.table === 'entries' && s.op === 'update') return { error: null }
    if (s.table === 'recovery_events') return { error: null }
    return { data: [], error: null }
  })
  const r = await recovery.retryFailedPayouts()
  eq(r.succeeded, 1, 'already-paid entry marked completed')
  assert(rpcCalls === 0, 'RPC NOT called again — idempotent, no double payout')
}

// ============================================================
async function testStuckWorkerRecovery() {
  console.log('\n[5] STUCK WORKER RECOVERY')
  // 5a. under restart cap → releases lock, returns true
  const r1 = new AutoRecovery()
  inject(r1, (s) => {
    if (s.table === 'recovery_events' && s.head) return { count: 0 } // 0 restarts this hour
    if (s.table === 'worker_locks' && s.op === 'delete') return { error: null }
    if (s.table === 'recovery_events' && s.op === 'insert') return { error: null }
    return { data: [], error: null }
  })
  eq(await r1.restartStuckWorker('daily-closing'), true, 'stuck worker restarted (lock released)')

  // 5b. over restart cap → refuses, triggers alert, returns false
  const r2 = new AutoRecovery()
  let alerted = false
  inject(r2, (s) => {
    if (s.table === 'recovery_events' && s.head) return { count: 5 } // at cap
    if (s.table === 'operational_alerts' && s.op === 'insert') { alerted = true; return { error: null } }
    return { data: [], error: null }
  })
  eq(await r2.restartStuckWorker('daily-closing'), false, 'refuses restart when hourly cap reached')
  assert(alerted, 'excessive-restart alert raised')
}

// ============================================================
async function testHealthCheck() {
  console.log('\n[6] HEALTH CHECK')
  neutralizeRedis()

  // 6a. all healthy
  const rh = new AutoRecovery()
  inject(rh, (s) => {
    if (s.table === 'system_settings' && s.single) return { data: { value: 'normal' } }
    if (s.table === 'system_settings') return { error: null }
    if (s.table === 'worker_locks') return { data: [] }
    if (s.table === 'background_jobs' && s.head) return { count: 0 }
    return { data: [], error: null }
  })
  const h = await rh.checkSystemHealth()
  eq(h.overall, 'healthy', 'all components healthy')
  eq(h.mode, 'normal', 'mode normal when healthy')

  // 6b. degraded: 3 stuck workers → workers unhealthy → overall degraded + mode transition
  const rd = new AutoRecovery()
  let modePersisted = false
  const stuck = [
    { worker_type: 'w1', locked_at: new Date(0).toISOString() },
    { worker_type: 'w2', locked_at: new Date(0).toISOString() },
    { worker_type: 'w3', locked_at: new Date(0).toISOString() },
  ]
  inject(rd, (s) => {
    if (s.table === 'system_settings' && s.single) return { data: { value: 'normal' } }
    if (s.table === 'system_settings' && s.op === 'upsert') { modePersisted = true; return { error: null } }
    if (s.table === 'system_settings') return { error: null }
    if (s.table === 'worker_locks') return { data: stuck }
    if (s.table === 'background_jobs' && s.head) return { count: 0 }
    if (s.table === 'recovery_events') return { error: null }
    if (s.table === 'operational_alerts') return { error: null }
    return { data: [], error: null }
  })
  const hd = await rd.checkSystemHealth()
  eq(hd.overall, 'degraded', 'overall degraded when 3 workers stuck')
  eq(hd.mode, 'degraded', 'mode transitions to degraded')
  assert(modePersisted, 'degraded mode persisted to system_settings')
}

// ============================================================
async function main() {
  console.log('=== AUTO-RECOVERY TEST SUITE ===')
  await testAuthorization()
  await testRecoveryExecution()
  await testFailedPayoutRetry()
  await testIdempotency()
  await testStuckWorkerRecovery()
  await testHealthCheck()

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`)
  if (failed > 0) {
    console.log('Failures:')
    failures.forEach((f) => console.log(`  - ${f}`))
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Test suite crashed:', e)
  process.exit(1)
})
