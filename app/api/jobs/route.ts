/**
 * Jobs API
 * Admin endpoints for managing background jobs
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import {
  getJobs,
  getJob,
  getQueueStats,
  getRecentErrors,
  enqueueJob,
  JOB_TYPES,
  JobType,
  JobStatus,
} from '@/lib/job-queue';
import { auditLogger } from '@/lib/audit-logger';

export async function GET(request: Request) {
  // Require admin access
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as
      | 'list'
      | 'stats'
      | 'errors'
      | 'detail'
      | null;

    switch (type) {
      case 'stats': {
        const stats = await getQueueStats();
        return NextResponse.json({ success: true, data: stats });
      }

      case 'errors': {
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const errors = await getRecentErrors(limit);
        return NextResponse.json({ success: true, data: errors });
      }

      case 'detail': {
        const jobId = searchParams.get('id');
        if (!jobId) {
          return NextResponse.json(
            { success: false, error: 'Job ID required' },
            { status: 400 }
          );
        }

        const job = await getJob(jobId);
        if (!job) {
          return NextResponse.json(
            { success: false, error: 'Job not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: job });
      }

      case 'list':
      default: {
        const jobType = searchParams.get('jobType') as JobType | null;
        const status = searchParams.get('status') as JobStatus | null;
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        const { jobs, total } = await getJobs({
          type: jobType || undefined,
          status: status || undefined,
          limit,
          offset,
        });

        return NextResponse.json({
          success: true,
          data: jobs,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + jobs.length < total,
          },
        });
      }
    }
  } catch (error) {
    console.error('[Jobs API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Require admin access
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  try {
    const body = await request.json();
    const { type, payload, name, priority, maxAttempts, scheduledAt } = body;

    // Validate job type
    if (!type || !Object.values(JOB_TYPES).includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid job type. Valid types: ${Object.values(JOB_TYPES).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Enqueue the job
    const jobId = await enqueueJob(type, payload || {}, {
      name,
      priority: priority || 5,
      maxAttempts: maxAttempts || 3,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      createdBy: user?.id,
    });

    // Audit log
    await auditLogger.logAdmin(
      user?.id || 'system',
      'create',
      'job',
      jobId,
      'Create background job',
      {
        jobType: type,
        jobName: name,
        priority,
      }
    );

    return NextResponse.json({
      success: true,
      data: { jobId },
      message: 'Job enqueued successfully',
    });
  } catch (error) {
    console.error('[Jobs API] Error creating job:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}