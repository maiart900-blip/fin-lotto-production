/**
 * Emergency Lock System
 * ระบบล็อกฉุกเฉิน - หยุดแทง/ถอน/เอเย่น ทันที
 * 
 * Features:
 * - Panic button สำหรับหยุดระบบทั้งหมด
 * - Selective lock (แยก betting/withdrawal/agent)
 * - Auto-notification to owner
 * - Audit log ทุกการ lock/unlock
 * - Cooldown period ก่อน unlock
 */

import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { logAudit } from './audit-logger';
import { sendLineAlert } from './notifications/line-notify';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = Redis.fromEnv();

// Lock keys in Redis
const LOCK_KEYS = {
  SYSTEM: 'emergency:lock:system',
  BETTING: 'emergency:lock:betting',
  WITHDRAWAL: 'emergency:lock:withdrawal',
  DEPOSIT: 'emergency:lock:deposit',
  AGENT: 'emergency:lock:agent',
  SETTLEMENT: 'emergency:lock:settlement',
} as const;

type LockType = keyof typeof LOCK_KEYS;

export interface EmergencyLockStatus {
  type: LockType;
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  reason: string | null;
  unlockCooldownUntil: string | null;
}

export interface LockAllResponse {
  success: boolean;
  lockedSystems: LockType[];
  message: string;
}

/**
 * ล็อกระบบทั้งหมด (Panic Button)
 */
export async function lockAllSystems(
  adminId: string,
  adminName: string,
  reason: string
): Promise<LockAllResponse> {
  const lockedSystems: LockType[] = [];
  const now = new Date().toISOString();
  
  try {
    // Lock ทุกระบบพร้อมกัน
    const lockPromises = Object.keys(LOCK_KEYS).map(async (type) => {
      const key = LOCK_KEYS[type as LockType];
      await redis.hset(key, {
        isLocked: 'true',
        lockedAt: now,
        lockedBy: adminId,
        lockedByName: adminName,
        reason: reason,
        unlockCooldownUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min cooldown
      });
      lockedSystems.push(type as LockType);
    });
    
    await Promise.all(lockPromises);
    
    // บันทึก audit log
    await logAudit({
      userId: adminId,
      action: 'emergency_lock_all',
      resourceType: 'system',
      resourceId: 'all',
      details: {
        reason,
        lockedSystems,
      },
      severity: 'critical',
    });
    
    // บันทึกลง database
    await supabase.from('emergency_lock_logs').insert({
      lock_type: 'ALL',
      action: 'lock',
      admin_id: adminId,
      reason,
      affected_systems: lockedSystems,
    });
    
    // แจ้งเตือน LINE
    await sendLineAlert('emergency', 'EMERGENCY LOCK ACTIVATED', {
      'ผู้ล็อก': adminName,
      'เหตุผล': reason,
      'ระบบที่ล็อก': lockedSystems.join(', '),
      'เวลา': new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
    });
    
    return {
      success: true,
      lockedSystems,
      message: 'ล็อกระบบทั้งหมดเรียบร้อยแล้ว',
    };
  } catch (error) {
    console.error('Emergency lock error:', error);
    throw error;
  }
}

/**
 * ล็อกระบบเฉพาะส่วน
 */
export async function lockSystem(
  type: LockType,
  adminId: string,
  adminName: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const key = LOCK_KEYS[type];
  const now = new Date().toISOString();
  
  try {
    await redis.hset(key, {
      isLocked: 'true',
      lockedAt: now,
      lockedBy: adminId,
      lockedByName: adminName,
      reason: reason,
      unlockCooldownUntil: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 min cooldown
    });
    
    await logAudit({
      userId: adminId,
      action: 'emergency_lock',
      resourceType: 'system',
      resourceId: type,
      details: { reason },
      severity: 'high',
    });
    
    await supabase.from('emergency_lock_logs').insert({
      lock_type: type,
      action: 'lock',
      admin_id: adminId,
      reason,
      affected_systems: [type],
    });
    
    await sendLineAlert('system_alert', `ล็อกระบบ: ${type}`, {
      'ผู้ล็อก': adminName,
      'เหตุผล': reason,
    });
    
    return {
      success: true,
      message: `ล็อกระบบ ${type} เรียบร้อยแล้ว`,
    };
  } catch (error) {
    console.error('Lock system error:', error);
    throw error;
  }
}

/**
 * ปลดล็อกระบบ
 */
export async function unlockSystem(
  type: LockType,
  adminId: string,
  adminName: string,
  reason: string,
  bypassCooldown: boolean = false
): Promise<{ success: boolean; message: string }> {
  const key = LOCK_KEYS[type];
  
  try {
    // ตรวจสอบ cooldown
    if (!bypassCooldown) {
      const lockData = await redis.hgetall(key);
      if (lockData?.unlockCooldownUntil) {
        const cooldownUntil = new Date(lockData.unlockCooldownUntil as string);
        if (new Date() < cooldownUntil) {
          const remainingSeconds = Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000);
          return {
            success: false,
            message: `ต้องรออีก ${remainingSeconds} วินาที ก่อนปลดล็อก (หรือใช้ bypass จาก Super Admin)`,
          };
        }
      }
    }
    
    await redis.hset(key, {
      isLocked: 'false',
      unlockedAt: new Date().toISOString(),
      unlockedBy: adminId,
      unlockedByName: adminName,
      unlockReason: reason,
    });
    
    await logAudit({
      userId: adminId,
      action: 'emergency_unlock',
      resourceType: 'system',
      resourceId: type,
      details: { reason, bypassCooldown },
      severity: 'high',
    });
    
    await supabase.from('emergency_lock_logs').insert({
      lock_type: type,
      action: 'unlock',
      admin_id: adminId,
      reason,
      affected_systems: [type],
    });
    
    await sendLineAlert('system_alert', `ปลดล็อกระบบ: ${type}`, {
      'ผู้ปลดล็อก': adminName,
      'เหตุผล': reason,
    });
    
    return {
      success: true,
      message: `ปลดล็อกระบบ ${type} เรียบร้อยแล้ว`,
    };
  } catch (error) {
    console.error('Unlock system error:', error);
    throw error;
  }
}

/**
 * ปลดล็อกทุกระบบ
 */
export async function unlockAllSystems(
  adminId: string,
  adminName: string,
  reason: string,
  bypassCooldown: boolean = false
): Promise<{ success: boolean; unlockedSystems: LockType[]; message: string }> {
  const unlockedSystems: LockType[] = [];
  const failedSystems: { type: LockType; reason: string }[] = [];
  
  for (const type of Object.keys(LOCK_KEYS) as LockType[]) {
    const result = await unlockSystem(type, adminId, adminName, reason, bypassCooldown);
    if (result.success) {
      unlockedSystems.push(type);
    } else {
      failedSystems.push({ type, reason: result.message });
    }
  }
  
  return {
    success: failedSystems.length === 0,
    unlockedSystems,
    message: failedSystems.length > 0
      ? `ปลดล็อกบางส่วนสำเร็จ: ${unlockedSystems.join(', ')}. ล้มเหลว: ${failedSystems.map(f => f.type).join(', ')}`
      : 'ปลดล็อกทุกระบบเรียบร้อยแล้ว',
  };
}

/**
 * ตรวจสอบสถานะล็อกทั้งหมด
 */
export async function getAllLockStatus(): Promise<EmergencyLockStatus[]> {
  const statuses: EmergencyLockStatus[] = [];
  
  for (const [type, key] of Object.entries(LOCK_KEYS)) {
    const data = await redis.hgetall(key);
    statuses.push({
      type: type as LockType,
      isLocked: data?.isLocked === 'true',
      lockedAt: (data?.lockedAt as string) || null,
      lockedBy: (data?.lockedBy as string) || null,
      reason: (data?.reason as string) || null,
      unlockCooldownUntil: (data?.unlockCooldownUntil as string) || null,
    });
  }
  
  return statuses;
}

/**
 * ตรวจสอบว่าระบบถูกล็อกหรือไม่ (สำหรับใช้ใน middleware/API)
 */
export async function isSystemLocked(type: LockType): Promise<boolean> {
  const key = LOCK_KEYS[type];
  const isLocked = await redis.hget(key, 'isLocked');
  return isLocked === 'true';
}

/**
 * ตรวจสอบว่าระบบใดก็ได้ถูกล็อกหรือไม่
 */
export async function isAnySystemLocked(): Promise<boolean> {
  const statuses = await getAllLockStatus();
  return statuses.some(s => s.isLocked);
}

/**
 * ดึงประวัติ lock/unlock
 */
export async function getLockHistory(
  limit: number = 50,
  offset: number = 0
): Promise<{ data: any[]; total: number }> {
  const { data, error, count } = await supabase
    .from('emergency_lock_logs')
    .select('*, admin:admin_id(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  
  return {
    data: data || [],
    total: count || 0,
  };
}

/**
 * Middleware helper - ตรวจสอบ lock ก่อนทำรายการ
 */
export async function checkLockMiddleware(
  type: LockType
): Promise<{ allowed: boolean; message?: string }> {
  const isLocked = await isSystemLocked(type);
  
  if (isLocked) {
    const key = LOCK_KEYS[type];
    const data = await redis.hgetall(key);
    return {
      allowed: false,
      message: `ระบบถูกล็อกชั่วคราว เหตุผล: ${data?.reason || 'ไม่ระบุ'}`,
    };
  }
  
  return { allowed: true };
}
