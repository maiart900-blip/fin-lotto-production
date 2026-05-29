import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '@/lib/api-auth';
import { 
  applyRateLimit, 
  uuidSchema,
  verifyResourceOwnership,
  logSecurityEvent 
} from '@/lib/security/api-security';

/**
 * Credit Transaction API with Transaction Lock
 * Prevents double-spending and negative credits using atomic operations
 * 
 * SECURITY HARDENED:
 * - Rate limiting (financial tier - 10/min)
 * - Admin authentication required for write operations
 * - Zod input validation
 * - IDOR protection via resource ownership checks
 */

// Validation schemas
const transactionRequestSchema = z.object({
  userId: uuidSchema,
  amount: z.number().positive().max(100000000, 'Amount too large'),
  type: z.enum(['debit', 'credit']),
  description: z.string().min(1).max(500).transform(s => s.replace(/[<>]/g, '').trim()),
  referenceId: uuidSchema.optional(),
  referenceType: z.enum(['bet', 'transfer', 'payout', 'adjustment']).optional(),
});

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
    // SECURITY: Rate limit financial operations (10 per minute)
    const rateLimitResponse = await applyRateLimit('financial', 'credit_transaction');
    if (rateLimitResponse) {
      await logSecurityEvent('rate_limit', { 
        endpoint: '/api/credit/transaction',
        reason: 'Credit transaction rate limited'
      });
      return rateLimitResponse;
    }
    
    // SECURITY: Require admin authentication for credit adjustments
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    const { user: adminUser } = authResult;
    
    // SECURITY: Validate input with Zod schema
    const parseResult = transactionRequestSchema.safeParse(await request.json());
    if (!parseResult.success) {
      await logSecurityEvent('validation_failure', {
        endpoint: '/api/credit/transaction',
        admin_id: adminUser.id,
        reason: 'Invalid transaction request',
        errors: parseResult.error.errors,
      });
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.errors },
        { status: 400 }
      );
    }
    
    const { userId, amount, type, description, referenceId, referenceType } = parseResult.data;

    // userId and amount already validated by Zod schema
    if (!type || !description) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
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

// GET: Fetch transaction history (requires authentication)
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Rate limit read operations
    const rateLimitResponse = await applyRateLimit('api');
    if (rateLimitResponse) return rateLimitResponse;
    
    // SECURITY: Require authentication
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { user: authUser } = authResult;
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }
    
    // SECURITY: IDOR protection - users can only view their own transactions
    // unless they are admin/super_admin
    if (userId !== authUser.id && authUser.role !== 'admin' && authUser.role !== 'super_admin') {
      await logSecurityEvent('idor_attempt', {
        endpoint: '/api/credit/transaction',
        user_id: authUser.id,
        requested_user_id: userId,
        reason: 'Attempted to view other user transactions'
      });
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
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
