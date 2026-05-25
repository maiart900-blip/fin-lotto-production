/**
 * Background Job Queue System
 * Serverless-compatible job processing using Upstash Redis + PostgreSQL
 * 
 * Features:
 * - Redis for fast job queuing and real-time metrics
 * - PostgreSQL for job persistence and history
 * - Retry with exponential backoff
 * - Dead-letter queue for failed jobs
 * - Priority-based processing
 * - Audit logging integration
 */

import { Redis } from '@upstash/redis';
import { createClient } from '@supabase/supabase-js';

// Job types
export const JOB_TYPES = {
  AUDIT_LOG_FLUSH: 'audit_log_flush',
  NOTIFICATION_SEND: 'notification_send',
  REPORT_GENERATE: 'report_generate',
  PAYOUT_PROCESS: 'payout_process',
  SETTLEMENT_PROCESS: 'settlement_process',
  BACKUP_CREATE: 'backup_create',
  CACHE_CLEANUP: 'cache_cleanup',
  EMAIL_SEND: 'email_send',
  SMS_SEND: 'sms_send',
  WEBHOOK_CALL: 'webhook_call',
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'dead_letter';

export interface Job<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  name?: string;
  payload: T;
  result?: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  priority: number;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  error_message?: string;
  error_stack?: string;
  created_by?: string;
  tenant_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JobResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export type JobHandler<T = Record<string, unknown>> = (job: Job<T>) => Promise<JobResult>;

// Redis keys
const REDIS_KEYS = {
  QUEUE: (type: string) => `jobs:queue:${type}`,
  RUNNING: 'jobs:running',
  STATS: (day: string) => `jobs:stats:${day}`,
  METRICS: 'jobs:metrics',
};

// Get Redis client
function getRedis(): Redis {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    throw new Error('Redis configuration missing');
  }
  
  return new Redis({ url, token });
}

// Get Supabase service client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(url, key);
}

/**
 * Enqueue a new job
 */
export async function enqueueJob<T extends Record<string, unknown>>(
  type: JobType,
  payload: T,
  options: {
    name?: string;
    priority?: number;
    maxAttempts?: number;
    scheduledAt?: Date;
    createdBy?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<string> {
  const supabase = getSupabase();
  const redis = getRedis();
  
  const {
    name,
    priority = 5,
    maxAttempts = 3,
    scheduledAt = new Date(),
    createdBy,
    tenantId,
    metadata = {},
  } = options;
  
  // Insert job into database
  const { data: job, error } = await supabase
    .from('background_jobs')
    .insert({
      type,
      name,
      payload,
      status: 'pending',
      attempts: 0,
      max_attempts: maxAttempts,
      priority,
      scheduled_at: scheduledAt.toISOString(),
      created_by: createdBy,
      tenant_id: tenantId,
      metadata,
    })
    .select('id')
    .single();
  
  if (error || !job) {
    throw new Error(`Failed to enqueue job: ${error?.message}`);
  }
  
  // Add to Redis queue for fast retrieval
  // Score = priority * 1e12 + timestamp (lower = higher priority)
  const score = priority * 1e12 + scheduledAt.getTime();
  await redis.zadd(REDIS_KEYS.QUEUE(type), { score, member: job.id });
  
  // Update metrics
  const today = new Date().toISOString().slice(0, 10);
  await redis.hincrby(REDIS_KEYS.STATS(today), 'enqueued', 1);
  await redis.hincrby(REDIS_KEYS.STATS(today), `type:${type}`, 1);
  
  return job.id;
}

/**
 * Get next job to process
 */
export async function getNextJob(type?: JobType): Promise<Job | null> {
  const supabase = getSupabase();
  const redis = getRedis();
  
  // Try to get from Redis queue first
  const queues = type ? [type] : Object.values(JOB_TYPES);
  
  for (const queueType of queues) {
    const jobIds = await redis.zrange(REDIS_KEYS.QUEUE(queueType), 0, 0);
    
    if (jobIds.length > 0) {
      const jobId = jobIds[0] as string;
      
      // Try to claim the job atomically
      const removed = await redis.zrem(REDIS_KEYS.QUEUE(queueType), jobId);
      
      if (removed > 0) {
        // Get job from database
        const { data: job } = await supabase
          .from('background_jobs')
          .select('*')
          .eq('id', jobId)
          .eq('status', 'pending')
          .single();
        
        if (job) {
          return mapDbJobToJob(job);
        }
      }
    }
  }
  
  // Fallback: Query database directly for any pending jobs not in Redis
  const { data: job } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single();
  
  return job ? mapDbJobToJob(job) : null;
}

/**
 * Process a job with retry logic
 */
export async function processJob<T extends Record<string, unknown>>(
  job: Job<T>,
  handler: JobHandler<T>
): Promise<JobResult> {
  const supabase = getSupabase();
  const redis = getRedis();
  const startTime = Date.now();
  
  try {
    // Mark job as running
    await supabase
      .from('background_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    
    // Add to running set
    await redis.sadd(REDIS_KEYS.RUNNING, job.id);
    
    // Execute handler
    const result = await handler(job);
    
    const duration = Date.now() - startTime;
    
    if (result.success) {
      // Mark as completed
      await supabase
        .from('background_jobs')
        .update({
          status: 'completed',
          result: result.data || {},
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      
      // Update metrics
      const today = new Date().toISOString().slice(0, 10);
      await redis.hincrby(REDIS_KEYS.STATS(today), 'completed', 1);
      await redis.hincrby(REDIS_KEYS.STATS(today), 'total_duration', duration);
    } else {
      // Handle failure
      await handleJobFailure(job, result.error || 'Unknown error');
    }
    
    // Remove from running set
    await redis.srem(REDIS_KEYS.RUNNING, job.id);
    
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await handleJobFailure(job, errorMessage, errorStack);
    await redis.srem(REDIS_KEYS.RUNNING, job.id);
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle job failure with retry logic
 */
async function handleJobFailure(
  job: Job,
  errorMessage: string,
  errorStack?: string
): Promise<void> {
  const supabase = getSupabase();
  const redis = getRedis();
  const today = new Date().toISOString().slice(0, 10);
  
  const newAttempts = job.attempts + 1;
  const shouldRetry = newAttempts < job.max_attempts;
  
  if (shouldRetry) {
    // Calculate exponential backoff delay
    const delayMs = Math.min(1000 * Math.pow(2, newAttempts), 300000); // Max 5 minutes
    const scheduledAt = new Date(Date.now() + delayMs);
    
    // Update job for retry
    await supabase
      .from('background_jobs')
      .update({
        status: 'pending',
        attempts: newAttempts,
        scheduled_at: scheduledAt.toISOString(),
        error_message: errorMessage,
        error_stack: errorStack,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    
    // Re-add to Redis queue with new schedule
    const score = job.priority * 1e12 + scheduledAt.getTime();
    await redis.zadd(REDIS_KEYS.QUEUE(job.type), { score, member: job.id });
    
    // Update retry metrics
    await redis.hincrby(REDIS_KEYS.STATS(today), 'retried', 1);
  } else {
    // Move to dead letter queue
    await supabase
      .from('background_jobs')
      .update({
        status: 'dead_letter',
        attempts: newAttempts,
        failed_at: new Date().toISOString(),
        error_message: errorMessage,
        error_stack: errorStack,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    
    // Update failed metrics
    await redis.hincrby(REDIS_KEYS.STATS(today), 'failed', 1);
    await redis.hincrby(REDIS_KEYS.STATS(today), 'dead_letter', 1);
  }
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<boolean> {
  const supabase = getSupabase();
  const redis = getRedis();
  
  const { data: job, error } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('id', jobId)
    .in('status', ['failed', 'dead_letter', 'cancelled'])
    .single();
  
  if (error || !job) {
    return false;
  }
  
  // Reset job for retry
  const scheduledAt = new Date();
  await supabase
    .from('background_jobs')
    .update({
      status: 'pending',
      attempts: 0,
      scheduled_at: scheduledAt.toISOString(),
      error_message: null,
      error_stack: null,
      failed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  
  // Add back to Redis queue
  const score = job.priority * 1e12 + scheduledAt.getTime();
  await redis.zadd(REDIS_KEYS.QUEUE(job.type), { score, member: jobId });
  
  return true;
}

/**
 * Cancel a pending job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const supabase = getSupabase();
  const redis = getRedis();
  
  const { data: job, error } = await supabase
    .from('background_jobs')
    .select('type, status')
    .eq('id', jobId)
    .single();
  
  if (error || !job || job.status !== 'pending') {
    return false;
  }
  
  // Update status
  await supabase
    .from('background_jobs')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  
  // Remove from Redis queue
  await redis.zrem(REDIS_KEYS.QUEUE(job.type), jobId);
  
  return true;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const supabase = getSupabase();
  
  const { data: job, error } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error || !job) {
    return null;
  }
  
  return mapDbJobToJob(job);
}

/**
 * Get jobs with filters
 */
export async function getJobs(filters: {
  type?: JobType;
  status?: JobStatus | JobStatus[];
  limit?: number;
  offset?: number;
} = {}): Promise<{ jobs: Job[]; total: number }> {
  const supabase = getSupabase();
  const { type, status, limit = 50, offset = 0 } = filters;
  
  let query = supabase
    .from('background_jobs')
    .select('*', { count: 'exact' });
  
  if (type) {
    query = query.eq('type', type);
  }
  
  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status);
    } else {
      query = query.eq('status', status);
    }
  }
  
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    throw new Error(`Failed to get jobs: ${error.message}`);
  }
  
  return {
    jobs: (data || []).map(mapDbJobToJob),
    total: count || 0,
  };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  running: number;
  completed: number;
  failed: number;
  deadLetter: number;
  todayStats: {
    enqueued: number;
    completed: number;
    failed: number;
    retried: number;
    avgDuration: number;
  };
  byType: Record<string, number>;
}> {
  const supabase = getSupabase();
  const redis = getRedis();
  const today = new Date().toISOString().slice(0, 10);
  
  // Get counts from database
  const [pending, running, completed, failed, deadLetter] = await Promise.all([
    supabase.from('background_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('background_jobs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('background_jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('background_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('background_jobs').select('id', { count: 'exact', head: true }).eq('status', 'dead_letter'),
  ]);
  
  // Get today's stats from Redis
  const stats = await redis.hgetall(REDIS_KEYS.STATS(today)) as Record<string, string> || {};
  
  const enqueuedToday = parseInt(stats['enqueued'] || '0', 10);
  const completedToday = parseInt(stats['completed'] || '0', 10);
  const failedToday = parseInt(stats['failed'] || '0', 10);
  const retriedToday = parseInt(stats['retried'] || '0', 10);
  const totalDuration = parseInt(stats['total_duration'] || '0', 10);
  
  // Get by type counts
  const byType: Record<string, number> = {};
  for (const jobType of Object.values(JOB_TYPES)) {
    byType[jobType] = parseInt(stats[`type:${jobType}`] || '0', 10);
  }
  
  return {
    pending: pending.count || 0,
    running: running.count || 0,
    completed: completed.count || 0,
    failed: failed.count || 0,
    deadLetter: deadLetter.count || 0,
    todayStats: {
      enqueued: enqueuedToday,
      completed: completedToday,
      failed: failedToday,
      retried: retriedToday,
      avgDuration: completedToday > 0 ? Math.round(totalDuration / completedToday) : 0,
    },
    byType,
  };
}

/**
 * Get recent errors
 */
export async function getRecentErrors(limit = 10): Promise<Job[]> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('background_jobs')
    .select('*')
    .in('status', ['failed', 'dead_letter'])
    .order('failed_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    throw new Error(`Failed to get errors: ${error.message}`);
  }
  
  return (data || []).map(mapDbJobToJob);
}

/**
 * Clean old completed jobs
 */
export async function cleanOldJobs(daysToKeep = 30): Promise<number> {
  const supabase = getSupabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const { count, error } = await supabase
    .from('background_jobs')
    .delete()
    .in('status', ['completed', 'cancelled'])
    .lt('completed_at', cutoffDate.toISOString());
  
  if (error) {
    throw new Error(`Failed to clean jobs: ${error.message}`);
  }
  
  return count || 0;
}

// Helper to map database row to Job interface
function mapDbJobToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    type: row.type as JobType,
    name: row.name as string | undefined,
    payload: row.payload as Record<string, unknown>,
    result: row.result as Record<string, unknown> | undefined,
    status: row.status as JobStatus,
    attempts: row.attempts as number,
    max_attempts: row.max_attempts as number,
    priority: row.priority as number,
    scheduled_at: row.scheduled_at as string,
    started_at: row.started_at as string | undefined,
    completed_at: row.completed_at as string | undefined,
    failed_at: row.failed_at as string | undefined,
    error_message: row.error_message as string | undefined,
    error_stack: row.error_stack as string | undefined,
    created_by: row.created_by as string | undefined,
    tenant_id: row.tenant_id as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
