/**
 * Enterprise Session Manager
 * Secure session handling with device tracking and IP monitoring
 */

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export interface SessionInfo {
  id: string;
  user_id: string;
  user_type: string;
  tenant_id: string | null;
  ip_address: string;
  user_agent: string;
  device_info: Record<string, unknown>;
  geo_location: Record<string, unknown>;
  is_2fa_verified: boolean;
  last_activity_at: string;
  expires_at: string;
  created_at: string;
  is_current?: boolean;
}

export interface CreateSessionOptions {
  user_id: string;
  user_type: string;
  tenant_id?: string;
  ip_address: string;
  user_agent: string;
  device_info?: Record<string, unknown>;
  geo_location?: Record<string, unknown>;
  duration_hours?: number;
}

/**
 * Generate secure session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash session token for storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create new session
 */
export async function createSession(options: CreateSessionOptions): Promise<{ 
  success: boolean; 
  session_token?: string; 
  session?: SessionInfo;
  error?: string 
}> {
  const supabase = await createClient();
  
  // Check session policy
  const { data: policy } = await supabase
    .from('security_policies')
    .select('config')
    .eq('policy_type', 'session')
    .or(options.tenant_id ? `tenant_id.eq.${options.tenant_id},tenant_id.is.null` : 'tenant_id.is.null')
    .order('tenant_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  
  const sessionConfig = policy?.config as {
    max_duration_hours?: number;
    single_session?: boolean;
    max_concurrent_sessions?: number;
  } || {};
  
  const durationHours = options.duration_hours || sessionConfig.max_duration_hours || 24;
  
  // If single session mode, terminate existing sessions
  if (sessionConfig.single_session) {
    await supabase
      .from('active_sessions')
      .delete()
      .eq('user_id', options.user_id)
      .eq('user_type', options.user_type);
  } else if (sessionConfig.max_concurrent_sessions) {
    // Check concurrent session limit
    const { count } = await supabase
      .from('active_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', options.user_id)
      .eq('user_type', options.user_type)
      .gt('expires_at', new Date().toISOString());
    
    if ((count || 0) >= sessionConfig.max_concurrent_sessions) {
      // Terminate oldest session
      const { data: oldestSession } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('user_id', options.user_id)
        .eq('user_type', options.user_type)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      if (oldestSession) {
        await terminateSession(oldestSession.id, 'system', 'Max sessions exceeded');
      }
    }
  }
  
  // Generate token
  const sessionToken = generateSessionToken();
  const tokenHash = hashToken(sessionToken);
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + durationHours);
  
  // Create session
  const { data: session, error } = await supabase
    .from('active_sessions')
    .insert({
      user_id: options.user_id,
      user_type: options.user_type,
      tenant_id: options.tenant_id,
      session_token_hash: tokenHash,
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      device_info: options.device_info || {},
      geo_location: options.geo_location || {},
      is_2fa_verified: false,
      last_activity_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Log session creation
  await supabase.from('session_events').insert({
    session_id: session.id,
    event_type: 'created',
    details: { ip_address: options.ip_address, user_agent: options.user_agent }
  });
  
  return { 
    success: true, 
    session_token: sessionToken,
    session 
  };
}

/**
 * Validate session token
 */
export async function validateSession(sessionToken: string): Promise<{
  valid: boolean;
  session?: SessionInfo;
  error?: string;
}> {
  const supabase = await createClient();
  
  const tokenHash = hashToken(sessionToken);
  
  const { data: session, error } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('session_token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error || !session) {
    return { valid: false, error: 'Invalid or expired session' };
  }
  
  // Check session policy for idle timeout
  const { data: policy } = await supabase
    .from('security_policies')
    .select('config')
    .eq('policy_type', 'session')
    .or(session.tenant_id ? `tenant_id.eq.${session.tenant_id},tenant_id.is.null` : 'tenant_id.is.null')
    .order('tenant_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  
  const sessionConfig = policy?.config as { max_idle_minutes?: number } || {};
  
  if (sessionConfig.max_idle_minutes) {
    const lastActivity = new Date(session.last_activity_at);
    const idleMs = Date.now() - lastActivity.getTime();
    const maxIdleMs = sessionConfig.max_idle_minutes * 60 * 1000;
    
    if (idleMs > maxIdleMs) {
      await terminateSession(session.id, 'system', 'Session idle timeout');
      return { valid: false, error: 'Session expired due to inactivity' };
    }
  }
  
  return { valid: true, session };
}

/**
 * Refresh session activity
 */
export async function refreshSession(
  sessionToken: string,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const tokenHash = hashToken(sessionToken);
  
  const { data: session } = await supabase
    .from('active_sessions')
    .select('id, ip_address')
    .eq('session_token_hash', tokenHash)
    .single();
  
  if (!session) {
    return { success: false, error: 'Session not found' };
  }
  
  // Check for IP change
  const ipChanged = ipAddress && session.ip_address !== ipAddress;
  
  const updateData: Record<string, unknown> = {
    last_activity_at: new Date().toISOString()
  };
  
  if (ipChanged) {
    updateData.ip_address = ipAddress;
  }
  
  await supabase
    .from('active_sessions')
    .update(updateData)
    .eq('id', session.id);
  
  // Log IP change event
  if (ipChanged) {
    await supabase.from('session_events').insert({
      session_id: session.id,
      event_type: 'ip_changed',
      details: { 
        old_ip: session.ip_address, 
        new_ip: ipAddress 
      }
    });
  } else {
    await supabase.from('session_events').insert({
      session_id: session.id,
      event_type: 'refreshed',
      details: {}
    });
  }
  
  return { success: true };
}

/**
 * Terminate session
 */
export async function terminateSession(
  sessionId: string,
  terminatedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Log termination event
  await supabase.from('session_events').insert({
    session_id: sessionId,
    event_type: 'terminated',
    details: { terminated_by: terminatedBy, reason }
  });
  
  // Delete session
  const { error } = await supabase
    .from('active_sessions')
    .delete()
    .eq('id', sessionId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Terminate all user sessions
 */
export async function terminateAllUserSessions(
  userId: string,
  userType: string,
  exceptSessionId?: string,
  terminatedBy?: string,
  reason?: string
): Promise<{ success: boolean; terminated_count: number; error?: string }> {
  const supabase = await createClient();
  
  // Get all sessions
  let query = supabase
    .from('active_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('user_type', userType);
  
  if (exceptSessionId) {
    query = query.neq('id', exceptSessionId);
  }
  
  const { data: sessions } = await query;
  
  if (!sessions?.length) {
    return { success: true, terminated_count: 0 };
  }
  
  // Log termination events
  const events = sessions.map(s => ({
    session_id: s.id,
    event_type: 'terminated' as const,
    details: { terminated_by: terminatedBy || 'system', reason: reason || 'All sessions terminated' }
  }));
  
  await supabase.from('session_events').insert(events);
  
  // Delete sessions
  const sessionIds = sessions.map(s => s.id);
  await supabase
    .from('active_sessions')
    .delete()
    .in('id', sessionIds);
  
  return { success: true, terminated_count: sessions.length };
}

/**
 * Get user's active sessions
 */
export async function getUserSessions(
  userId: string,
  userType: string,
  currentSessionToken?: string
): Promise<SessionInfo[]> {
  const supabase = await createClient();
  
  const { data: sessions } = await supabase
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .gt('expires_at', new Date().toISOString())
    .order('last_activity_at', { ascending: false });
  
  if (!sessions) return [];
  
  const currentTokenHash = currentSessionToken ? hashToken(currentSessionToken) : null;
  
  return sessions.map(s => ({
    ...s,
    is_current: currentTokenHash ? s.session_token_hash === currentTokenHash : false
  }));
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<{ deleted_count: number }> {
  const supabase = await createClient();
  
  // Get expired sessions
  const { data: expiredSessions } = await supabase
    .from('active_sessions')
    .select('id')
    .lt('expires_at', new Date().toISOString());
  
  if (!expiredSessions?.length) {
    return { deleted_count: 0 };
  }
  
  // Log expiration events
  const events = expiredSessions.map(s => ({
    session_id: s.id,
    event_type: 'expired' as const,
    details: {}
  }));
  
  await supabase.from('session_events').insert(events);
  
  // Delete expired sessions
  const sessionIds = expiredSessions.map(s => s.id);
  await supabase
    .from('active_sessions')
    .delete()
    .in('id', sessionIds);
  
  return { deleted_count: expiredSessions.length };
}

/**
 * Check for suspicious session activity
 */
export async function detectSuspiciousActivity(
  userId: string,
  userType: string,
  newIpAddress: string,
  newUserAgent: string
): Promise<{ suspicious: boolean; reasons: string[] }> {
  const supabase = await createClient();
  
  const reasons: string[] = [];
  
  // Get recent login history
  const { data: recentLogins } = await supabase
    .from('login_attempts')
    .select('ip_address, user_agent, is_successful')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentLogins?.length) {
    // Check if IP is new
    const knownIPs = new Set(recentLogins.filter(l => l.is_successful).map(l => l.ip_address));
    if (!knownIPs.has(newIpAddress)) {
      reasons.push('New IP address');
    }
    
    // Check for recent failed attempts
    const recentFailures = recentLogins.filter(l => !l.is_successful).length;
    if (recentFailures >= 3) {
      reasons.push('Multiple recent failed login attempts');
    }
  }
  
  // Get active sessions
  const { data: activeSessions } = await supabase
    .from('active_sessions')
    .select('ip_address')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .gt('expires_at', new Date().toISOString());
  
  if (activeSessions?.length) {
    // Check for concurrent sessions from different IPs
    const sessionIPs = new Set(activeSessions.map(s => s.ip_address));
    if (!sessionIPs.has(newIpAddress) && sessionIPs.size > 0) {
      reasons.push('Login from different location while session active');
    }
  }
  
  return {
    suspicious: reasons.length > 0,
    reasons
  };
}
