import { createClient } from './supabase/server';
import { getEnvStatus } from './env';

// System Health Check
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: boolean; latency?: number; error?: string };
    auth: { status: boolean; error?: string };
    storage: { status: boolean; error?: string };
    email: { status: boolean; error?: string };
    api: { status: boolean; error?: string };
  };
  env: Record<string, boolean>;
}

export async function checkSystemHealth(): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {
    database: { status: false },
    auth: { status: false },
    storage: { status: false },
    email: { status: false },
    api: { status: true }, // API is running if this code executes
  };

  // Check database
  const dbStart = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('users').select('count').limit(1).single();
    checks.database = { 
      status: !error, 
      latency: Date.now() - dbStart,
      error: error?.message,
    };
  } catch (e) {
    checks.database = { 
      status: false, 
      error: e instanceof Error ? e.message : 'Database connection failed' 
    };
  }

  // Check auth (JWT secret exists)
  checks.auth = { status: !!process.env.JWT_SECRET };

  // Check storage
  checks.storage = { status: !!process.env.BLOB_READ_WRITE_TOKEN };

  // Check email
  checks.email = { status: !!process.env.SMTP_HOST };

  // Determine overall status
  const allChecks = Object.values(checks);
  const passedChecks = allChecks.filter(c => c.status).length;
  
  let status: HealthStatus['status'];
  if (passedChecks === allChecks.length) {
    status = 'healthy';
  } else if (passedChecks >= allChecks.length / 2) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
    env: getEnvStatus(),
  };
}

// Log system event
export async function logSystemEvent(
  level: 'info' | 'warn' | 'error' | 'critical',
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('system_logs').insert({
      level,
      message,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Fallback to console if database logging fails
    console[level === 'critical' ? 'error' : level]('[System]', message, details);
  }
}

// Alert when critical issue
export async function sendCriticalAlert(
  type: 'database_down' | 'high_error_rate' | 'security_breach' | 'system_failure',
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  // Log to database
  await logSystemEvent('critical', message, { type, ...details });

  // In production, send to alerting service (Slack, PagerDuty, etc.)
  console.error('[CRITICAL ALERT]', type, message, details);

  // Create notification for admin
  try {
    const supabase = await createClient();
    await supabase.from('notifications').insert({
      admin_id: null, // Send to all admins
      title: `Critical Alert: ${type}`,
      message,
      type: 'alert',
    });
  } catch (e) {
    console.error('[Alert] Failed to create notification:', e);
  }
}

// Monitor request latency
export function measureLatency<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latency: number }> {
  const start = Date.now();
  return fn().then(result => ({
    result,
    latency: Date.now() - start,
  }));
}

// Check if system is in maintenance mode
export async function isMaintenanceMode(): Promise<boolean> {
  if (process.env.MAINTENANCE_MODE === 'true') return true;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .single();
    return data?.value === 'true';
  } catch {
    return false;
  }
}
