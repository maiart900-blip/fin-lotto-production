/**
 * Cron Dispatcher Route
 *
 * Vercel Hobby รองรับ cron ได้ 2 งาน (วันละครั้ง) จึงใช้ dispatcher 2 window แทน 6 crons:
 *   - evening     (0 19 * * *): daily-closing, daily-risk-reset, daily-owner-report,
 *                               reconciliation (ทุกวัน) + data-retention (เฉพาะอาทิตย์)
 *   - maintenance (0 3 * * *):  cleanup (ทุกวัน)
 *
 * ทุก business handler ถูก reuse ตรง ๆ (import GET/POST เดิม) ไม่มีการ duplicate logic
 * auto-recovery (ทุก 5 นาที) ยังใช้ external scheduler แยกต่างหาก ไม่รวมที่นี่
 */

import { NextResponse } from 'next/server';
import { getBusinessDay } from '@/lib/daily-reset';
import { authorizeCron, forwardAuthHeader as buildForwardHeader } from '@/lib/cron-auth';
import {
  runDispatcher,
  type CronJobDef,
  type CronWindow,
  type IdempotencyStore,
} from '@/lib/cron-dispatcher';

import { GET as dailyClosingGET } from '@/app/api/cron/daily-closing/route';
import { POST as dailyRiskResetPOST } from '@/app/api/cron/daily-risk-reset/route';
import { GET as dailyOwnerReportGET } from '@/app/api/cron/daily-owner-report/route';
import { GET as reconciliationGET } from '@/app/api/cron/reconciliation/route';
import { GET as cleanupGET } from '@/app/api/cron/cleanup/route';
import { GET as dataRetentionGET } from '@/app/api/cron/data-retention/route';

export const runtime = 'nodejs';
export const maxDuration = 800;

function cronEnv() {
  return { CRON_SECRET: process.env.CRON_SECRET, RECOVERY_SECRET: process.env.RECOVERY_SECRET };
}

// -------- idempotency store (Upstash Redis, lazy) --------
const redisStore: IdempotencyStore = {
  async acquire(key, ttlSeconds) {
    const { redis } = await import('@/lib/redis');
    const res = await redis.set(key, new Date().toISOString(), { nx: true, ex: ttlSeconds });
    return res === 'OK';
  },
  async release(key) {
    const { redis } = await import('@/lib/redis');
    await redis.del(key);
  },
};

// -------- job registry (reuse handlers เดิม) --------
export function buildJobRegistry(): CronJobDef[] {
  return [
    {
      name: 'daily-closing',
      path: '/api/cron/daily-closing',
      method: 'GET',
      utcHour: 19,
      utcMinute: 0,
      daysOfWeek: null,
      window: 'evening',
      originalSchedule: '0 18 * * *',
      handler: (req) => dailyClosingGET(req),
    },
    {
      name: 'daily-risk-reset',
      path: '/api/cron/daily-risk-reset',
      method: 'POST',
      utcHour: 19,
      utcMinute: 0,
      daysOfWeek: null,
      window: 'evening',
      originalSchedule: '0 18 * * *',
      handler: (req) => dailyRiskResetPOST(req as any),
    },
    {
      name: 'daily-owner-report',
      path: '/api/cron/daily-owner-report',
      method: 'GET',
      utcHour: 19,
      utcMinute: 0,
      daysOfWeek: null,
      window: 'evening',
      originalSchedule: '30 18 * * *',
      handler: (req) => dailyOwnerReportGET(req),
    },
    {
      name: 'reconciliation',
      path: '/api/cron/reconciliation',
      method: 'GET',
      utcHour: 19,
      utcMinute: 0,
      daysOfWeek: null,
      window: 'evening',
      originalSchedule: '0 19 * * *',
      handler: (req) => reconciliationGET(req as any),
    },
    {
      name: 'data-retention',
      path: '/api/cron/data-retention',
      method: 'GET',
      utcHour: 19,
      utcMinute: 0,
      daysOfWeek: [0], // Sunday only (เดิม 0 20 * * 0)
      window: 'evening',
      originalSchedule: '0 20 * * 0',
      handler: (req) => dataRetentionGET(req),
    },
    {
      name: 'cleanup',
      path: '/api/cron/cleanup',
      method: 'GET',
      utcHour: 3,
      utcMinute: 0,
      daysOfWeek: null,
      window: 'maintenance',
      originalSchedule: '0 3 * * *',
      handler: (req) => cleanupGET(req as any),
    },
  ];
}

/**
 * เลือก window จาก (ลำดับความสำคัญ):
 *   1. x-vercel-cron-schedule header — Vercel ส่ง cron expression ที่ trigger มาให้
 *      (วิธีที่ docs รับรองสำหรับ path เดียวหลาย schedule) → evening=`0 19 * * *`, maintenance=`0 3 * * *`
 *   2. query param ?window= — สำหรับ manual / external scheduler trigger
 *   3. fallback: อนุมานจากชั่วโมง UTC (evening ช่วงเย็น, maintenance ช่วงเช้ามืด)
 */
function resolveWindow(request: Request, now: Date): CronWindow {
  const schedule = request.headers.get('x-vercel-cron-schedule');
  if (schedule) {
    // maintenance ตั้งเวลาเช้ามืด UTC (ชั่วโมง < 12), evening ช่วงเย็น (>= 12)
    const hourMatch = schedule.trim().match(/^\S+\s+(\d{1,2})\s/);
    if (hourMatch) {
      const hour = Number(hourMatch[1]);
      return hour >= 12 ? 'evening' : 'maintenance';
    }
  }
  const url = new URL(request.url);
  const q = url.searchParams.get('window');
  if (q === 'evening' || q === 'maintenance') return q;
  const h = now.getUTCHours();
  return h >= 12 ? 'evening' : 'maintenance';
}

async function handle(request: Request): Promise<Response> {
  const auth = authorizeCron(request.headers.get('authorization'), cronEnv());
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', reason: auth.reason },
      { status: auth.status },
    );
  }

  const now = new Date();
  const window = resolveWindow(request, now);
  const businessDay = getBusinessDay();

  try {
    const result = await runDispatcher({
      window,
      now,
      businessDay,
      jobs: buildJobRegistry(),
      store: redisStore,
      forwardAuthHeader: buildForwardHeader(cronEnv()),
    });

    console.log(
      `[Cron Dispatcher] window=${window} day=${businessDay} ` +
        `ok=${result.succeeded} fail=${result.failed} skip=${result.skipped}`,
    );

    // fail ของ job ย่อยไม่ทำให้ dispatcher ล้ม (isolation) — คืน 200 พร้อมรายละเอียด
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron Dispatcher] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// Vercel Cron ยิง GET; รองรับ POST สำหรับ manual trigger ด้วย
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
