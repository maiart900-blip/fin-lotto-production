/**
 * Payout Queue API
 * Manages payout jobs and queue operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  addPayoutJob, 
  getQueueStats, 
  pauseQueue, 
  resumeQueue,
  cleanQueue,
  QUEUE_NAMES,
  PayoutJobData,
} from '@/lib/queue/bullmq-config';

// POST - Add payout job to queue
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { 
      action,
      lotteryId, 
      roundId, 
      resultNumbers,
      priority = 0,
    } = body;

    // Handle queue control actions
    if (action === 'pause') {
      await pauseQueue(QUEUE_NAMES.PAYOUT);
      await pauseQueue(QUEUE_NAMES.PAYOUT_BATCH);
      return NextResponse.json({ success: true, message: 'Queues paused' });
    }
    
    if (action === 'resume') {
      await resumeQueue(QUEUE_NAMES.PAYOUT);
      await resumeQueue(QUEUE_NAMES.PAYOUT_BATCH);
      return NextResponse.json({ success: true, message: 'Queues resumed' });
    }
    
    if (action === 'clean') {
      await cleanQueue(QUEUE_NAMES.PAYOUT);
      await cleanQueue(QUEUE_NAMES.PAYOUT_BATCH);
      return NextResponse.json({ success: true, message: 'Queues cleaned' });
    }

    // Validate required fields for new payout job
    if (!lotteryId || !roundId || !resultNumbers) {
      return NextResponse.json(
        { error: 'Missing required fields: lotteryId, roundId, resultNumbers' },
        { status: 400 }
      );
    }

    // Get current user for audit
    const { data: { user } } = await supabase.auth.getUser();

    // Create payout job data
    const jobData: PayoutJobData = {
      lotteryId,
      roundId,
      resultNumbers,
      processedBy: user?.id,
    };

    // Add job to queue
    const job = await addPayoutJob(jobData, priority);

    // Log to audit
    await supabase.from('audit_logs').insert({
      action: 'payout_job_created',
      entity_type: 'payout_queue',
      entity_id: job.id,
      user_id: user?.id,
      changes: {
        lotteryId,
        roundId,
        jobId: job.id,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Payout job added to queue',
    });

  } catch (error) {
    console.error('Failed to add payout job:', error);
    return NextResponse.json(
      { error: 'Failed to add payout job' },
      { status: 500 }
    );
  }
}

// GET - Get queue statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queueName = searchParams.get('queue') || QUEUE_NAMES.PAYOUT;

    // Get stats for both queues
    const [payoutStats, batchStats] = await Promise.all([
      getQueueStats(QUEUE_NAMES.PAYOUT),
      getQueueStats(QUEUE_NAMES.PAYOUT_BATCH),
    ]);

    // Get recent payout jobs from database
    const supabase = await createClient();
    const { data: recentJobs } = await supabase
      .from('payout_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      payoutQueue: payoutStats,
      batchQueue: batchStats,
      combined: {
        totalWaiting: payoutStats.waiting + batchStats.waiting,
        totalActive: payoutStats.active + batchStats.active,
        totalCompleted: payoutStats.completed + batchStats.completed,
        totalFailed: payoutStats.failed + batchStats.failed,
      },
      recentJobs: recentJobs || [],
    });

  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return NextResponse.json(
      { error: 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}
