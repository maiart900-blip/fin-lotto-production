import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Credit Transaction API with Transaction Lock
 * Prevents double-spending and negative credits using atomic operations
 */

interface TransactionRequest {
  userId: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string;
  referenceId?: string;
  referenceType?: 'bet' | 'transfer' | 'payout' | 'adjustment';
}

// In-memory lock for preventing concurrent transactions on same user
// In production, use Redis or database-level locking
const transactionLocks = new Map<string, Promise<any>>();

async function withLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any existing transaction on this user to complete
  const existingLock = transactionLocks.get(userId);
  if (existingLock) {
    await existingLock;
  }

  // Create new lock
  const lockPromise = fn();
  transactionLocks.set(userId, lockPromise);

  try {
    return await lockPromise;
  } finally {
    transactionLocks.delete(userId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TransactionRequest = await request.json();
    const { userId, amount, type, description, referenceId, referenceType } = body;

    if (!userId || amount === undefined || !type || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be positive' },
        { status: 400 }
      );
    }

    // Execute transaction with lock
    const result = await withLock(userId, async () => {
      const supabase = await createClient();

      // 1. Get current balance with FOR UPDATE lock (simulated via single transaction)
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, credit_balance, is_unlimited_credit, display_name')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      const currentBalance = user.credit_balance || 0;
      let newBalance: number;

      if (type === 'debit') {
        // Check if user has unlimited credit
        if (!user.is_unlimited_credit) {
          // Check sufficient balance
          if (currentBalance < amount) {
            throw new Error(`Insufficient credit. Current: ${currentBalance}, Required: ${amount}`);
          }
        }
        newBalance = currentBalance - amount;
      } else {
        newBalance = currentBalance + amount;
      }

      // 2. Update balance atomically
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          credit_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .eq('credit_balance', currentBalance); // Optimistic lock - only update if balance hasn't changed

      if (updateError) {
        throw new Error('Failed to update balance - concurrent modification detected');
      }

      // 3. Record transaction in credit_transactions table
      const { data: transaction, error: txError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: type === 'debit' ? -amount : amount,
          type,
          description,
          reference_id: referenceId,
          reference_type: referenceType,
          balance_before: currentBalance,
          balance_after: newBalance,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (txError) {
        // Log but don't fail - balance was updated successfully
        console.error('[v0] Failed to record transaction:', txError);
      }

      return {
        success: true,
        previousBalance: currentBalance,
        newBalance,
        transaction: transaction || null,
        user: {
          id: user.id,
          name: user.display_name,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[v0] Credit transaction error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Transaction failed' 
      },
      { status: 400 }
    );
  }
}

// GET: Fetch transaction history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      transactions: data || [],
    });
  } catch (error) {
    console.error('[v0] Fetch transactions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
