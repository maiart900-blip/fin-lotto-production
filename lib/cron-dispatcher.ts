/**
 * Cron Dispatcher Engine (pure, testable)
 *
 * WHY: Vercel Hobby จำกัด cron ได้สูงสุด 2 งาน และรันได้วันละครั้ง
 * ระบบมี 6 business cron เดิม จึงใช้ dispatcher กลาง 2 ตัว (evening + maintenance)
 * เป็นผู้ตัดสินใจว่างานใดถึงเวลารัน โดย "reuse" handler เดิมทั้งหมด (ไม่ duplicate logic)
 *
 * คุณสมบัติ:
 * - routing ตาม window + due-time + day-of-week
 * - idempotency: งานเดียวกันในวันธุรกิจเดียวกันจะไม่ execute ซ้ำ (ผ่าน store แบบ set-NX)
 * - per-job isolation: งานหนึ่ง fail ไม่ทำให้งานอื่นล้มตาม
 * - execution logging: job, scheduled, started_at, completed_at, status, error (ไม่มี secret)
 *
 * ไฟล์นี้ไม่ import redis / supabase / route ใด ๆ เพื่อให้ test ได้โดยไม่แตะ production
 */

export type CronWindow = 'evening' | 'maintenance';

export interface CronJobDef {
  /** ชื่อ job (ตรงกับ path เดิม) */
  name: string;
  /** path เดิมของ endpoint (ใช้สร้าง Request ที่ส่งให้ handler) */
  path: string;
  /** HTTP method ที่ handler ใช้ทำงานจริง (daily-risk-reset ใช้ POST) */
  method: 'GET' | 'POST';
  /** เวลา dispatch ที่มีผลจริง (UTC) — ใช้เช็ค due + logging */
  utcHour: number;
  utcMinute: number;
  /** วันในสัปดาห์ที่ทำงาน (0=Sunday). null = ทุกวัน */
  daysOfWeek: number[] | null;
  /** อยู่ใน dispatch window ใด */
  window: CronWindow;
  /** schedule เดิมก่อนรวม (ไว้ documentation/audit) */
  originalSchedule: string;
  /** handler เดิม (reuse) — route จะ wire ของจริง, test จะ inject fake */
  handler: (req: Request) => Promise<Response>;
}

/** store สำหรับกัน execute ซ้ำ (inject ได้เพื่อ test) */
export interface IdempotencyStore {
  /** คืน true ถ้าจองสำเร็จ (ครั้งแรกของวันนี้), false ถ้าเคยรันแล้ว */
  acquire(key: string, ttlSeconds: number): Promise<boolean>;
  /** ปล่อยการจอง (เรียกเมื่อ job fail เพื่อให้ retry รอบถัดไปได้) */
  release(key: string): Promise<void>;
}

export interface JobExecutionLog {
  job: string;
  scheduled_utc: string; // "HH:MM"
  scheduled_thailand: string; // "HH:MM" (UTC+7)
  original_schedule: string;
  started_at: string | null;
  completed_at: string | null;
  status: 'success' | 'failure' | 'skipped';
  skip_reason?: string;
  http_status?: number;
  error?: string; // ข้อความ error เท่านั้น ไม่มี secret
}

export interface DispatcherResult {
  window: CronWindow;
  business_day: string;
  dispatched_at: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  jobs: JobExecutionLog[];
}

const IDEMPOTENCY_TTL_SECONDS = 23 * 60 * 60; // ~1 วันธุรกิจ

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toThailandHHMM(utcHour: number, utcMinute: number): string {
  const th = (utcHour + 7) % 24;
  return `${pad2(th)}:${pad2(utcMinute)}`;
}

/**
 * job ถึงเวลารันหรือยัง:
 * - วันในสัปดาห์ตรง (ถ้ากำหนด)
 * - เวลาปัจจุบัน (UTC) ผ่านเวลา scheduled ของวันนี้แล้ว
 */
export function isJobDue(job: CronJobDef, now: Date): boolean {
  if (job.daysOfWeek && !job.daysOfWeek.includes(now.getUTCDay())) {
    return false;
  }
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const schedMinutes = job.utcHour * 60 + job.utcMinute;
  return nowMinutes >= schedMinutes;
}

/**
 * รัน dispatcher หนึ่ง window
 * - เลือก job ใน window นั้น
 * - เช็ค due + idempotency
 * - รันทีละงานตามลำดับ พร้อม isolation + logging
 */
export async function runDispatcher(config: {
  window: CronWindow;
  now: Date;
  businessDay: string;
  jobs: CronJobDef[];
  store: IdempotencyStore;
  /** header ที่จะส่งต่อให้ handler เดิม (เช่น "Bearer xxx") */
  forwardAuthHeader: string;
  /** origin ที่ใช้สร้าง Request object (ไม่ยิงเน็ตจริง) */
  baseUrl?: string;
}): Promise<DispatcherResult> {
  const { window, now, businessDay, jobs, store, forwardAuthHeader } = config;
  const baseUrl = config.baseUrl || 'https://cron.internal';

  const windowJobs = jobs.filter((j) => j.window === window);
  const logs: JobExecutionLog[] = [];

  for (const job of windowJobs) {
    const base: JobExecutionLog = {
      job: job.name,
      scheduled_utc: `${pad2(job.utcHour)}:${pad2(job.utcMinute)}`,
      scheduled_thailand: toThailandHHMM(job.utcHour, job.utcMinute),
      original_schedule: job.originalSchedule,
      started_at: null,
      completed_at: null,
      status: 'skipped',
    };

    // 1) due check (schedule matching + day-of-week)
    if (!isJobDue(job, now)) {
      base.status = 'skipped';
      base.skip_reason = job.daysOfWeek && !job.daysOfWeek.includes(now.getUTCDay())
        ? 'not_scheduled_today'
        : 'not_due_yet';
      logs.push(base);
      continue;
    }

    // 2) idempotency — จองสิทธิ์รันของวันธุรกิจนี้
    const idempotencyKey = `cron:dispatch:${businessDay}:${job.name}`;
    let acquired = false;
    try {
      acquired = await store.acquire(idempotencyKey, IDEMPOTENCY_TTL_SECONDS);
    } catch (err) {
      // ถ้า store มีปัญหา ถือว่ารันไม่ได้อย่างปลอดภัย (กันซ้ำสำคัญกว่า)
      base.status = 'skipped';
      base.skip_reason = 'idempotency_store_error';
      base.error = err instanceof Error ? err.message : 'store error';
      logs.push(base);
      continue;
    }

    if (!acquired) {
      base.status = 'skipped';
      base.skip_reason = 'already_executed';
      logs.push(base);
      continue;
    }

    // 3) execute handler เดิม (reuse) + per-job isolation
    base.started_at = new Date().toISOString();
    try {
      const req = new Request(`${baseUrl}${job.path}`, {
        method: job.method,
        headers: { authorization: forwardAuthHeader },
      });
      const res = await job.handler(req);
      base.completed_at = new Date().toISOString();
      base.http_status = res.status;

      if (res.status >= 200 && res.status < 400) {
        base.status = 'success';
      } else {
        base.status = 'failure';
        base.error = `handler responded with status ${res.status}`;
        // ปล่อยการจองเพื่อให้ retry รอบถัดไปได้
        await safeRelease(store, idempotencyKey);
      }
    } catch (err) {
      base.completed_at = new Date().toISOString();
      base.status = 'failure';
      base.error = err instanceof Error ? err.message : 'unknown error';
      await safeRelease(store, idempotencyKey);
    }

    logs.push(base);
  }

  return {
    window,
    business_day: businessDay,
    dispatched_at: now.toISOString(),
    total: logs.length,
    succeeded: logs.filter((l) => l.status === 'success').length,
    failed: logs.filter((l) => l.status === 'failure').length,
    skipped: logs.filter((l) => l.status === 'skipped').length,
    jobs: logs,
  };
}

async function safeRelease(store: IdempotencyStore, key: string): Promise<void> {
  try {
    await store.release(key);
  } catch {
    // ignore release errors — key จะหมดอายุตาม TTL อยู่แล้ว
  }
}
