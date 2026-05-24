/**
 * IP & Device Locking System for FIN LOTTO R+
 * ล็อกบัญชีแอดมินให้เข้าได้เฉพาะอุปกรณ์ที่อนุญาต
 */

import { createClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis';
import crypto from 'crypto';

// =============================================
// TYPES
// =============================================

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  fingerprint: string;
}

export interface IPInfo {
  ip: string;
  country?: string;
  city?: string;
  isp?: string;
}

export interface DeviceLockResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  newDevice?: boolean;
}

export interface TrustedDevice {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  fingerprint: string;
  ipAddress: string;
  lastUsed: string;
  createdAt: string;
  status: 'active' | 'revoked' | 'pending';
}

// =============================================
// DEVICE FINGERPRINTING
// =============================================

export function generateDeviceFingerprint(
  userAgent: string,
  screenResolution: string,
  timezone: string,
  language: string,
  plugins: string[]
): string {
  const data = [
    userAgent,
    screenResolution,
    timezone,
    language,
    plugins.sort().join(','),
  ].join('|');

  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

// =============================================
// DEVICE LOCK FUNCTIONS
// =============================================

/**
 * ตรวจสอบว่าอุปกรณ์ได้รับอนุญาตหรือไม่
 */
export async function checkDeviceAccess(
  userId: string,
  deviceInfo: DeviceInfo,
  ipInfo: IPInfo,
  isAdmin: boolean = false
): Promise<DeviceLockResult> {
  const supabase = await createClient();

  try {
    // 1. Get user's device lock settings
    const { data: user } = await supabase
      .from('users')
      .select('device_lock_enabled, max_devices, trusted_ips')
      .eq('id', userId)
      .single();

    // If device lock is not enabled, allow access
    if (!user?.device_lock_enabled && !isAdmin) {
      return { allowed: true };
    }

    // 2. Check if device is trusted
    const { data: trustedDevice } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('fingerprint', deviceInfo.fingerprint)
      .eq('status', 'active')
      .single();

    if (trustedDevice) {
      // Update last used
      await supabase
        .from('trusted_devices')
        .update({ 
          last_used: new Date().toISOString(),
          ip_address: ipInfo.ip,
        })
        .eq('id', trustedDevice.id);

      return { allowed: true };
    }

    // 3. For admins, require explicit approval for new devices
    if (isAdmin) {
      // Check if there's a pending approval
      const { data: pendingDevice } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', userId)
        .eq('fingerprint', deviceInfo.fingerprint)
        .eq('status', 'pending')
        .single();

      if (pendingDevice) {
        return {
          allowed: false,
          requiresApproval: true,
          reason: 'อุปกรณ์นี้รอการอนุมัติจากผู้ดูแลระบบ',
        };
      }

      // Create pending device request
      await requestDeviceApproval(userId, deviceInfo, ipInfo);

      return {
        allowed: false,
        requiresApproval: true,
        newDevice: true,
        reason: 'อุปกรณ์ใหม่ต้องได้รับการอนุมัติก่อนใช้งาน',
      };
    }

    // 4. For regular users, check device limit
    const { count: deviceCount } = await supabase
      .from('trusted_devices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');

    const maxDevices = user?.max_devices || 3;

    if ((deviceCount || 0) >= maxDevices) {
      return {
        allowed: false,
        reason: `จำนวนอุปกรณ์เกินขีดจำกัด (${maxDevices} อุปกรณ์)`,
      };
    }

    // 5. Auto-add device for regular users
    await addTrustedDevice(userId, deviceInfo, ipInfo, 'active');

    return { allowed: true, newDevice: true };
  } catch (error) {
    console.error('Device access check error:', error);
    return { allowed: false, reason: 'เกิดข้อผิดพลาดในการตรวจสอบอุปกรณ์' };
  }
}

/**
 * ขออนุมัติอุปกรณ์ใหม่
 */
export async function requestDeviceApproval(
  userId: string,
  deviceInfo: DeviceInfo,
  ipInfo: IPInfo
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trusted_devices')
    .insert({
      user_id: userId,
      device_id: deviceInfo.deviceId,
      device_name: deviceInfo.deviceName,
      device_type: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      fingerprint: deviceInfo.fingerprint,
      ip_address: ipInfo.ip,
      ip_country: ipInfo.country,
      ip_city: ipInfo.city,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;

  // Send notification to super admin
  await notifyDeviceApprovalRequest(userId, deviceInfo, ipInfo);

  return data.id;
}

/**
 * อนุมัติอุปกรณ์
 */
export async function approveDevice(
  deviceId: string,
  approvedBy: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trusted_devices')
    .update({
      status: 'active',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', deviceId);

  if (error) throw error;

  // Log approval
  await logSecurityEvent('device_approved', { deviceId, approvedBy });

  return true;
}

/**
 * ยกเลิกอุปกรณ์
 */
export async function revokeDevice(
  deviceId: string,
  revokedBy: string,
  reason?: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trusted_devices')
    .update({
      status: 'revoked',
      revoked_by: revokedBy,
      revoked_at: new Date().toISOString(),
      revoke_reason: reason,
    })
    .eq('id', deviceId);

  if (error) throw error;

  // Log revocation
  await logSecurityEvent('device_revoked', { deviceId, revokedBy, reason });

  return true;
}

/**
 * เพิ่มอุปกรณ์ที่เชื่อถือได้
 */
export async function addTrustedDevice(
  userId: string,
  deviceInfo: DeviceInfo,
  ipInfo: IPInfo,
  status: 'active' | 'pending' = 'active'
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trusted_devices')
    .insert({
      user_id: userId,
      device_id: deviceInfo.deviceId,
      device_name: deviceInfo.deviceName,
      device_type: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      fingerprint: deviceInfo.fingerprint,
      ip_address: ipInfo.ip,
      status,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;

  return data.id;
}

/**
 * ดึงรายการอุปกรณ์ของผู้ใช้
 */
export async function getUserDevices(userId: string): Promise<TrustedDevice[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('trusted_devices')
    .select('*')
    .eq('user_id', userId)
    .order('last_used', { ascending: false });

  if (error) throw error;

  return data || [];
}

/**
 * ตรวจสอบ IP ที่อนุญาต
 */
export async function checkIPAllowed(
  userId: string,
  ip: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data: user } = await supabase
    .from('users')
    .select('trusted_ips, ip_lock_enabled')
    .eq('id', userId)
    .single();

  if (!user?.ip_lock_enabled) return true;

  const trustedIPs = user.trusted_ips || [];
  
  // Check exact match or CIDR range
  return trustedIPs.some((trustedIP: string) => {
    if (trustedIP.includes('/')) {
      return isIPInRange(ip, trustedIP);
    }
    return trustedIP === ip;
  });
}

/**
 * เพิ่ม IP ที่เชื่อถือได้
 */
export async function addTrustedIP(
  userId: string,
  ip: string,
  addedBy: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data: user } = await supabase
    .from('users')
    .select('trusted_ips')
    .eq('id', userId)
    .single();

  const trustedIPs = user?.trusted_ips || [];
  
  if (!trustedIPs.includes(ip)) {
    trustedIPs.push(ip);
    
    await supabase
      .from('users')
      .update({ trusted_ips: trustedIPs })
      .eq('id', userId);

    await logSecurityEvent('ip_added', { userId, ip, addedBy });
  }

  return true;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function isIPInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
  const rangeNum = range.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
  
  return (ipNum & mask) === (rangeNum & mask);
}

async function notifyDeviceApprovalRequest(
  userId: string,
  deviceInfo: DeviceInfo,
  ipInfo: IPInfo
): Promise<void> {
  // Send LINE notification to super admin
  const message = `🔐 ขออนุมัติอุปกรณ์ใหม่
👤 User: ${userId}
📱 Device: ${deviceInfo.deviceName}
🌐 IP: ${ipInfo.ip} (${ipInfo.country || 'Unknown'})
⏰ เวลา: ${new Date().toLocaleString('th-TH')}`;

  // Queue notification
  await redis.lpush('notifications:device_approval', JSON.stringify({
    userId,
    deviceInfo,
    ipInfo,
    message,
    timestamp: new Date().toISOString(),
  }));
}

async function logSecurityEvent(
  eventType: string,
  data: Record<string, any>
): Promise<void> {
  const supabase = await createClient();

  await supabase.from('security_logs').insert({
    event_type: eventType,
    event_data: data,
    created_at: new Date().toISOString(),
  });
}

// =============================================
// EXPORTS
// =============================================

export const DeviceLock = {
  checkDeviceAccess,
  requestDeviceApproval,
  approveDevice,
  revokeDevice,
  addTrustedDevice,
  getUserDevices,
  checkIPAllowed,
  addTrustedIP,
  generateDeviceFingerprint,
};
