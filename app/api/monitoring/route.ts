/**
 * System Monitoring API
 * Provides real-time and historical metrics for the monitoring dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import { getApiMetrics, getHistoricalMetrics } from '@/lib/api-logger';
import { Redis } from '@upstash/redis';

// GET /api/monitoring - Get system metrics
export async function GET(request: NextRequest) {
  // Super admin only
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'realtime';
  const hours = parseInt(searchParams.get('hours') || '24');

  try {
    if (type === 'realtime') {
      // Get real-time metrics from Redis
      const metrics = await getApiMetrics();
      
      if (!metrics) {
        return NextResponse.json({
          success: true,
          data: {
            message: 'Metrics system initializing',
            total_requests: 0,
            error_rate: 0,
            avg_duration_ms: 0,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: metrics,
      });
    }

    if (type === 'historical') {
      // Get historical metrics from database
      const historical = await getHistoricalMetrics(hours);
      
      return NextResponse.json({
        success: true,
        data: historical,
      });
    }

    if (type === 'health') {
      // System health check
      const health = await checkSystemHealth();
      
      return NextResponse.json({
        success: true,
        data: health,
      });
    }

    return NextResponse.json(
      { error: 'Invalid type parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Monitoring] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

// Health check function
async function checkSystemHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{ name: string; status: string; latency_ms: number }>;
}> {
  const checks: Array<{ name: string; status: string; latency_ms: number }> = [];

  // Check Redis
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
    const start = Date.now();
    await redis.ping();
    checks.push({ name: 'Redis', status: 'ok', latency_ms: Date.now() - start });
  } catch {
    checks.push({ name: 'Redis', status: 'error', latency_ms: -1 });
  }

  // Check Supabase
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const start = Date.now();
    await supabase.from('users').select('id').limit(1);
    checks.push({ name: 'Database', status: 'ok', latency_ms: Date.now() - start });
  } catch {
    checks.push({ name: 'Database', status: 'error', latency_ms: -1 });
  }

  // Determine overall status
  const failedChecks = checks.filter((c) => c.status !== 'ok').length;
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (failedChecks > 0 && failedChecks < checks.length) {
    status = 'degraded';
  } else if (failedChecks === checks.length) {
    status = 'unhealthy';
  }

  return { status, checks };
}
