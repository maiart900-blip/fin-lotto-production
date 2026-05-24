/**
 * Error Tracking & Centralized Logging System
 * ตรวจจับ Error อัตโนมัติ, รวม Log ทุก Service, ค้นหาปัญหาเร็ว
 * Production Ready
 */

import { Redis } from '@upstash/redis';
import { createClient } from '@/lib/supabase/server';
import { sendSystemErrorAlert } from '@/lib/notifications/line-notify';
import { headers } from 'next/headers';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Log Types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogService = 
  | 'api' 
  | 'auth' 
  | 'payment' 
  | 'lottery' 
  | 'settlement' 
  | 'cron' 
  | 'webhook'
  | 'customer'
  | 'admin'
  | 'system';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: LogService;
  action: string;
  message: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  tags?: string[];
}

export interface ErrorReport {
  id: string;
  errorHash: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
  level: LogLevel;
  service: LogService;
  action: string;
  message: string;
  errorName: string;
  errorStack?: string;
  affectedUsers: string[];
  status: 'new' | 'acknowledged' | 'resolved' | 'ignored';
  assignedTo?: string;
  resolvedAt?: string;
  resolution?: string;
}

// Log level priorities
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// Current log level from environment
const CURRENT_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate error hash for grouping similar errors
 */
function generateErrorHash(error: Error, service: LogService, action: string): string {
  const key = `${service}:${action}:${error.name}:${error.message.slice(0, 100)}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `err_${Math.abs(hash).toString(36)}`;
}

/**
 * Should log at this level?
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];
}

/**
 * Create Log Entry
 */
export async function log(
  level: LogLevel,
  service: LogService,
  action: string,
  message: string,
  options?: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
    error?: Error;
    duration?: number;
    tags?: string[];
  }
): Promise<void> {
  if (!shouldLog(level)) return;
  
  const supabase = await createClient();
  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  let ipAddress: string | undefined;
  let userAgent: string | undefined;
  
  try {
    const headersList = await headers();
    ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || undefined;
    userAgent = headersList.get('user-agent') || undefined;
  } catch {
    // Headers not available (e.g., in cron jobs)
  }
  
  const logEntry: LogEntry = {
    id: logId,
    timestamp: now,
    level,
    service,
    action,
    message,
    userId: options?.userId,
    sessionId: options?.sessionId,
    requestId: options?.requestId,
    ipAddress,
    userAgent,
    metadata: options?.metadata,
    error: options?.error ? {
      name: options.error.name,
      message: options.error.message,
      stack: options.error.stack,
      code: (options.error as Error & { code?: string }).code,
    } : undefined,
    duration: options?.duration,
    tags: options?.tags,
  };
  
  // Store in database
  await supabase.from('system_logs').insert({
    id: logId,
    timestamp: now,
    level,
    service,
    action,
    message,
    user_id: options?.userId,
    session_id: options?.sessionId,
    request_id: options?.requestId,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata: options?.metadata,
    error_name: options?.error?.name,
    error_message: options?.error?.message,
    error_stack: options?.error?.stack,
    duration_ms: options?.duration,
    tags: options?.tags,
  });
  
  // Store recent logs in Redis for fast access
  await redis.lpush('logs:recent', JSON.stringify(logEntry));
  await redis.ltrim('logs:recent', 0, 999); // Keep last 1000 logs
  
  // Track errors separately
  if (level === 'error' || level === 'fatal') {
    await trackError(logEntry);
  }
  
  // Send alert for fatal errors
  if (level === 'fatal') {
    await sendSystemErrorAlert(
      action,
      message,
      'critical'
    );
  }
}

/**
 * Track Error for grouping and alerting
 */
async function trackError(logEntry: LogEntry): Promise<void> {
  if (!logEntry.error) return;
  
  const supabase = await createClient();
  const errorHash = generateErrorHash(
    { name: logEntry.error.name, message: logEntry.error.message } as Error,
    logEntry.service,
    logEntry.action
  );
  
  // Check if error already exists
  const { data: existingError } = await supabase
    .from('error_reports')
    .select('*')
    .eq('error_hash', errorHash)
    .single();
  
  if (existingError) {
    // Update existing error
    const affectedUsers = existingError.affected_users || [];
    if (logEntry.userId && !affectedUsers.includes(logEntry.userId)) {
      affectedUsers.push(logEntry.userId);
    }
    
    await supabase
      .from('error_reports')
      .update({
        last_seen: logEntry.timestamp,
        count: existingError.count + 1,
        affected_users: affectedUsers.slice(-100), // Keep last 100 users
      })
      .eq('id', existingError.id);
    
    // Check if we should alert again (every 10 occurrences or first 5)
    const newCount = existingError.count + 1;
    if (newCount <= 5 || newCount % 10 === 0) {
      await sendSystemErrorAlert(
        `${logEntry.action} (${newCount}x)`,
        logEntry.error.message,
        newCount > 50 ? 'critical' : 'high'
      );
    }
  } else {
    // Create new error report
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await supabase.from('error_reports').insert({
      id: reportId,
      error_hash: errorHash,
      first_seen: logEntry.timestamp,
      last_seen: logEntry.timestamp,
      count: 1,
      level: logEntry.level,
      service: logEntry.service,
      action: logEntry.action,
      message: logEntry.message,
      error_name: logEntry.error.name,
      error_stack: logEntry.error.stack,
      affected_users: logEntry.userId ? [logEntry.userId] : [],
      status: 'new',
    });
    
    // Alert for new error
    await sendSystemErrorAlert(
      logEntry.action,
      logEntry.error.message,
      logEntry.level === 'fatal' ? 'critical' : 'medium'
    );
  }
}

/**
 * Shorthand logging functions
 */
export const logger = {
  debug: (service: LogService, action: string, message: string, options?: Parameters<typeof log>[4]) =>
    log('debug', service, action, message, options),
  
  info: (service: LogService, action: string, message: string, options?: Parameters<typeof log>[4]) =>
    log('info', service, action, message, options),
  
  warn: (service: LogService, action: string, message: string, options?: Parameters<typeof log>[4]) =>
    log('warn', service, action, message, options),
  
  error: (service: LogService, action: string, message: string, error?: Error, options?: Parameters<typeof log>[4]) =>
    log('error', service, action, message, { ...options, error }),
  
  fatal: (service: LogService, action: string, message: string, error?: Error, options?: Parameters<typeof log>[4]) =>
    log('fatal', service, action, message, { ...options, error }),
};

/**
 * Get Recent Logs
 */
export async function getRecentLogs(limit: number = 100): Promise<LogEntry[]> {
  const logs = await redis.lrange('logs:recent', 0, limit - 1);
  return logs.map(log => JSON.parse(log as string));
}

/**
 * Search Logs
 */
export async function searchLogs(options: {
  level?: LogLevel[];
  service?: LogService[];
  action?: string;
  userId?: string;
  requestId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ logs: LogEntry[]; total: number }> {
  const supabase = await createClient();
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('system_logs')
    .select('*', { count: 'exact' });
  
  if (options.level && options.level.length > 0) {
    query = query.in('level', options.level);
  }
  
  if (options.service && options.service.length > 0) {
    query = query.in('service', options.service);
  }
  
  if (options.action) {
    query = query.ilike('action', `%${options.action}%`);
  }
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }
  
  if (options.requestId) {
    query = query.eq('request_id', options.requestId);
  }
  
  if (options.search) {
    query = query.or(`message.ilike.%${options.search}%,action.ilike.%${options.search}%`);
  }
  
  if (options.startDate) {
    query = query.gte('timestamp', options.startDate);
  }
  
  if (options.endDate) {
    query = query.lte('timestamp', options.endDate);
  }
  
  const { data, count } = await query
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);
  
  return {
    logs: (data || []).map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      service: row.service,
      action: row.action,
      message: row.message,
      userId: row.user_id,
      sessionId: row.session_id,
      requestId: row.request_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata,
      error: row.error_name ? {
        name: row.error_name,
        message: row.error_message,
        stack: row.error_stack,
      } : undefined,
      duration: row.duration_ms,
      tags: row.tags,
    })),
    total: count || 0,
  };
}

/**
 * Get Error Reports
 */
export async function getErrorReports(options: {
  status?: string[];
  service?: LogService[];
  page?: number;
  limit?: number;
}): Promise<{ reports: ErrorReport[]; total: number }> {
  const supabase = await createClient();
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('error_reports')
    .select('*', { count: 'exact' });
  
  if (options.status && options.status.length > 0) {
    query = query.in('status', options.status);
  }
  
  if (options.service && options.service.length > 0) {
    query = query.in('service', options.service);
  }
  
  const { data, count } = await query
    .order('last_seen', { ascending: false })
    .range(offset, offset + limit - 1);
  
  return {
    reports: (data || []).map(row => ({
      id: row.id,
      errorHash: row.error_hash,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      count: row.count,
      level: row.level,
      service: row.service,
      action: row.action,
      message: row.message,
      errorName: row.error_name,
      errorStack: row.error_stack,
      affectedUsers: row.affected_users || [],
      status: row.status,
      assignedTo: row.assigned_to,
      resolvedAt: row.resolved_at,
      resolution: row.resolution,
    })),
    total: count || 0,
  };
}

/**
 * Update Error Report Status
 */
export async function updateErrorStatus(
  reportId: string,
  status: 'acknowledged' | 'resolved' | 'ignored',
  options?: {
    assignedTo?: string;
    resolution?: string;
  }
): Promise<boolean> {
  const supabase = await createClient();
  
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  
  if (options?.assignedTo) {
    updateData.assigned_to = options.assignedTo;
  }
  
  if (status === 'resolved') {
    updateData.resolved_at = new Date().toISOString();
    if (options?.resolution) {
      updateData.resolution = options.resolution;
    }
  }
  
  const { error } = await supabase
    .from('error_reports')
    .update(updateData)
    .eq('id', reportId);
  
  return !error;
}

/**
 * Get Log Statistics
 */
export async function getLogStats(hours: number = 24): Promise<{
  totalLogs: number;
  byLevel: Record<LogLevel, number>;
  byService: Record<string, number>;
  errorRate: number;
  topErrors: Array<{ action: string; count: number }>;
}> {
  const supabase = await createClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  // Total logs
  const { count: totalLogs } = await supabase
    .from('system_logs')
    .select('id', { count: 'exact', head: true })
    .gte('timestamp', since);
  
  // By level
  const { data: levelData } = await supabase
    .from('system_logs')
    .select('level')
    .gte('timestamp', since);
  
  const byLevel: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0,
  };
  
  (levelData || []).forEach(row => {
    byLevel[row.level as LogLevel]++;
  });
  
  // By service
  const { data: serviceData } = await supabase
    .from('system_logs')
    .select('service')
    .gte('timestamp', since);
  
  const byService: Record<string, number> = {};
  (serviceData || []).forEach(row => {
    byService[row.service] = (byService[row.service] || 0) + 1;
  });
  
  // Error rate
  const errorCount = byLevel.error + byLevel.fatal;
  const errorRate = totalLogs ? (errorCount / (totalLogs || 1)) * 100 : 0;
  
  // Top errors
  const { data: topErrorsData } = await supabase
    .from('system_logs')
    .select('action')
    .in('level', ['error', 'fatal'])
    .gte('timestamp', since);
  
  const errorCounts: Record<string, number> = {};
  (topErrorsData || []).forEach(row => {
    errorCounts[row.action] = (errorCounts[row.action] || 0) + 1;
  });
  
  const topErrors = Object.entries(errorCounts)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalLogs: totalLogs || 0,
    byLevel,
    byService,
    errorRate: Math.round(errorRate * 100) / 100,
    topErrors,
  };
}

/**
 * Clean Old Logs
 * Keep logs for specified days
 */
export async function cleanOldLogs(keepDays: number = 30): Promise<number> {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  
  // Archive old logs first (optional)
  // Then delete
  const { count } = await supabase
    .from('system_logs')
    .delete()
    .lt('timestamp', cutoff.toISOString());
  
  return count || 0;
}

/**
 * API Request Logger Middleware Helper
 */
export function createRequestLogger(service: LogService) {
  return async function logRequest(
    action: string,
    handler: () => Promise<Response>
  ): Promise<Response> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    
    try {
      const response = await handler();
      const duration = Date.now() - startTime;
      
      await logger.info(service, action, `${action} completed`, {
        requestId,
        duration,
        metadata: { status: response.status },
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await logger.error(
        service,
        action,
        `${action} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        { requestId, duration }
      );
      
      throw error;
    }
  };
}
