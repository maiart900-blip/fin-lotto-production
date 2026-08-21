/**
 * Job Worker API
 * Processes pending jobs - designed to be called by cron or manually
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getNextJob, processJob, JOB_TYPES } from '@/lib/job-queue';
import { getHandler } from '@/lib/job-handlers';

// Allow running without auth for cron (when CRON_SECRET matches)
async function checkAuth(request: Request): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  // If CRON_SECRET is set and matches, allow
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return null;
  }

  // Otherwise require admin auth
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  return null;
}

export async function POST(request: Request) {
  // Check auth
  const authError = await checkAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const { type, maxJobs = 10 } = body as {
      type?: string;
      maxJobs?: number;
    };

    const results: Array<{
      jobId: string;
      type: string;
      success: boolean;
      error?: string;
    }> = [];

    let processed = 0;

    // Process up to maxJobs
    while (processed < maxJobs) {
      const job = await getNextJob(
        type as typeof JOB_TYPES[keyof typeof JOB_TYPES] | undefined
      );

      if (!job) {
        break;
      }

      // Get handler for this job type
      const handler = getHandler(job.type);

      if (!handler) {
        results.push({
          jobId: job.id,
          type: job.type,
          success: false,
          error: `No handler registered for job type: ${job.type}`,
        });
        processed++;
        continue;
      }

      // Process the job
      const result = await processJob(job, handler);

      results.push({
        jobId: job.id,
        type: job.type,
        success: result.success,
        error: result.error,
      });

      processed++;
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        results,
      },
    });
  } catch (error) {
    console.error('[Job Worker] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process jobs' },
      { status: 500 }
    );
  }
}

// GET endpoint for cron health check
export async function GET(request: Request) {
  const authError = await checkAuth(request);
  if (authError) return authError;

  return NextResponse.json({
    success: true,
    message: 'Job worker is ready',
    availableTypes: Object.values(JOB_TYPES),
  });
}