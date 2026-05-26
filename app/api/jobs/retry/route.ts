/**
 * Retry Job API
 * Retry failed or cancelled jobs
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { retryJob, getJob } from '@/lib/job-queue';
import { auditLogger } from '@/lib/audit-logger';

export async function POST(request: Request) {
  // Require admin access
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;
  
  try {
    const body = await request.json();
    const { jobId } = body;
    
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID required' },
        { status: 400 }
      );
    }
    
    // Get job details for audit
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Check if job can be retried
    if (!['failed', 'dead_letter', 'cancelled'].includes(job.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot retry job with status: ${job.status}` },
        { status: 400 }
      );
    }
    
    // Retry the job
    const success = await retryJob(jobId);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to retry job' },
        { status: 500 }
      );
    }
    
    // Audit log
    await auditLogger.logAdmin(user?.id || 'system', 'update', 'job', jobId, {
      action: 'retry',
      previousStatus: job.status,
      jobType: job.type,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Job queued for retry',
    });
  } catch (error) {
    console.error('[Jobs Retry API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retry job' },
      { status: 500 }
    );
  }
}
