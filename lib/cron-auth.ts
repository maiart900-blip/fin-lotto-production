/**
 * Cron authentication helpers (pure, testable)
 *
 * dispatcher และ cron endpoints ใช้ secret จาก env:
 *   - CRON_SECRET     : Vercel Cron inject อัตโนมัติ (แนะนำให้ตั้ง)
 *   - RECOVERY_SECRET : fallback / external scheduler
 * fail-closed: ถ้าไม่มี secret เลย → ไม่อนุญาต (503)
 * ใช้ timing-safe comparison กัน timing attack และไม่ log secret
 */

import { timingSafeEqual } from 'crypto';

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface CronAuthEnv {
  CRON_SECRET?: string;
  RECOVERY_SECRET?: string;
}

export function acceptedSecrets(env: CronAuthEnv): string[] {
  return [env.CRON_SECRET, env.RECOVERY_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );
}

/** header ที่ dispatcher ส่งต่อให้ handler เดิม (child เทียบกับ CRON_SECRET) */
export function forwardAuthHeader(env: CronAuthEnv): string {
  const secret = env.CRON_SECRET ?? env.RECOVERY_SECRET ?? '';
  return `Bearer ${secret}`;
}

export interface AuthResult {
  ok: boolean;
  status: number;
  reason?: string;
}

export function authorizeCron(authorizationHeader: string | null, env: CronAuthEnv): AuthResult {
  const secrets = acceptedSecrets(env);
  if (secrets.length === 0) {
    return { ok: false, status: 503, reason: 'no_secret_configured' };
  }
  const header = authorizationHeader || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!provided) return { ok: false, status: 401, reason: 'missing_authorization' };
  const match = secrets.some((s) => safeEqual(provided, s));
  return match ? { ok: true, status: 200 } : { ok: false, status: 401, reason: 'invalid_secret' };
}
