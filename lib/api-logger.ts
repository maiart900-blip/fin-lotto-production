/**
 * API Logger - Request/Response logging with performance metrics
 * Stores logs in PostgreSQL and real-time metrics in Redis
 */

import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Initialize clients
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

function getRedisClient() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Types
export interface ApiLogEntry {
  request_id: string;
  method: string;
  path: string;
  query_params?: Record<string, string>;
  status_code: number;
  duration_ms: number;
  response_size?: number;
  user_id?: string;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
  error_message?: string;
  error_stack?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiMetrics {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  requests_per_minute: number;
  error_rate: number;
  top_endpoints: Array<{ path: string; count: number; avg_ms: number }>;
  recent_errors: Array<{ path: string; status: number; message: string; time: string }>;
}

// Generate unique request ID
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

// Buffer for batch inserts
const logBuffer: ApiLogEntry[] = [];
let flushTimer: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const BUFFER_SIZE = 50;

// Flush logs to database
async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return;

  const entries = [...logBuffer];
  logBuffer.length = 0;

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from('api_logs').insert(entries);
    
    if (error) {
      console.error('[ApiLogger] Failed to flush logs:', error.message);
      // Re-add failed entries (with limit to prevent memory issues)
      if (logBuffer.length < 500) {
        logBuffer.push(...entries.slice(0, 100));
      }
    }
  } catch (err) {
    console.error('[ApiLogger] Flush error:', err);
  }
}

// Schedule flush
function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushLogs();
  }, FLUSH_INTERVAL);
}

// Update real-time metrics in Redis
async function updateMetrics(entry: ApiLogEntry): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = new Date().toISOString().slice(0, 10);

    // Pipeline for efficiency
    const pipeline = redis.pipeline();

    // Total counts
    pipeline.incr(`metrics:requests:total:${day}`);
    pipeline.expire(`metrics:requests:total:${day}`, 86400 * 7); // 7 days

    // Status-based counts
    if (entry.status_code >= 200 && entry.status_code < 400) {
      pipeline.incr(`metrics:requests:success:${day}`);
    } else if (entry.status_code >= 400) {
      pipeline.incr(`metrics:requests:error:${day}`);
      
      // Store recent errors
      const errorEntry = JSON.stringify({
        path: entry.path,
        status: entry.status_code,
        message: entry.error_message || 'Unknown error',
        time: new Date().toISOString(),
        request_id: entry.request_id,
      });
      pipeline.lpush(`metrics:errors:recent:${day}`, errorEntry);
      pipeline.ltrim(`metrics:errors:recent:${day}`, 0, 99); // Keep last 100
    }

    // Per-minute request count (for RPM calculation)
    pipeline.incr(`metrics:rpm:${minute}`);
    pipeline.expire(`metrics:rpm:${minute}`, 120); // 2 minutes

    // Duration tracking (for percentiles)
    pipeline.lpush(`metrics:durations:${hour}`, entry.duration_ms);
    pipeline.ltrim(`metrics:durations:${hour}`, 0, 999); // Keep last 1000
    pipeline.expire(`metrics:durations:${hour}`, 7200); // 2 hours

    // Per-endpoint stats
    const endpointKey = `metrics:endpoint:${day}:${entry.path}`;
    pipeline.hincrby(endpointKey, 'count', 1);
    pipeline.hincrby(endpointKey, 'total_ms', entry.duration_ms);
    pipeline.expire(endpointKey, 86400 * 2); // 2 days

    await pipeline.exec();
  } catch (err) {
    // Fail silently - metrics are non-critical
    console.error('[ApiLogger] Metrics update failed:', err);
  }
}

// Log API request
export async function logApiRequest(entry: ApiLogEntry): Promise<void> {
  // Add to buffer
  logBuffer.push(entry);

  // Flush if buffer is full
  if (logBuffer.length >= BUFFER_SIZE) {
    await flushLogs();
  } else {
    scheduleFlush();
  }

  // Update real-time metrics
  await updateMetrics(entry);
}

// Get current metrics
export async function getApiMetrics(): Promise<ApiMetrics | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = new Date().toISOString().slice(0, 10);

    // Fetch metrics
    const [
      totalRequests,
      successCount,
      errorCount,
      rpm1,
      rpm2,
      durations,
      recentErrors,
    ] = await Promise.all([
      redis.get<number>(`metrics:requests:total:${day}`),
      redis.get<number>(`metrics:requests:success:${day}`),
      redis.get<number>(`metrics:requests:error:${day}`),
      redis.get<number>(`metrics:rpm:${minute}`),
      redis.get<number>(`metrics:rpm:${minute - 1}`),
      redis.lrange<number>(`metrics:durations:${hour}`, 0, 999),
      redis.lrange<string>(`metrics:errors:recent:${day}`, 0, 9),
    ]);

    // Calculate percentiles
    const sortedDurations = (durations || []).sort((a, b) => a - b);
    const avgDuration = sortedDurations.length > 0
      ? sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length
      : 0;
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p95Duration = sortedDurations[p95Index] || 0;

    // Get top endpoints
    const endpointKeys = await redis.keys(`metrics:endpoint:${day}:*`);
    const topEndpoints: Array<{ path: string; count: number; avg_ms: number }> = [];

    for (const key of endpointKeys.slice(0, 20)) {
      const stats = await redis.hgetall<{ count: string; total_ms: string }>(key);
      if (stats) {
        const path = key.replace(`metrics:endpoint:${day}:`, '');
        const count = parseInt(stats.count || '0');
        const totalMs = parseInt(stats.total_ms || '0');
        topEndpoints.push({
          path,
          count,
          avg_ms: count > 0 ? Math.round(totalMs / count) : 0,
        });
      }
    }

    // Sort by count descending
    topEndpoints.sort((a, b) => b.count - a.count);

    // Parse recent errors
    const parsedErrors = (recentErrors || []).map((e) => {
      try {
        return typeof e === 'string' ? JSON.parse(e) : e;
      } catch {
        return { path: 'unknown', status: 500, message: 'Parse error', time: '' };
      }
    });

    const total = totalRequests || 0;
    const errors = errorCount || 0;

    return {
      total_requests: total,
      success_count: successCount || 0,
      error_count: errors,
      avg_duration_ms: Math.round(avgDuration),
      p95_duration_ms: p95Duration,
      requests_per_minute: (rpm1 || 0) + (rpm2 || 0),
      error_rate: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
      top_endpoints: topEndpoints.slice(0, 10),
      recent_errors: parsedErrors,
    };
  } catch (err) {
    console.error('[ApiLogger] Failed to get metrics:', err);
    return null;
  }
}

// Middleware helper to wrap API routes
export function withApiLogging<T>(
  handler: (req: NextRequest) => Promise<NextResponse<T>>
): (req: NextRequest) => Promise<NextResponse<T>> {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Extract user info from cookies
    const cookieStore = await cookies();
    const userId = cookieStore.get('admin_id')?.value;
    const userRole = cookieStore.get('admin_role')?.value;

    // Extract request info
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const queryParams = Object.fromEntries(url.searchParams);
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || undefined;

    let response: NextResponse<T>;
    let errorMessage: string | undefined;
    let errorStack: string | undefined;

    try {
      response = await handler(req);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorMessage = err.message;
      errorStack = err.stack;
      
      response = NextResponse.json(
        { error: 'Internal Server Error', request_id: requestId } as unknown as T,
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;

    // Log the request
    await logApiRequest({
      request_id: requestId,
      method,
      path,
      query_params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      status_code: response.status,
      duration_ms: duration,
      user_id: userId,
      user_role: userRole,
      ip_address: ipAddress,
      user_agent: userAgent,
      error_message: errorMessage,
      error_stack: errorStack,
    });

    // Add request ID to response headers
    response.headers.set('X-Request-ID', requestId);

    return response;
  };
}

// Get historical metrics from database
export async function getHistoricalMetrics(hours: number = 24): Promise<{
  hourly: Array<{ hour: string; requests: number; errors: number; avg_ms: number }>;
  slowest: Array<{ path: string; duration_ms: number; time: string }>;
  errorsByPath: Array<{ path: string; count: number }>;
}> {
  const supabase = getServiceClient();
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  // Get hourly aggregates
  const { data: hourlyData } = await supabase
    .from('api_logs')
    .select('created_at, status_code, duration_ms')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  // Aggregate by hour
  const hourlyMap = new Map<string, { requests: number; errors: number; total_ms: number }>();
  
  (hourlyData || []).forEach((log) => {
    const hour = new Date(log.created_at).toISOString().slice(0, 13);
    const existing = hourlyMap.get(hour) || { requests: 0, errors: 0, total_ms: 0 };
    existing.requests++;
    if (log.status_code >= 400) existing.errors++;
    existing.total_ms += log.duration_ms || 0;
    hourlyMap.set(hour, existing);
  });

  const hourly = Array.from(hourlyMap.entries()).map(([hour, stats]) => ({
    hour,
    requests: stats.requests,
    errors: stats.errors,
    avg_ms: stats.requests > 0 ? Math.round(stats.total_ms / stats.requests) : 0,
  }));

  // Get slowest requests
  const { data: slowestData } = await supabase
    .from('api_logs')
    .select('path, duration_ms, created_at')
    .gte('created_at', since)
    .order('duration_ms', { ascending: false })
    .limit(10);

  const slowest = (slowestData || []).map((log) => ({
    path: log.path,
    duration_ms: log.duration_ms,
    time: log.created_at,
  }));

  // Get errors by path
  const { data: errorData } = await supabase
    .from('api_logs')
    .select('path')
    .gte('created_at', since)
    .gte('status_code', 400);

  const errorMap = new Map<string, number>();
  (errorData || []).forEach((log) => {
    errorMap.set(log.path, (errorMap.get(log.path) || 0) + 1);
  });

  const errorsByPath = Array.from(errorMap.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { hourly, slowest, errorsByPath };
}
