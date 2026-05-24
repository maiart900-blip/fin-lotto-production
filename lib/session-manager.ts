/**
 * Session Manager System
 * จัดการ Sessions ทั้งหมด - เตะออก, ดูประวัติ Login, Revoke
 * Production Ready
 */

import { Redis } from '@upstash/redis';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { logAuditEvent } from '@/lib/audit-logger';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Session Types
export interface UserSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  ipAddress: string;
  location?: {
    country: string;
    city: string;
  };
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
  isTrusted: boolean;
}

export interface SessionActivity {
  id: string;
  sessionId: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

// Session Configuration
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const MAX_SESSIONS_PER_USER = 5;

/**
 * Parse User Agent
 */
function parseUserAgent(ua: string): {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  deviceName: string;
} {
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'unknown';
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceName = 'Unknown Device';
  
  // Detect device type
  if (/mobile/i.test(ua)) deviceType = 'mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';
  else if (/windows|mac|linux/i.test(ua)) deviceType = 'desktop';
  
  // Detect browser
  if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';
  
  // Detect OS
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  
  // Generate device name
  deviceName = `${browser} on ${os}`;
  
  return { deviceType, browser, os, deviceName };
}

/**
 * Generate Device ID from fingerprint
 */
export function generateDeviceId(ua: string, ip: string): string {
  const data = `${ua}-${ip}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `device_${Math.abs(hash).toString(36)}`;
}

/**
 * Create New Session
 */
export async function createSession(
  userId: string,
  ipAddress: string,
  userAgent: string,
  location?: { country: string; city: string }
): Promise<UserSession> {
  const supabase = await createClient();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const deviceId = generateDeviceId(userAgent, ipAddress);
  const { deviceType, browser, os, deviceName } = parseUserAgent(userAgent);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL * 1000);
  
  const session: UserSession = {
    id: sessionId,
    userId,
    deviceId,
    deviceName,
    deviceType,
    browser,
    os,
    ipAddress,
    location,
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isCurrent: true,
    isTrusted: false,
  };
  
  // Check existing sessions for this user
  const existingSessions = await getUserSessions(userId);
  
  // If too many sessions, remove oldest
  if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
    const oldestSession = existingSessions.sort(
      (a, b) => new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()
    )[0];
    await revokeSession(userId, oldestSession.id, 'auto_expired');
  }
  
  // Store in database
  await supabase.from('user_sessions').insert({
    id: sessionId,
    user_id: userId,
    device_id: deviceId,
    device_name: deviceName,
    device_type: deviceType,
    browser,
    os,
    ip_address: ipAddress,
    country: location?.country,
    city: location?.city,
    created_at: session.createdAt,
    last_active_at: session.lastActiveAt,
    expires_at: session.expiresAt,
    is_trusted: false,
    is_active: true,
  });
  
  // Store session token in Redis for fast lookup
  await redis.setex(`session:${sessionId}`, SESSION_TTL, {
    userId,
    deviceId,
    createdAt: session.createdAt,
  });
  
  // Add to user's session set
  await redis.sadd(`user:sessions:${userId}`, sessionId);
  
  // Log activity
  await logSessionActivity(sessionId, 'session_created', { ipAddress, deviceName });
  
  return session;
}

/**
 * Get User Sessions
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_active_at', { ascending: false });
  
  if (error || !data) return [];
  
  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceType: row.device_type,
    browser: row.browser,
    os: row.os,
    ipAddress: row.ip_address,
    location: row.country ? { country: row.country, city: row.city } : undefined,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    expiresAt: row.expires_at,
    isCurrent: false, // Will be set by caller
    isTrusted: row.is_trusted,
  }));
}

/**
 * Get Session by ID
 */
export async function getSession(sessionId: string): Promise<UserSession | null> {
  // Check Redis first for fast lookup
  const cached = await redis.get<{ userId: string }>(`session:${sessionId}`);
  if (!cached) return null;
  
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('is_active', true)
    .single();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    userId: data.user_id,
    deviceId: data.device_id,
    deviceName: data.device_name,
    deviceType: data.device_type,
    browser: data.browser,
    os: data.os,
    ipAddress: data.ip_address,
    location: data.country ? { country: data.country, city: data.city } : undefined,
    createdAt: data.created_at,
    lastActiveAt: data.last_active_at,
    expiresAt: data.expires_at,
    isCurrent: false,
    isTrusted: data.is_trusted,
  };
}

/**
 * Update Session Activity
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  await supabase
    .from('user_sessions')
    .update({ last_active_at: now })
    .eq('id', sessionId);
  
  // Extend Redis TTL
  await redis.expire(`session:${sessionId}`, SESSION_TTL);
}

/**
 * Revoke Session (Logout single session)
 */
export async function revokeSession(
  userId: string,
  sessionId: string,
  reason: string = 'user_logout'
): Promise<boolean> {
  const supabase = await createClient();
  
  // Mark as inactive in database
  const { error } = await supabase
    .from('user_sessions')
    .update({ 
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
    })
    .eq('id', sessionId)
    .eq('user_id', userId);
  
  if (error) return false;
  
  // Remove from Redis
  await redis.del(`session:${sessionId}`);
  await redis.srem(`user:sessions:${userId}`, sessionId);
  
  // Log activity
  await logSessionActivity(sessionId, 'session_revoked', { reason });
  
  // Audit log
  await logAuditEvent({
    userId,
    action: 'session_revoked',
    targetType: 'session',
    targetId: sessionId,
    details: { reason },
  });
  
  return true;
}

/**
 * Revoke All Sessions (Logout from all devices)
 */
export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string,
  reason: string = 'logout_all'
): Promise<number> {
  const supabase = await createClient();
  
  // Get all active sessions
  const sessions = await getUserSessions(userId);
  let revokedCount = 0;
  
  for (const session of sessions) {
    if (exceptSessionId && session.id === exceptSessionId) continue;
    
    const success = await revokeSession(userId, session.id, reason);
    if (success) revokedCount++;
  }
  
  // Audit log
  await logAuditEvent({
    userId,
    action: 'all_sessions_revoked',
    targetType: 'user',
    targetId: userId,
    details: { revokedCount, reason, exceptSessionId },
  });
  
  return revokedCount;
}

/**
 * Kick User (Admin action)
 * Force logout user from all sessions
 */
export async function kickUser(
  targetUserId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; sessionsRevoked: number }> {
  const revokedCount = await revokeAllSessions(targetUserId, undefined, `kicked: ${reason}`);
  
  // Audit log
  await logAuditEvent({
    userId: adminId,
    action: 'user_kicked',
    targetType: 'user',
    targetId: targetUserId,
    details: { reason, sessionsRevoked: revokedCount },
  });
  
  return { success: true, sessionsRevoked: revokedCount };
}

/**
 * Trust Device
 * Mark a device as trusted (skip 2FA next time)
 */
export async function trustDevice(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('user_sessions')
    .update({ is_trusted: true })
    .eq('id', sessionId)
    .eq('user_id', userId);
  
  if (error) return false;
  
  await logSessionActivity(sessionId, 'device_trusted', {});
  
  return true;
}

/**
 * Untrust Device
 */
export async function untrustDevice(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('user_sessions')
    .update({ is_trusted: false })
    .eq('id', sessionId)
    .eq('user_id', userId);
  
  return !error;
}

/**
 * Log Session Activity
 */
async function logSessionActivity(
  sessionId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();
  const headersList = await headers();
  
  await supabase.from('session_activity_logs').insert({
    session_id: sessionId,
    action,
    details,
    ip_address: headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown',
    user_agent: headersList.get('user-agent') || 'unknown',
    created_at: new Date().toISOString(),
  });
}

/**
 * Get Session Activity History
 */
export async function getSessionActivity(
  sessionId: string,
  limit: number = 50
): Promise<SessionActivity[]> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('session_activity_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return (data || []).map(row => ({
    id: row.id,
    sessionId: row.session_id,
    action: row.action,
    details: row.details,
    ipAddress: row.ip_address,
    timestamp: row.created_at,
  }));
}

/**
 * Get User Login History
 */
export async function getLoginHistory(
  userId: string,
  days: number = 30
): Promise<Array<{
  sessionId: string;
  deviceName: string;
  ipAddress: string;
  location?: { country: string; city: string };
  createdAt: string;
  isActive: boolean;
}>> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const { data } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  
  return (data || []).map(row => ({
    sessionId: row.id,
    deviceName: row.device_name,
    ipAddress: row.ip_address,
    location: row.country ? { country: row.country, city: row.city } : undefined,
    createdAt: row.created_at,
    isActive: row.is_active,
  }));
}

/**
 * Cleanup Expired Sessions
 * Run periodically via cron
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  // Get expired sessions
  const { data: expiredSessions } = await supabase
    .from('user_sessions')
    .select('id, user_id')
    .eq('is_active', true)
    .lt('expires_at', now);
  
  if (!expiredSessions || expiredSessions.length === 0) return 0;
  
  // Revoke each expired session
  for (const session of expiredSessions) {
    await revokeSession(session.user_id, session.id, 'expired');
  }
  
  return expiredSessions.length;
}

/**
 * Get Online Users Count
 */
export async function getOnlineUsersCount(): Promise<number> {
  const supabase = await createClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from('user_sessions')
    .select('user_id', { count: 'exact', head: true })
    .eq('is_active', true)
    .gte('last_active_at', fiveMinutesAgo);
  
  return count || 0;
}

/**
 * Validate Session Token
 */
export async function validateSession(sessionId: string): Promise<{
  valid: boolean;
  userId?: string;
  session?: UserSession;
}> {
  // Quick check in Redis
  const cached = await redis.get<{ userId: string }>(`session:${sessionId}`);
  if (!cached) {
    return { valid: false };
  }
  
  // Get full session data
  const session = await getSession(sessionId);
  if (!session) {
    // Session was revoked, clean up Redis
    await redis.del(`session:${sessionId}`);
    return { valid: false };
  }
  
  // Check expiration
  if (new Date(session.expiresAt) < new Date()) {
    await revokeSession(session.userId, sessionId, 'expired');
    return { valid: false };
  }
  
  // Update activity
  await updateSessionActivity(sessionId);
  
  return {
    valid: true,
    userId: session.userId,
    session,
  };
}
