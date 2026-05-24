import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET() {
  const start = Date.now();
  
  try {
    // Test Redis connection
    await redis.ping();
    
    const responseTime = Date.now() - start;
    
    return NextResponse.json({
      status: 'healthy',
      service: 'redis',
      responseTime,
      message: 'Redis connection successful',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const responseTime = Date.now() - start;
    
    return NextResponse.json({
      status: 'unhealthy',
      service: 'redis',
      responseTime,
      message: error instanceof Error ? error.message : 'Redis connection failed',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
