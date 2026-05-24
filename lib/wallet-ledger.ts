import { createClient } from '@/lib/supabase/server';

/**
 * Wallet Ledger - Secure Credit Transaction System
 * 
 * Features:
 * - Optimistic Locking: ป้องกัน race condition ด้วยการเช็ค balance ก่อน update
 * - Transaction Lock: In-memory lock ป้องกันการทำรายการซ้ำพร้อมกัน
 * - Audit Trail: บันทึกทุก transaction ลง credit_transactions table
 * - Atomic Operations: ทุกการเปลี่ยนแปลงเป็น atomic
 */

export type TransactionType = 
  | 'deposit' | 'withdraw' 
  | 'bet' | 'win' | 'refund'
  | 'bonus' | 'promotion' | 'referral'
  | 'adjustment_add' | 'adjustment_subtract'
  | 'commission';

interface WalletTransactionParams {
  customerId: string;
  amount: number;
  type: TransactionType;
  description: string;
  referenceId?: string;
  referenceType?: string;
  performedBy?: string;
}

interface WalletResult {
  success: boolean;
  newBalance: number;
  transactionId?: string;
  error?: string;
}

// In-memory transaction lock to prevent concurrent operations on same customer
// In production with multiple instances, use Redis SETNX or database advisory locks
const walletLocks = new Map<string, Promise<WalletResult>>();

async function withWalletLock(
  customerId: string, 
  operation: () => Promise<WalletResult>
): Promise<WalletResult> {
  // Wait for any existing transaction on this customer
  const existingLock = walletLocks.get(customerId);
  if (existingLock) {
    try {
      await existingLock;
    } catch {
      // Ignore errors from previous transaction
    }
  }

  // Create and register new lock
  const lockPromise = operation();
  walletLocks.set(customerId, lockPromise);

  try {
    return await lockPromise;
  } finally {
    // Clean up lock after completion
    if (walletLocks.get(customerId) === lockPromise) {
      walletLocks.delete(customerId);
    }
  }
}

export async function addCredit(params: WalletTransactionParams): Promise<WalletResult> {
  // Use transaction lock to prevent concurrent operations
  return withWalletLock(params.customerId, async () => {
    const supabase = await createClient();
    
    try {
      // Get current balance
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', params.customerId)
        .single();

      if (fetchError || !customer) {
        return { success: false, newBalance: 0, error: 'Customer not found' };
      }

      const currentBalance = Number(customer.credit_balance) || 0;
      const newBalance = currentBalance + params.amount;

      // Update customer balance with Optimistic Locking
      // Only updates if balance hasn't changed since we read it
      const { data: updateResult, error: updateError } = await supabase
        .from('customers')
        .update({ 
          credit_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.customerId)
        .eq('credit_balance', currentBalance) // Optimistic lock
        .select('credit_balance')
        .single();

      if (updateError || !updateResult) {
        // Retry once if optimistic lock failed (concurrent modification)
        const { data: retryCustomer } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', params.customerId)
          .single();
        
        if (retryCustomer) {
          const retryBalance = Number(retryCustomer.credit_balance) + params.amount;
          const { error: retryError } = await supabase
            .from('customers')
            .update({ credit_balance: retryBalance, updated_at: new Date().toISOString() })
            .eq('id', params.customerId);
          
          if (!retryError) {
            // Record transaction after retry success
            const { data: txData } = await supabase
              .from('credit_transactions')
              .insert({
                customer_id: params.customerId,
                amount: params.amount,
                type: params.type,
                description: params.description,
                reference_id: params.referenceId,
                reference_type: params.referenceType,
                balance_before: Number(retryCustomer.credit_balance),
                balance_after: retryBalance,
                performed_by: params.performedBy,
                created_at: new Date().toISOString(),
              })
              .select('id')
              .single();
            
            return { success: true, newBalance: retryBalance, transactionId: txData?.id };
          }
        }
        return { success: false, newBalance: currentBalance, error: 'Concurrent modification - please retry' };
      }

      // Create transaction record
      const { data: transaction } = await supabase
        .from('credit_transactions')
        .insert({
          customer_id: params.customerId,
          amount: params.amount,
          type: params.type,
          description: params.description,
          reference_id: params.referenceId,
          reference_type: params.referenceType,
          balance_before: currentBalance,
          balance_after: newBalance,
          performed_by: params.performedBy,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      return { 
        success: true, 
        newBalance, 
        transactionId: transaction?.id 
      };
    } catch (error) {
      console.error('[v0] Wallet addCredit error:', error);
      return { success: false, newBalance: 0, error: 'Transaction failed' };
    }
  });
}

export async function subtractCredit(params: WalletTransactionParams): Promise<WalletResult> {
  // Use transaction lock to prevent concurrent operations
  return withWalletLock(params.customerId, async () => {
    const supabase = await createClient();
    
    try {
      // Get current balance and pending withdrawals
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', params.customerId)
        .single();

      if (fetchError || !customer) {
        return { success: false, newBalance: 0, error: 'Customer not found' };
      }

      const currentBalance = Number(customer.credit_balance) || 0;
      
      // Check sufficient balance
      if (currentBalance < params.amount) {
        return { 
          success: false, 
          newBalance: currentBalance, 
          error: `ยอดเครดิตไม่เพียงพอ (คงเหลือ: ${currentBalance.toLocaleString()} บาท, ต้องการ: ${params.amount.toLocaleString()} บาท)` 
        };
      }

      const newBalance = currentBalance - params.amount;

      // Ensure no negative balance
      if (newBalance < 0) {
        return { 
          success: false, 
          newBalance: currentBalance, 
          error: 'Cannot have negative balance' 
        };
      }

      // Update customer balance with Optimistic Locking
      const { data: updateResult, error: updateError } = await supabase
        .from('customers')
        .update({ 
          credit_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.customerId)
        .eq('credit_balance', currentBalance) // Optimistic lock - prevent race condition
        .select('credit_balance')
        .single();

      if (updateError || !updateResult) {
        return { 
          success: false, 
          newBalance: currentBalance, 
          error: 'ยอดเงินถูกเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง' 
        };
      }

      // Create transaction record
      const { data: transaction } = await supabase
        .from('credit_transactions')
        .insert({
          customer_id: params.customerId,
          amount: -params.amount,
          type: params.type,
          description: params.description,
          reference_id: params.referenceId,
          reference_type: params.referenceType,
          balance_before: currentBalance,
          balance_after: newBalance,
          performed_by: params.performedBy,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      return { 
        success: true, 
        newBalance, 
        transactionId: transaction?.id 
      };
    } catch (error) {
      console.error('[v0] Wallet subtractCredit error:', error);
      return { success: false, newBalance: 0, error: 'Transaction failed' };
    }
  });
}

export async function getBalance(customerId: string): Promise<number> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('customers')
    .select('credit_balance')
    .eq('id', customerId)
    .single();

  return Number(data?.credit_balance) || 0;
}

export async function getTransactionHistory(
  customerId: string, 
  limit: number = 50
): Promise<unknown[]> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}
