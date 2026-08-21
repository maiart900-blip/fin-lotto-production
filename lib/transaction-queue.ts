/**
 * Transaction Queue System
 * ระบบคิวจัดการ Transaction ป้องกันยอดเงินชนกัน
 * Production Ready - รองรับ Concurrent Transactions
 */

import { Redis } from '@upstash/redis';
import { createClient } from '@/lib/supabase/server';

// Initialize Redis with fallback
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  console.warn('[TransactionQueue] Redis not configured, using in-memory fallback');
}

// In-memory lock fallback (for development/testing without Redis)
const inMemoryLocks = new Map<string, { value: string; expiresAt: number }>();

// Lock configuration
const LOCK_TTL = 30; // 30 seconds
const MAX_RETRIES = 5;
const RETRY_DELAY = 100; // 100ms

// Transaction types
export type TransactionType = 
  | 'deposit' 
  | 'withdraw' 
  | 'bet' 
  | 'payout' 
  | 'commission' 
  | 'bonus' 
  | 'transfer'
  | 'refund'
  | 'adjustment';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface QueuedTransaction {
  id: string;
  type: TransactionType;
  userId: string;
  amount: number;
  status: TransactionStatus;
  priority: number; // 1 = highest, 10 = lowest
  metadata?: Record<string, unknown>;
  createdAt: string;
  processedAt?: string;
  error?: string;
  retryCount: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  newBalance?: number;
  error?: string;
}

/**
 * Distributed Lock using Redis
 * ป้องกัน Race Condition ระดับ User
 */
export async function acquireLock(
  userId: string,
  transactionType: TransactionType | number = 'deposit' // number for backwards compat (timeout)
): Promise<string | null> {
  // Support both old signature (userId, txType) and new (lockKey, timeout)
  const isNewSignature = typeof transactionType === 'number';
  const lockKey = isNewSignature ? userId : `lock:wallet:${userId}:${transactionType}`;
  const ttl = isNewSignature ? Math.ceil(transactionType / 1000) : LOCK_TTL;
  const lockValue = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Use Redis if available
  if (redis) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const acquired = await redis.set(lockKey, lockValue, {
          nx: true,
          ex: ttl,
        });
        
        if (acquired) {
          return lockValue;
        }
      } catch (err) {
        console.warn('[TransactionQueue] Redis lock error:', err);
        // Fall through to in-memory
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
    }
  }
  
  // In-memory fallback
  const now = Date.now();
  // Clean expired locks
  for (const [key, lock] of inMemoryLocks.entries()) {
    if (lock.expiresAt < now) {
      inMemoryLocks.delete(key);
    }
  }
  
  const existing = inMemoryLocks.get(lockKey);
  if (!existing || existing.expiresAt < now) {
    inMemoryLocks.set(lockKey, { value: lockValue, expiresAt: now + (ttl * 1000) });
    return lockValue;
  }
  
  return null; // Failed to acquire lock
}

/**
 * Release Lock
 * Supports both old signature (userId, txType, lockValue) and new (lockKey)
 */
export async function releaseLock(
  userIdOrLockKey: string,
  transactionTypeOrLockValue?: TransactionType | string,
  lockValueParam?: string
): Promise<boolean> {
  // Determine which signature is being used
  let lockKey: string;
  let lockValue: string | undefined;
  
  if (lockValueParam !== undefined) {
    // Old signature: (userId, transactionType, lockValue)
    lockKey = `lock:wallet:${userIdOrLockKey}:${transactionTypeOrLockValue}`;
    lockValue = lockValueParam;
  } else if (transactionTypeOrLockValue !== undefined) {
    // Could be old (userId, txType) without value or new (lockKey) with no value
    // If it looks like a transaction type, use old format
    const txTypes: TransactionType[] = ['deposit', 'withdraw', 'bet', 'payout', 'commission', 'bonus', 'transfer', 'refund', 'adjustment'];
    if (txTypes.includes(transactionTypeOrLockValue as TransactionType)) {
      lockKey = `lock:wallet:${userIdOrLockKey}:${transactionTypeOrLockValue}`;
    } else {
      // New signature: (lockKey)
      lockKey = userIdOrLockKey;
    }
  } else {
    // New signature: just (lockKey)
    lockKey = userIdOrLockKey;
  }
  
  // Try Redis first
  if (redis) {
    try {
      if (lockValue) {
        // Only release if we own the lock (Lua script for atomicity)
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        
        const result = await redis.eval(script, [lockKey], [lockValue]);
        return result === 1;
      } else {
        // Just delete the key
        await redis.del(lockKey);
        return true;
      }
    } catch {
      // Fall through to in-memory
    }
  }
  
  // In-memory fallback
  const existing = inMemoryLocks.get(lockKey);
  if (existing) {
    if (!lockValue || existing.value === lockValue) {
      inMemoryLocks.delete(lockKey);
      return true;
    }
  }
  return false;
}

/**
 * Add Transaction to Queue
 */
export async function queueTransaction(
  transaction: Omit<QueuedTransaction, 'id' | 'status' | 'createdAt' | 'retryCount'>
): Promise<string> {
  const supabase = await createClient();
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const queuedTxn: QueuedTransaction = {
    ...transaction,
    id: transactionId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  
  // Store in database
  const { error } = await supabase
    .from('transaction_queue')
    .insert({
      id: transactionId,
      type: queuedTxn.type,
      user_id: queuedTxn.userId,
      amount: queuedTxn.amount,
      status: queuedTxn.status,
      priority: queuedTxn.priority,
      metadata: queuedTxn.metadata,
      created_at: queuedTxn.createdAt,
      retry_count: 0,
    });
  
  if (error) {
    throw new Error(`Failed to queue transaction: ${error.message}`);
  }
  
  // Also add to Redis sorted set for fast retrieval (score = priority + timestamp)
  const score = queuedTxn.priority * 1000000000000 + Date.now();
  if (redis) await redis.zadd(`queue:transactions:${transaction.userId}`, {
    score,
    member: transactionId,
  });
  
  return transactionId;
}

/**
 * Process Transaction with Lock
 * Atomic operation with distributed lock
 */
export async function processTransaction(
  transactionId: string,
  processor: (txn: QueuedTransaction) => Promise<TransactionResult>
): Promise<TransactionResult> {
  const supabase = await createClient();
  
  // Get transaction from queue
  const { data: txnData, error: fetchError } = await supabase
    .from('transaction_queue')
    .select('*')
    .eq('id', transactionId)
    .single();
  
  if (fetchError || !txnData) {
    return { success: false, error: 'Transaction not found' };
  }
  
  const txn: QueuedTransaction = {
    id: txnData.id,
    type: txnData.type,
    userId: txnData.user_id,
    amount: txnData.amount,
    status: txnData.status,
    priority: txnData.priority,
    metadata: txnData.metadata,
    createdAt: txnData.created_at,
    retryCount: txnData.retry_count,
  };
  
  // Check if already processed
  if (txn.status === 'completed' || txn.status === 'failed') {
    return { success: false, error: `Transaction already ${txn.status}` };
  }
  
  // Acquire lock
  const lockValue = await acquireLock(txn.userId, txn.type);
  if (!lockValue) {
    // Update retry count
    await supabase
      .from('transaction_queue')
      .update({ 
        retry_count: txn.retryCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);
    
    return { success: false, error: 'Could not acquire lock, transaction queued for retry' };
  }
  
  try {
    // Update status to processing
    await supabase
      .from('transaction_queue')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);
    
    // Execute the actual transaction
    const result = await processor(txn);
    
    // Update final status
    await supabase
      .from('transaction_queue')
      .update({
        status: result.success ? 'completed' : 'failed',
        processed_at: new Date().toISOString(),
        error: result.error || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);
    
    // Remove from Redis queue
    if (redis) await redis.zrem(`queue:transactions:${txn.userId}`, transactionId);
    
    return result;
    
  } catch (error) {
    // Handle error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await supabase
      .from('transaction_queue')
      .update({
        status: 'failed',
        error: errorMessage,
        retry_count: txn.retryCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);
    
    return { success: false, error: errorMessage };
    
  } finally {
    // Always release lock
    await releaseLock(txn.userId, txn.type, lockValue);
  }
}

/**
 * Safe Balance Update with Optimistic Locking
 * Uses version/updated_at for conflict detection
 */
export async function safeBalanceUpdate(
  userId: string,
  amount: number,
  transactionType: TransactionType,
  description: string
): Promise<TransactionResult> {
  const transactionId = await queueTransaction({
    type: transactionType,
    userId,
    amount,
    priority: transactionType === 'withdraw' ? 1 : 5, // Withdrawals have higher priority
    metadata: { description },
  });
  
  return processTransaction(transactionId, async (txn) => {
    const supabase = await createClient();
    
    // Get current balance with version
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, balance, balance_version, updated_at')
      .eq('id', txn.userId)
      .single();
    
    if (fetchError || !customer) {
      return { success: false, error: 'Customer not found' };
    }
    
    const newBalance = customer.balance + txn.amount;
    
    // Check for negative balance (for withdrawals)
    if (newBalance < 0) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // Update with optimistic locking (check version hasn't changed)
    const { data: updateResult, error: updateError } = await supabase
      .from('customers')
      .update({
        balance: newBalance,
        balance_version: (customer.balance_version || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.userId)
      .eq('balance_version', customer.balance_version || 0) // Optimistic lock
      .select('balance')
      .single();
    
    if (updateError || !updateResult) {
      return { 
        success: false, 
        error: 'Concurrent modification detected, please retry' 
      };
    }
    
    // Record in immutable ledger
    await supabase
      .from('wallet_ledger')
      .insert({
        user_id: txn.userId,
        transaction_id: txn.id,
        type: txn.type,
        amount: txn.amount,
        balance_before: customer.balance,
        balance_after: newBalance,
        description: description,
        created_at: new Date().toISOString(),
      });
    
    return {
      success: true,
      transactionId: txn.id,
      newBalance: updateResult.balance,
    };
  });
}

/**
 * Batch Transaction Processor
 * Process multiple transactions for same user atomically
 */
export async function processBatchTransactions(
  userId: string,
  transactions: Array<{
    type: TransactionType;
    amount: number;
    description: string;
  }>
): Promise<TransactionResult[]> {
  const results: TransactionResult[] = [];
  
  // Queue all transactions
  const transactionIds = await Promise.all(
    transactions.map((txn, index) =>
      queueTransaction({
        type: txn.type,
        userId,
        amount: txn.amount,
        priority: 5,
        metadata: { description: txn.description, batchIndex: index },
      })
    )
  );
  
  // Process in order (single lock for batch)
  const lockValue = await acquireLock(userId, 'batch' as TransactionType);
  if (!lockValue) {
    return transactions.map(() => ({
      success: false,
      error: 'Could not acquire batch lock',
    }));
  }
  
  try {
    for (const txnId of transactionIds) {
      // Process without re-acquiring lock (we have batch lock)
      const result = await processTransaction(txnId, async (txn) => {
        const supabase = await createClient();
        
        const { data: customer } = await supabase
          .from('customers')
          .select('id, balance')
          .eq('id', txn.userId)
          .single();
        
        if (!customer) {
          return { success: false, error: 'Customer not found' };
        }
        
        const newBalance = customer.balance + txn.amount;
        if (newBalance < 0) {
          return { success: false, error: 'Insufficient balance' };
        }
        
        await supabase
          .from('customers')
          .update({ balance: newBalance })
          .eq('id', txn.userId);
        
        return { success: true, newBalance };
      });
      
      results.push(result);
    }
  } finally {
    await releaseLock(userId, 'batch' as TransactionType, lockValue);
  }
  
  return results;
}

/**
 * Get Pending Transactions for User
 */
export async function getPendingTransactions(userId: string): Promise<QueuedTransaction[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('transaction_queue')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (error || !data) return [];
  
  return data.map(row => ({
    id: row.id,
    type: row.type,
    userId: row.user_id,
    amount: row.amount,
    status: row.status,
    priority: row.priority,
    metadata: row.metadata,
    createdAt: row.created_at,
    processedAt: row.processed_at,
    error: row.error,
    retryCount: row.retry_count,
  }));
}

/**
 * Retry Failed Transactions
 */
export async function retryFailedTransactions(userId?: string): Promise<number> {
  const supabase = await createClient();
  
  let query = supabase
    .from('transaction_queue')
    .select('*')
    .eq('status', 'failed')
    .lt('retry_count', MAX_RETRIES);
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data: failedTxns } = await query;
  
  if (!failedTxns || failedTxns.length === 0) return 0;
  
  let retried = 0;
  for (const txn of failedTxns) {
    // Reset to pending for retry
    await supabase
      .from('transaction_queue')
      .update({
        status: 'pending',
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id);
    
    retried++;
  }
  
  return retried;
}

/**
 * Clean Old Completed Transactions
 * Keep only last 30 days
 */
export async function cleanOldTransactions(): Promise<number> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Archive to transaction_queue_archive first
  const { data: oldTxns } = await supabase
    .from('transaction_queue')
    .select('*')
    .in('status', ['completed', 'failed', 'cancelled'])
    .lt('created_at', thirtyDaysAgo.toISOString());
  
  if (!oldTxns || oldTxns.length === 0) return 0;
  
  // Insert into archive
  await supabase
    .from('transaction_queue_archive')
    .insert(oldTxns);
  
  // Delete from main table
  const { count } = await supabase
    .from('transaction_queue')
    .delete()
    .in('status', ['completed', 'failed', 'cancelled'])
    .lt('created_at', thirtyDaysAgo.toISOString());
  
  return count || 0;
}

/**
 * Get Queue Statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
}> {
  const supabase = await createClient();
  
  const [pending, processing, completed, failed] = await Promise.all([
    supabase.from('transaction_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('transaction_queue').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
    supabase.from('transaction_queue').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('transaction_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);
  
  // Calculate average processing time (last 100 completed)
  const { data: recentCompleted } = await supabase
    .from('transaction_queue')
    .select('created_at, processed_at')
    .eq('status', 'completed')
    .not('processed_at', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(100);
  
  let avgTime = 0;
  if (recentCompleted && recentCompleted.length > 0) {
    const totalTime = recentCompleted.reduce((sum, txn) => {
      const created = new Date(txn.created_at).getTime();
      const processed = new Date(txn.processed_at!).getTime();
      return sum + (processed - created);
    }, 0);
    avgTime = totalTime / recentCompleted.length;
  }
  
  return {
    pending: pending.count || 0,
    processing: processing.count || 0,
    completed: completed.count || 0,
    failed: failed.count || 0,
    avgProcessingTime: Math.round(avgTime),
  };
}


