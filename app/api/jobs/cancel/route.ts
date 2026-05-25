/**
 * Cancel Job API
 * Cancel pending jobs
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { cancelJob, getJob } from '@/lib/job-queue';
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
    
    // Check if job can be cancelled
    if (job.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot cancel job with status: ${job.status}. Only pending jobs can be cancelled.` },
        { status: 400 }
      );
    }
    
    // Cancel the job
    const success = await cancelJob(jobId);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to cancel job' },
        { status: 500 }
      );
    }
    
    // Audit log
    await auditLogger.logAdmin(user?.id || 'system', 'delete', 'job', jobId, {
      action: 'cancel',
      jobType: job.type,
      jobName: job.name,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    console.error('[Jobs Cancel API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
