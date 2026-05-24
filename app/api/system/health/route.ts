/**
 * System Health Check API
 * Returns status of all integration components
 */

import { NextResponse } from 'next/server';
import { checkIntegrationHealth } from '@/lib/integration/data-flow-hub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const startTime = Date.now();
    const health = await checkIntegrationHealth();
    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: health.overall,
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      components: health.components,
      metrics: health.metrics,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: String(error),
    }, { status: 500 });
  }
}
