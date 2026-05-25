/**
 * Job Stats API
 * Get queue statistics and metrics
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getQueueStats, getRecentErrors, JOB_TYPES } from '@/lib/job-queue';

export async function GET() {
  // Require admin access
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  
  try {
    const [stats, recentErrors] = await Promise.all([
      getQueueStats(),
      getRecentErrors(5),
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        recentErrors: recentErrors.map(e => ({
          id: e.id,
          type: e.type,
          name: e.name,
          error: e.error_message,
          failedAt: e.failed_at,
          attempts: e.attempts,
        })),
        jobTypes: Object.values(JOB_TYPES),
      },
    });
  } catch (error) {
    console.error('[Jobs Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job stats' },
      { status: 500 }
    );
  }
}
