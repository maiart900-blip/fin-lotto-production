import { NextResponse } from 'next/server';
import { checkSystemHealth } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await checkSystemHealth();
    
    const statusCode = health.status === 'healthy' ? 200 
      : health.status === 'degraded' ? 200 
      : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    }, { status: 503 });
  }
}
