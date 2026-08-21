/**
 * Enterprise Security Monitor
 * Detects threats, manages incidents, and enforces security policies
 */

import { createClient } from '@/lib/supabase/server';

export type IncidentType = 
  | 'brute_force' 
  | 'suspicious_login' 
  | 'unauthorized_access' 
  | 'data_breach' 
  | 'api_abuse' 
  | 'fraud_attempt' 
  | 'policy_violation' 
  | 'system_compromise';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityIncident {
  id: string;
  tenant_id: string | null;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  affected_users: string[];
  affected_resources: string[];
  source_ip: string;
  evidence: Record<string, unknown>;
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'false_positive';
  assigned_to: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface LoginAttemptRecord {
  user_id?: string;
  user_type?: string;
  tenant_id?: string;
  username?: string;
  ip_address: string;
  user_agent?: string;
  device_fingerprint?: string;
  attempt_type: 'login' | '2fa' | 'password_reset' | 'api_key';
  is_successful: boolean;
  failure_reason?: string;
  geo_location?: Record<string, unknown>;
}

/**
 * Record login attempt
 */
export async function recordLoginAttempt(attempt: LoginAttemptRecord): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from('login_attempts').insert({
    ...attempt,
    created_at: new Date().toISOString()
  });
  
  // Check for brute force
  if (!attempt.is_successful) {
    await checkBruteForce(attempt.ip_address, attempt.username, attempt.tenant_id);
  }
}

/**
 * Check for brute force attacks
 */
async function checkBruteForce(
  ipAddress: string,
  username?: string,
  tenantId?: string
): Promise<void> {
  const supabase = await createClient();
  
  // Get login policy
  const { data: policy } = await supabase
    .from('security_policies')
    .select('config')
    .eq('policy_type', 'login')
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .order('tenant_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  
  const config = policy?.config as {
    max_attempts?: number;
    lockout_minutes?: number;
    detection_window_minutes?: number;
  } || {};
  
  const maxAttempts = config.max_attempts || 5;
  const detectionWindow = config.detection_window_minutes || 15;
  
  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - detectionWindow);
  
  // Count failed attempts by IP
  const { count: ipFailures } = await supabase
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .eq('is_successful', false)
    .gte('created_at', windowStart.toISOString());
  
  // Count failed attempts by username
  let usernameFailures = 0;
  if (username) {
    const { count } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('username', username)
      .eq('is_successful', false)
      .gte('created_at', windowStart.toISOString());
    usernameFailures = count || 0;
  }
  
  // Create incident if threshold exceeded
  if ((ipFailures || 0) >= maxAttempts || usernameFailures >= maxAttempts) {
    await createSecurityIncident({
      tenant_id: tenantId ?? null,
      incident_type: 'brute_force',
      severity: (ipFailures || 0) >= maxAttempts * 2 ? 'high' : 'medium',
      title: `Brute force attack detected`,
      description: `Multiple failed login attempts detected. IP: ${ipAddress}, Username: ${username || 'N/A'}, IP Failures: ${ipFailures}, Username Failures: ${usernameFailures}`,
      affected_users: username ? [username] : [],
      affected_resources: [],
      source_ip: ipAddress,
      evidence: {
        ip_failures: ipFailures,
        username_failures: usernameFailures,
        detection_window_minutes: detectionWindow
      }
    });
    
    // Add IP to blacklist temporarily
    await blacklistIP(ipAddress, config.lockout_minutes || 30, tenantId);
  }
}

/**
 * Blacklist IP address
 */
export async function blacklistIP(
  ipAddress: string,
  durationMinutes: number,
  tenantId?: string,
  reason?: string
): Promise<void> {
  const supabase = await createClient();
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);
  
  await supabase.from('ip_access_rules').insert({
    tenant_id: tenantId ?? null,
    rule_type: 'blacklist',
    ip_address: ipAddress,
    description: reason || `Auto-blacklisted due to suspicious activity`,
    applies_to: 'login',
    is_active: true,
    expires_at: expiresAt.toISOString()
  });
}

/**
 * Check if IP is blacklisted
 */
export async function isIPBlacklisted(
  ipAddress: string,
  tenantId?: string,
  appliesTo: string = 'all'
): Promise<boolean> {
  const supabase = await createClient();
  
  const { count } = await supabase
    .from('ip_access_rules')
    .select('*', { count: 'exact', head: true })
    .eq('rule_type', 'blacklist')
    .eq('ip_address', ipAddress)
    .eq('is_active', true)
    .or(`applies_to.eq.all,applies_to.eq.${appliesTo}`)
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .or('expires_at.is.null,expires_at.gt.now()');
  
  return (count || 0) > 0;
}

/**
 * Check if IP is whitelisted
 */
export async function isIPWhitelisted(
  ipAddress: string,
  tenantId?: string,
  appliesTo: string = 'all'
): Promise<boolean> {
  const supabase = await createClient();
  
  const { count } = await supabase
    .from('ip_access_rules')
    .select('*', { count: 'exact', head: true })
    .eq('rule_type', 'whitelist')
    .eq('ip_address', ipAddress)
    .eq('is_active', true)
    .or(`applies_to.eq.all,applies_to.eq.${appliesTo}`)
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .or('expires_at.is.null,expires_at.gt.now()');
  
  return (count || 0) > 0;
}

/**
 * Create security incident
 */
export async function createSecurityIncident(incident: Omit<SecurityIncident, 'id' | 'status' | 'resolution' | 'resolved_at' | 'created_at' | 'assigned_to'>): Promise<SecurityIncident> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('security_incidents')
    .insert({
      ...incident,
      status: 'open'
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  // Notify if critical
  if (incident.severity === 'critical' || incident.severity === 'high') {
    await notifySecurityTeam(data);
  }
  
  return data;
}

/**
 * Update incident status
 */
export async function updateIncidentStatus(
  incidentId: string,
  status: SecurityIncident['status'],
  resolution?: string,
  updatedBy?: string
): Promise<void> {
  const supabase = await createClient();
  
  const updateData: Record<string, unknown> = { status };
  
  if (status === 'resolved' || status === 'false_positive') {
    updateData.resolution = resolution;
    updateData.resolved_at = new Date().toISOString();
  }
  
  await supabase
    .from('security_incidents')
    .update(updateData)
    .eq('id', incidentId);
  
  // Log the update
  if (updatedBy) {
    await supabase.from('audit_logs').insert({
      actor_id: updatedBy,
      actor_type: 'admin',
      action: 'incident_status_updated',
      resource_type: 'security_incident',
      resource_id: incidentId,
      details: { new_status: status, resolution }
    });
  }
}

/**
 * Get active incidents
 */
export async function getActiveIncidents(
  tenantId?: string,
  severity?: IncidentSeverity
): Promise<SecurityIncident[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('security_incidents')
    .select('*')
    .in('status', ['open', 'investigating', 'contained'])
    .order('created_at', { ascending: false });
  
  if (tenantId) {
    query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  }
  
  if (severity) {
    query = query.eq('severity', severity);
  }
  
  const { data } = await query;
  
  return data || [];
}

/**
 * Notify security team of incident
 */
async function notifySecurityTeam(incident: SecurityIncident): Promise<void> {
  // In production, this would send emails/SMS/Slack notifications
  // For now, just log it
  console.log(`[SECURITY ALERT] ${incident.severity.toUpperCase()}: ${incident.title}`);
  
  // Could also create a notification record
  const supabase = await createClient();
  
  await supabase.from('audit_logs').insert({
    tenant_id: incident.tenant_id,
    actor_id: null,
    actor_type: 'system',
    action: 'security_alert_sent',
    resource_type: 'security_incident',
    resource_id: incident.id,
    details: { severity: incident.severity, incident_type: incident.incident_type }
  });
}

/**
 * Log sensitive data access
 */
export async function logDataAccess(
  userId: string,
  userType: string,
  resourceType: string,
  resourceId: string | null,
  action: 'view' | 'export' | 'modify' | 'delete' | 'bulk_access',
  recordCount: number = 1,
  tenantId?: string,
  ipAddress?: string
): Promise<void> {
  const supabase = await createClient();
  
  // Determine data classification
  const sensitiveTypes = ['customers', 'transactions', 'financial', 'credentials', 'pii'];
  const classification = sensitiveTypes.some(t => resourceType.toLowerCase().includes(t))
    ? 'confidential'
    : 'internal';
  
  await supabase.from('data_access_logs').insert({
    tenant_id: tenantId ?? null,
    user_id: userId,
    user_type: userType,
    resource_type: resourceType,
    resource_id: resourceId,
    action,
    data_classification: classification,
    record_count: recordCount,
    ip_address: ipAddress
  });
  
  // Flag suspicious bulk access
  if (action === 'bulk_access' || action === 'export' || recordCount > 100) {
    // Check for unusual access patterns
    const { count } = await supabase
      .from('data_access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('action', ['bulk_access', 'export'])
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour
    
    if ((count || 0) > 10) {
      await createSecurityIncident({
        tenant_id: tenantId ?? null,
        incident_type: 'unauthorized_access',
        severity: 'medium',
        title: 'Unusual data access pattern detected',
        description: `User ${userId} has performed ${count} bulk/export operations in the last hour`,
        affected_users: [userId],
        affected_resources: [resourceType],
        source_ip: ipAddress || 'unknown',
        evidence: {
          access_count: count,
          latest_action: action,
          record_count: recordCount
        }
      });
    }
  }
}

/**
 * Validate password against policy
 */
export async function validatePassword(
  password: string,
  tenantId?: string
): Promise<{ valid: boolean; errors: string[] }> {
  const supabase = await createClient();
  
  const { data: policy } = await supabase
    .from('security_policies')
    .select('config')
    .eq('policy_type', 'password')
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .order('tenant_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  
  const config = policy?.config as {
    min_length?: number;
    require_uppercase?: boolean;
    require_lowercase?: boolean;
    require_number?: boolean;
    require_special?: boolean;
  } || {};
  
  const errors: string[] = [];
  
  if (password.length < (config.min_length || 8)) {
    errors.push(`Password must be at least ${config.min_length || 8} characters`);
  }
  
  if (config.require_uppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (config.require_lowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (config.require_number && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (config.require_special && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Check rate limit for API
 */
export async function checkRateLimit(
  apiKeyId: string,
  endpoint: string,
  ipAddress: string
): Promise<{ allowed: boolean; remaining: number; reset_at: string }> {
  const supabase = await createClient();
  
  // Get API key and its limits
  const { data: apiKey } = await supabase
    .from('api_keys')
    .select('rate_limit_per_minute, rate_limit_per_day, tenant_id')
    .eq('id', apiKeyId)
    .eq('is_active', true)
    .single();
  
  if (!apiKey) {
    return { allowed: false, remaining: 0, reset_at: new Date().toISOString() };
  }
  
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Check minute limit
  const { count: minuteCount } = await supabase
    .from('api_key_usage')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', minuteAgo.toISOString());
  
  // Check day limit
  const { count: dayCount } = await supabase
    .from('api_key_usage')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', dayAgo.toISOString());
  
  const minuteRemaining = apiKey.rate_limit_per_minute - (minuteCount || 0);
  const dayRemaining = apiKey.rate_limit_per_day - (dayCount || 0);
  
  const allowed = minuteRemaining > 0 && dayRemaining > 0;
  const remaining = Math.min(minuteRemaining, dayRemaining);
  
  // Reset time is end of current minute window
  const resetAt = new Date(now.getTime() + 60 * 1000);
  
  if (!allowed) {
    // Log rate limit exceeded
    await createSecurityIncident({
      tenant_id: apiKey.tenant_id,
      incident_type: 'api_abuse',
      severity: 'low',
      title: 'API rate limit exceeded',
      description: `API key ${apiKeyId} exceeded rate limit on endpoint ${endpoint}`,
      affected_users: [],
      affected_resources: [endpoint],
      source_ip: ipAddress,
      evidence: {
        minute_count: minuteCount,
        day_count: dayCount,
        minute_limit: apiKey.rate_limit_per_minute,
        day_limit: apiKey.rate_limit_per_day
      }
    });
  }
  
  return {
    allowed,
    remaining: Math.max(0, remaining),
    reset_at: resetAt.toISOString()
  };
}

/**
 * Log API key usage
 */
export async function logAPIKeyUsage(
  apiKeyId: string,
  endpoint: string,
  method: string,
  ipAddress: string,
  responseStatus: number,
  responseTimeMs: number
): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from('api_key_usage').insert({
    api_key_id: apiKeyId,
    endpoint,
    method,
    ip_address: ipAddress,
    response_status: responseStatus,
    response_time_ms: responseTimeMs
  });
  
  // Update API key last used
  await supabase
    .from('api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      usage_count: supabase.rpc('increment_api_key_usage', { key_id: apiKeyId })
    })
    .eq('id', apiKeyId);
}

