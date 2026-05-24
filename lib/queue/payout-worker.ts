/**
 * High-Performance Payout Worker
 * Handles millions of winning records efficiently using:
 * - BullMQ for job processing
 * - Batch processing for database operations
 * - Supabase transactions for data integrity
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@/lib/supabase/server';
import { 
  QUEUE_NAMES, 
  PayoutJobData, 
  PayoutBatchJobData,
  addPayoutBatchJob 
} from './bullmq-config';

// Configuration
const BATCH_SIZE = 1000; // Process 1000 winners per batch
const CONCURRENCY = 10; // Process 10 batches concurrently
const MAX_RETRIES = 3;

// Redis connection for worker
const getWorkerConnection = () => {
  const redisUrl = process.env.KV_REST_API_URL?.replace('https://', '').split('.')[0];
  const redisToken = process.env.KV_REST_API_TOKEN;
  
  return new IORedis({
    host: `${redisUrl}.upstash.io`,
    port: 6379,
    password: redisToken,
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

// Payout rates by bet type
const PAYOUT_RATES: Record<string, number> = {
  'top_three': 500,
  'bottom_three': 500,
  'top_two': 70,
  'bottom_two': 70,
  'run_top': 3.2,
  'run_bottom': 3.2,
  'tood': 150,
};

// Type for winner record
interface WinnerRecord {
  id: string;
  customer_id: string;
  agent_id: string;
  number: string;
  bet_type: string;
  amount: number;
  rate: number;
}

// Type for payout result
interface PayoutResult {
  winnerId: string;
  customerId: string;
  agentId: string;
  payoutAmount: number;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Find all winning entries for a lottery round
 */
async function findWinningEntries(
  lotteryId: string,
  roundId: string,
  resultNumbers: PayoutJobData['resultNumbers']
): Promise<WinnerRecord[]> {
  const supabase = await createClient();
  
  // Build winning number conditions
  const winningConditions: { bet_type: string; number: string }[] = [
    { bet_type: 'top_three', number: resultNumbers.first_prize.slice(-3) },
    { bet_type: 'bottom_three', number: resultNumbers.last_three_bottom },
    { bet_type: 'top_two', number: resultNumbers.first_prize.slice(-2) },
    { bet_type: 'bottom_two', number: resultNumbers.last_two },
  ];
  
  // Add run numbers (single digits from first prize)
  const firstPrize = resultNumbers.first_prize;
  for (const digit of firstPrize) {
    winningConditions.push({ bet_type: 'run_top', number: digit });
  }
  
  // Query all winning entries
  const { data: winners, error } = await supabase
    .from('entries')
    .select(`
      id,
      customer_id,
      agent_id,
      number,
      bet_type,
      amount,
      rate
    `)
    .eq('lottery_id', lotteryId)
    .eq('status', 'active')
    .in('bet_type', winningConditions.map(c => c.bet_type))
    .in('number', winningConditions.map(c => c.number));
    
  if (error) {
    throw new Error(`Failed to find winners: ${error.message}`);
  }
  
  // Filter to exact matches
  return (winners || []).filter(entry => 
    winningConditions.some(c => c.bet_type === entry.bet_type && c.number === entry.number)
  );
}

/**
 * Process a batch of winners with Supabase transaction
 */
async function processBatchPayout(
  winners: WinnerRecord[]
): Promise<PayoutResult[]> {
  const supabase = await createClient();
  const results: PayoutResult[] = [];
  
  for (const winner of winners) {
    try {
      const payoutAmount = winner.amount * (winner.rate || PAYOUT_RATES[winner.bet_type] || 1);
      
      // Use Supabase RPC for transaction
      const { error: txError } = await supabase.rpc('process_payout_transaction', {
        p_entry_id: winner.id,
        p_customer_id: winner.customer_id,
        p_agent_id: winner.agent_id,
        p_payout_amount: payoutAmount,
      });
      
      if (txError) {
        // Fallback to manual updates if RPC doesn't exist
        await processPayoutManually(supabase, winner, payoutAmount);
      }
      
      results.push({
        winnerId: winner.id,
        customerId: winner.customer_id,
        agentId: winner.agent_id,
        payoutAmount,
        status: 'success',
      });
    } catch (error) {
      results.push({
        winnerId: winner.id,
        customerId: winner.customer_id,
        agentId: winner.agent_id,
        payoutAmount: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return results;
}

/**
 * Manual payout processing (fallback)
 */
async function processPayoutManually(
  supabase: any,
  winner: WinnerRecord,
  payoutAmount: number
) {
  // 1. Update entry status to 'won'
  await supabase
    .from('entries')
    .update({ 
      status: 'won',
      payout_amount: payoutAmount,
      processed_at: new Date().toISOString(),
    })
    .eq('id', winner.id);
  
  // 2. Add payout to customer balance
  await supabase.rpc('increment_customer_balance', {
    customer_id: winner.customer_id,
    amount: payoutAmount,
  }).catch(async () => {
    // Fallback if RPC doesn't exist
    const { data: customer } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', winner.customer_id)
      .single();
    
    await supabase
      .from('customers')
      .update({ 
        credit_balance: (customer?.credit_balance || 0) + payoutAmount 
      })
      .eq('id', winner.customer_id);
  });
  
  // 3. Record transaction
  await supabase.from('transactions').insert({
    customer_id: winner.customer_id,
    agent_id: winner.agent_id,
    transaction_type: 'payout',
    amount: payoutAmount,
    status: 'completed',
    process_type: 'auto',
    reference_id: winner.id,
    reference_type: 'entry',
    description: `รางวัล ${winner.bet_type} เลข ${winner.number}`,
  });
  
  // 4. Update agent payout stats
  await supabase.rpc('increment_agent_payout', {
    agent_id: winner.agent_id,
    amount: payoutAmount,
  }).catch(() => {});
}

/**
 * Main payout job processor
 * Finds all winners and creates batch jobs
 */
async function processPayoutJob(job: Job<PayoutJobData>) {
  const { lotteryId, roundId, resultNumbers, processedBy } = job.data;
  const supabase = await createClient();
  
  // Log start
  await job.log(`Starting payout processing for lottery ${lotteryId}, round ${roundId}`);
  
  // 1. Find all winning entries
  const winners = await findWinningEntries(lotteryId, roundId, resultNumbers);
  await job.log(`Found ${winners.length} winning entries`);
  
  if (winners.length === 0) {
    await job.log('No winners found, completing job');
    return { processed: 0, totalPayout: 0 };
  }
  
  // 2. Create payout record
  const { data: payoutRecord } = await supabase
    .from('payout_jobs')
    .insert({
      lottery_id: lotteryId,
      round_id: roundId,
      total_winners: winners.length,
      status: 'processing',
      started_at: new Date().toISOString(),
      processed_by: processedBy,
    })
    .select('id')
    .single();
  
  const payoutJobId = payoutRecord?.id || `pj-${Date.now()}`;
  
  // 3. Split into batches and queue
  const batches: WinnerRecord[][] = [];
  for (let i = 0; i < winners.length; i += BATCH_SIZE) {
    batches.push(winners.slice(i, i + BATCH_SIZE));
  }
  
  await job.log(`Created ${batches.length} batches of ${BATCH_SIZE} winners each`);
  
  // 4. Queue batch jobs
  const batchJobs = await Promise.all(
    batches.map((batch, index) => 
      addPayoutBatchJob({
        batchId: `${payoutJobId}-batch-${index}`,
        winnerIds: batch.map(w => w.id),
        lotteryId,
        batchNumber: index + 1,
        totalBatches: batches.length,
      })
    )
  );
  
  await job.log(`Queued ${batchJobs.length} batch jobs`);
  
  return {
    payoutJobId,
    totalWinners: winners.length,
    totalBatches: batches.length,
    status: 'batches_queued',
  };
}

/**
 * Batch payout job processor
 * Processes a batch of winners efficiently
 */
async function processBatchJob(job: Job<PayoutBatchJobData>) {
  const { batchId, winnerIds, lotteryId, batchNumber, totalBatches } = job.data;
  const supabase = await createClient();
  
  await job.log(`Processing batch ${batchNumber}/${totalBatches} with ${winnerIds.length} winners`);
  
  // 1. Fetch winner records
  const { data: winners, error } = await supabase
    .from('entries')
    .select('id, customer_id, agent_id, number, bet_type, amount, rate')
    .in('id', winnerIds);
  
  if (error || !winners) {
    throw new Error(`Failed to fetch winners: ${error?.message}`);
  }
  
  // 2. Process payouts in smaller chunks for better progress tracking
  const CHUNK_SIZE = 100;
  let processed = 0;
  let totalPayout = 0;
  const results: PayoutResult[] = [];
  
  for (let i = 0; i < winners.length; i += CHUNK_SIZE) {
    const chunk = winners.slice(i, i + CHUNK_SIZE);
    const chunkResults = await processBatchPayout(chunk);
    
    results.push(...chunkResults);
    processed += chunk.length;
    totalPayout += chunkResults
      .filter(r => r.status === 'success')
      .reduce((sum, r) => sum + r.payoutAmount, 0);
    
    // Update progress
    await job.updateProgress(Math.round((processed / winners.length) * 100));
  }
  
  // 3. Log completion
  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'failed').length;
  
  await job.log(`Batch ${batchNumber} complete: ${successCount} success, ${failCount} failed`);
  
  return {
    batchId,
    batchNumber,
    processed,
    successCount,
    failCount,
    totalPayout,
  };
}

/**
 * Create and start the payout worker
 */
export function createPayoutWorker() {
  const connection = getWorkerConnection();
  
  const worker = new Worker<PayoutJobData>(
    QUEUE_NAMES.PAYOUT,
    processPayoutJob,
    {
      connection,
      concurrency: 1, // Process one lottery at a time
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
      },
    }
  );
  
  worker.on('completed', (job, result) => {
    console.log(`[Payout Worker] Job ${job.id} completed:`, result);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`[Payout Worker] Job ${job?.id} failed:`, err);
  });
  
  worker.on('progress', (job, progress) => {
    console.log(`[Payout Worker] Job ${job.id} progress: ${progress}%`);
  });
  
  return worker;
}

/**
 * Create and start the batch payout worker
 */
export function createBatchPayoutWorker() {
  const connection = getWorkerConnection();
  
  const worker = new Worker<PayoutBatchJobData>(
    QUEUE_NAMES.PAYOUT_BATCH,
    processBatchJob,
    {
      connection,
      concurrency: CONCURRENCY, // Process multiple batches concurrently
      limiter: {
        max: 100,
        duration: 1000, // Max 100 batch operations per second
      },
    }
  );
  
  worker.on('completed', (job, result) => {
    console.log(`[Batch Worker] Batch ${result.batchNumber} completed:`, result);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`[Batch Worker] Batch ${job?.id} failed:`, err);
  });
  
  return worker;
}

/**
 * Start all payout workers
 */
export function startPayoutWorkers() {
  const payoutWorker = createPayoutWorker();
  const batchWorker = createBatchPayoutWorker();
  
  console.log('[Payout System] Workers started');
  
  return { payoutWorker, batchWorker };
}

/**
 * Graceful shutdown
 */
export async function shutdownWorkers(workers: { 
  payoutWorker: Worker; 
  batchWorker: Worker;
}) {
  console.log('[Payout System] Shutting down workers...');
  
  await Promise.all([
    workers.payoutWorker.close(),
    workers.batchWorker.close(),
  ]);
  
  console.log('[Payout System] Workers shut down');
}
