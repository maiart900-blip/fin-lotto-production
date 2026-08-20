/**
 * Cron Dispatcher test suite (standalone, no DB/network)
 * รันด้วย: pnpm test:cron-dispatcher
 *
 * ครอบคลุม:
 *  1. dispatcher routing (window filtering)
 *  2. schedule matching (isJobDue: due / not due / day-of-week)
 *  3. timezone (UTC -> Thailand + business-day invariant)
 *  4. duplicate invocation / idempotency
 *  5. simultaneous jobs (evening batch หลายงานพร้อมกัน)
 *  6. individual job failure isolation
 *  7. authentication (fail-closed, CRON_SECRET / RECOVERY_SECRET)
 *  8. all 6 business jobs reachable ผ่าน registry
 */

import {
  runDispatcher,
  isJobDue,
  type CronJobDef,
  type IdempotencyStore,
} from '@/lib/cron-dispatcher';
import { authorizeCron, forwardAuthHeader, acceptedSecrets } from '@/lib/cron-auth';
import { getBusinessDay } from '@/lib/daily-reset';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function jsonResponse(status: number) {
  return new Response(JSON.stringify({ ok: status < 400 }), { status });
}

/** in-memory idempotency store แบบ set-NX */
function memoryStore(): IdempotencyStore & { keys: Set<string> } {
  const keys = new Set<string>();
  return {
    keys,
    async acquire(key) {
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    async release(key) {
      keys.delete(key);
    },
  };
}

/** สร้าง job def สำหรับ test พร้อมตัวนับการเรียก */
function makeJob(
  name: string,
  window: 'evening' | 'maintenance',
  opts: Partial<CronJobDef> & { calls?: { n: number }; status?: number; throwErr?: boolean } = {},
): CronJobDef {
  const calls = opts.calls ?? { n: 0 };
  return {
    name,
    path: `/api/cron/${name}`,
    method: opts.method ?? 'GET',
    utcHour: opts.utcHour ?? 19,
    utcMinute: opts.utcMinute ?? 0,
    daysOfWeek: opts.daysOfWeek ?? null,
    window,
    originalSchedule: opts.originalSchedule ?? '0 19 * * *',
    handler: async () => {
      calls.n++;
      if (opts.throwErr) throw new Error(`${name} boom`);
      return jsonResponse(opts.status ?? 200);
    },
  };
}

async function run() {
  // ---------- 1. routing (window filtering) ----------
  console.log('\n[1] dispatcher routing (window filtering)');
  {
    const eveningCalls = { n: 0 };
    const maintCalls = { n: 0 };
    const jobs = [
      makeJob('evening-a', 'evening', { calls: eveningCalls }),
      makeJob('maint-a', 'maintenance', { utcHour: 3, calls: maintCalls }),
    ];
    const now = new Date('2026-05-15T19:00:00Z'); // evening window fire
    const res = await runDispatcher({
      window: 'evening',
      now,
      businessDay: '2026-05-15',
      jobs,
      store: memoryStore(),
      forwardAuthHeader: 'Bearer x',
    });
    assert(eveningCalls.n === 1, 'evening job ถูกเรียกใน evening window');
    assert(maintCalls.n === 0, 'maintenance job ไม่ถูกเรียกใน evening window');
    assert(res.total === 1 && res.succeeded === 1, 'result นับเฉพาะ job ใน window');
  }

  // ---------- 2. schedule matching (isJobDue) ----------
  console.log('\n[2] schedule matching (isJobDue)');
  {
    const job = makeJob('j', 'evening', { utcHour: 19, utcMinute: 0 });
    assert(isJobDue(job, new Date('2026-05-15T19:00:00Z')) === true, 'due เมื่อถึงเวลาพอดี');
    assert(isJobDue(job, new Date('2026-05-15T19:30:00Z')) === true, 'due เมื่อเลยเวลา');
    assert(isJobDue(job, new Date('2026-05-15T18:59:00Z')) === false, 'ยังไม่ due ก่อนเวลา');

    const sunday = makeJob('weekly', 'evening', { utcHour: 19, daysOfWeek: [0] });
    // 2026-05-17 = Sunday, 2026-05-15 = Friday
    assert(isJobDue(sunday, new Date('2026-05-17T19:00:00Z')) === true, 'weekly job due วันอาทิตย์');
    assert(isJobDue(sunday, new Date('2026-05-15T19:00:00Z')) === false, 'weekly job ไม่ due วันศุกร์');
  }

  // ---------- 3. timezone ----------
  console.log('\n[3] timezone (UTC -> Thailand + business-day invariant)');
  {
    const jobs = [makeJob('daily-closing', 'evening', { utcHour: 19, utcMinute: 0 })];
    const res = await runDispatcher({
      window: 'evening',
      now: new Date('2026-05-15T19:00:00Z'),
      businessDay: '2026-05-15',
      jobs,
      store: memoryStore(),
      forwardAuthHeader: 'Bearer x',
    });
    assert(res.jobs[0].scheduled_thailand === '02:00', '19:00 UTC => 02:00 Thailand');
    // business-day invariant: 18:00 UTC vs 19:00 UTC ให้ผล business day เดียวกัน
    const bdA = getBusinessDay(new Date('2026-05-15T18:00:00Z')); // เดิม 01:00 TH
    const bdB = getBusinessDay(new Date('2026-05-15T19:00:00Z')); // ใหม่ 02:00 TH
    assert(bdA === bdB, `business day ไม่เปลี่ยนจากการเลื่อน 18:00->19:00 UTC (${bdA})`);
  }

  // ---------- 4. idempotency (duplicate invocation) ----------
  console.log('\n[4] duplicate invocation / idempotency');
  {
    const calls = { n: 0 };
    const jobs = [makeJob('daily-owner-report', 'evening', { calls })];
    const store = memoryStore();
    const cfg = {
      window: 'evening' as const,
      now: new Date('2026-05-15T19:00:00Z'),
      businessDay: '2026-05-15',
      jobs,
      store,
      forwardAuthHeader: 'Bearer x',
    };
    const r1 = await runDispatcher(cfg);
    const r2 = await runDispatcher(cfg); // เรียกซ้ำวันเดียวกัน
    assert(calls.n === 1, 'job execute เพียงครั้งเดียวแม้ dispatcher ถูกเรียกซ้ำ');
    assert(r1.succeeded === 1, 'รอบแรก success');
    assert(r2.skipped === 1 && r2.jobs[0].skip_reason === 'already_executed', 'รอบสองถูก skip (already_executed)');
  }

  // ---------- 5. simultaneous jobs (18:00 batch) ----------
  console.log('\n[5] simultaneous jobs (evening batch)');
  {
    const c1 = { n: 0 }, c2 = { n: 0 }, c3 = { n: 0 }, c4 = { n: 0 };
    const jobs = [
      makeJob('daily-closing', 'evening', { calls: c1 }),
      makeJob('daily-risk-reset', 'evening', { method: 'POST', calls: c2 }),
      makeJob('daily-owner-report', 'evening', { calls: c3 }),
      makeJob('reconciliation', 'evening', { calls: c4 }),
    ];
    const res = await runDispatcher({
      window: 'evening',
      now: new Date('2026-05-15T19:00:00Z'),
      businessDay: '2026-05-15',
      jobs,
      store: memoryStore(),
      forwardAuthHeader: 'Bearer x',
    });
    assert(c1.n === 1 && c2.n === 1 && c3.n === 1 && c4.n === 1, 'ทั้ง 4 evening jobs รันครบ');
    assert(res.succeeded === 4, 'ทั้ง 4 success');
    assert(res.jobs.map((j) => j.job).join(',') === 'daily-closing,daily-risk-reset,daily-owner-report,reconciliation', 'รันตามลำดับที่กำหนด');
  }

  // ---------- 6. failure isolation ----------
  console.log('\n[6] individual job failure isolation');
  {
    const ok1 = { n: 0 }, ok2 = { n: 0 }, bad = { n: 0 };
    const jobs = [
      makeJob('job-ok-1', 'evening', { calls: ok1 }),
      makeJob('job-fail', 'evening', { calls: bad, throwErr: true }),
      makeJob('job-ok-2', 'evening', { calls: ok2 }),
    ];
    const store = memoryStore();
    const res = await runDispatcher({
      window: 'evening',
      now: new Date('2026-05-15T19:00:00Z'),
      businessDay: '2026-05-15',
      jobs,
      store,
      forwardAuthHeader: 'Bearer x',
    });
    assert(ok1.n === 1 && ok2.n === 1, 'job หลัง job ที่ fail ยังรันได้ (isolation)');
    assert(res.failed === 1 && res.succeeded === 2, 'นับ fail 1 / success 2');
    const failLog = res.jobs.find((j) => j.job === 'job-fail')!;
    assert(failLog.status === 'failure' && !!failLog.error, 'บันทึก error ของ job ที่ fail');
    assert(!store.keys.has('cron:dispatch:2026-05-15:job-fail'), 'idempotency key ถูกปล่อยเมื่อ fail (retry ได้)');
  }

  // ---------- 6b. failure via non-2xx status ----------
  console.log('\n[6b] failure detection via HTTP status');
  {
    const jobs = [makeJob('job-500', 'evening', { status: 500 })];
    const store = memoryStore();
    const res = await runDispatcher({
      window: 'evening',
      now: new Date('2026-05-15T19:00:00Z'),
      businessDay: '2026-05-15',
      jobs,
      store,
      forwardAuthHeader: 'Bearer x',
    });
    assert(res.failed === 1, 'status 500 ถือเป็น failure');
    assert(!store.keys.has('cron:dispatch:2026-05-15:job-500'), 'key ถูกปล่อยเมื่อ status ล้มเหลว');
  }

  // ---------- 7. authentication ----------
  console.log('\n[7] authentication (fail-closed)');
  {
    // ไม่มี secret เลย -> 503
    assert(authorizeCron('Bearer x', {}).status === 503, 'ไม่มี secret => 503 (fail-closed)');
    // มี CRON_SECRET
    const env = { CRON_SECRET: 'topsecret' };
    assert(authorizeCron('Bearer topsecret', env).ok === true, 'CRON_SECRET ถูกต้อง => ok');
    assert(authorizeCron('Bearer wrong', env).status === 401, 'secret ผิด => 401');
    assert(authorizeCron('', env).status === 401, 'ไม่มี header => 401');
    assert(authorizeCron(null, env).status === 401, 'header null => 401');
    // fallback RECOVERY_SECRET
    const env2 = { RECOVERY_SECRET: 'recov' };
    assert(authorizeCron('Bearer recov', env2).ok === true, 'RECOVERY_SECRET fallback ทำงาน');
    // forward header ใช้ CRON_SECRET ก่อน
    assert(forwardAuthHeader({ CRON_SECRET: 'a', RECOVERY_SECRET: 'b' }) === 'Bearer a', 'forward ใช้ CRON_SECRET ก่อน');
    assert(forwardAuthHeader({ RECOVERY_SECRET: 'b' }) === 'Bearer b', 'forward fallback RECOVERY_SECRET');
    assert(acceptedSecrets({ CRON_SECRET: 'a', RECOVERY_SECRET: 'b' }).length === 2, 'acceptedSecrets รวมทั้งสอง');
  }

  // ---------- 8. all 6 business jobs reachable via registry ----------
  console.log('\n[8] all 6 business jobs reachable in registry');
  {
    // import registry จาก route (dynamic เพื่อไม่โหลด redis/supabase ตอน parse)
    const { buildJobRegistry } = await import('@/app/api/cron/dispatcher/route');
    const reg = buildJobRegistry();
    const names = reg.map((j) => j.name).sort();
    const expected = [
      'cleanup',
      'daily-closing',
      'daily-owner-report',
      'daily-risk-reset',
      'data-retention',
      'reconciliation',
    ];
    assert(JSON.stringify(names) === JSON.stringify(expected), 'registry มีครบทั้ง 6 business jobs');
    assert(reg.filter((j) => j.window === 'evening').length === 5, 'evening window มี 5 jobs');
    assert(reg.filter((j) => j.window === 'maintenance').length === 1, 'maintenance window มี 1 job');
    const riskReset = reg.find((j) => j.name === 'daily-risk-reset')!;
    assert(riskReset.method === 'POST', 'daily-risk-reset ใช้ method POST (งานจริง)');
    const dataRetention = reg.find((j) => j.name === 'data-retention')!;
    assert(JSON.stringify(dataRetention.daysOfWeek) === '[0]', 'data-retention รันเฉพาะวันอาทิตย์');
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('Test crashed:', e);
  process.exit(1);
});
