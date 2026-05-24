/**
 * BullMQ Configuration for High-Performance Payout Processing
 * Uses Upstash Redis for serverless compatibility
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection for BullMQ (uses Upstash Redis)
const getRedisConnection = () => {
  const redisUrl = process.env.KV_REST_API_URL?.replace('https://', '').split('.')[0];
  const redisToken = process.env.KV_REST_API_TOKEN;
  
  if (!redisUrl || !redisToken) {
    throw new Error('Redis credentials not configured');
  }
  
  // For BullMQ, we need ioredis connection
  // Upstash Redis URL format: https://xxx.upstash.io
  return new IORedis({
    host: `${redisUrl}.upstash.io`,
    port: 6379,
    password: redisToken,
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

// Queue names
export const QUEUE_NAMES = {
  PAYOUT: 'payout-queue',
  PAYOUT_BATCH: 'payout-batch-queue',
  SETTLEMENT: 'settlement-queue',
  NOTIFICATION: 'notification-queue',
} as const;

// Job types
export type PayoutJobData = {
  lotteryId: string;
  roundId: string;
  resultNumbers: {
    first_prize: string;
    last_two: string;
    last_three_top: string;
    last_three_bottom: string;
  };
  processedBy?: string;
};

export type PayoutBatchJobData = {
  batchId: string;
  winnerIds: string[];
  lotteryId: string;
  batchNumber: number;
  totalBatches: number;
};

export type SettlementJobData = {
  agentId: string;
  periodStart: string;
  periodEnd: string;
  type: 'daily' | 'weekly' | 'monthly';
};

// Queue options optimized for high throughput
const defaultQueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
};

// Create queues
let payoutQueue: Queue<PayoutJobData> | null = null;
let payoutBatchQueue: Queue<PayoutBatchJobData> | null = null;
let settlementQueue: Queue<SettlementJobData> | null = null;

export const getPayoutQueue = () => {
  if (!payoutQueue) {
    payoutQueue = new Queue<PayoutJobData>(QUEUE_NAMES.PAYOUT, {
      connection: getRedisConnection(),
      ...defaultQueueOptions,
    });
  }
  return payoutQueue;
};

export const getPayoutBatchQueue = () => {
  if (!payoutBatchQueue) {
    payoutBatchQueue = new Queue<PayoutBatchJobData>(QUEUE_NAMES.PAYOUT_BATCH, {
      connection: getRedisConnection(),
      ...defaultQueueOptions,
    });
  }
  return payoutBatchQueue;
};

export const getSettlementQueue = () => {
  if (!settlementQueue) {
    settlementQueue = new Queue<SettlementJobData>(QUEUE_NAMES.SETTLEMENT, {
      connection: getRedisConnection(),
      ...defaultQueueOptions,
    });
  }
  return settlementQueue;
};

// Queue events for monitoring
export const getQueueEvents = (queueName: string) => {
  return new QueueEvents(queueName, {
    connection: getRedisConnection(),
  });
};

// Add job to payout queue
export const addPayoutJob = async (data: PayoutJobData, priority = 0) => {
  const queue = getPayoutQueue();
  return queue.add('process-payout', data, {
    priority,
    jobId: `payout-${data.lotteryId}-${data.roundId}-${Date.now()}`,
  });
};

// Add batch job to payout batch queue
export const addPayoutBatchJob = async (data: PayoutBatchJobData, priority = 0) => {
  const queue = getPayoutBatchQueue();
  return queue.add('process-batch', data, {
    priority,
    jobId: `batch-${data.batchId}`,
  });
};

// Add settlement job
export const addSettlementJob = async (data: SettlementJobData) => {
  const queue = getSettlementQueue();
  return queue.add('process-settlement', data, {
    jobId: `settlement-${data.agentId}-${data.type}-${Date.now()}`,
  });
};

// Get queue stats
export const getQueueStats = async (queueName: string) => {
  const queue = new Queue(queueName, { connection: getRedisConnection() });
  
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
};

// Pause/Resume queue
export const pauseQueue = async (queueName: string) => {
  const queue = new Queue(queueName, { connection: getRedisConnection() });
  await queue.pause();
};

export const resumeQueue = async (queueName: string) => {
  const queue = new Queue(queueName, { connection: getRedisConnection() });
  await queue.resume();
};

// Clean queue
export const cleanQueue = async (queueName: string, grace: number = 0) => {
  const queue = new Queue(queueName, { connection: getRedisConnection() });
  await queue.clean(grace, 1000, 'completed');
  await queue.clean(grace, 1000, 'failed');
};
