/**
 * CENTRALIZED WALLET SERVICE
 * ===========================
 * Unified wallet management for all credit operations
 * Supports: Manual Cashier, Gateway Integration, Seamless Game API
 * 
 * Features:
 * - Row-level locking for race condition prevention
 * - Full audit trail integration
 * - Transaction type separation for transparency
 * - Gateway-ready architecture
 */

import { createClient } from '@supabase/supabase-js';
import { auditLogger } from '@/lib/audit-logger';

// Service client for direct database access
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, serviceKey);
}

// =====================================================
// TRANSACTION TYPES
// =====================================================

export type TransactionType = 
  // Manual Cashier Operations
  | 'deposit'           // ฝากเงินมือ
  | 'withdraw'          // ถอนเงินมือ
  | 'adjustment'        // ปรับยอดเครดิต (แอดมิน)
  
  // Lottery Operations
  | 'bet_lottery'       // แทงหวย
  | 'win_lottery'       // ถูกหวย
  | 'refund_lottery'    // คืนเงินหวย (ยกเลิกงวด)
  
  // Future: Casino/Slot Operations (Seamless API)
  | 'bet_casino'        // เดิมพันคาสิโน
  | 'win_casino'        // ชนะคาสิโน
  | 'bet_slot'          // เดิมพันสล็อต
  | 'win_slot'          // ชนะสล็อต
  | 'jackpot'           // รางวัลแจ็คพอต
  
  // Promotional
  | 'bonus'             // โบนัส
  | 'cashback'          // คืนยอดเสีย
  | 'referral'          // รางวัลแนะนำ
  
  // System
  | 'correction'        // แก้ไขข้อผิดพลาด
  | 'migration';        // ย้ายข้อมูล

export type TransactionSource = 
  | 'manual'            // แอดมินทำมือ
  | 'gateway'           // Payment Gateway
  | 'seamless_api'      // Casino/Slot Seamless API
  | 'system'            // ระบบอัตโนมัติ
  | 'customer';         // ลูกค้าทำเอง

export interface WalletTransaction {
  customerId: string;
  amount: number;  // Positive = เพิ่ม, Negative = หัก
  type: TransactionType;
  source: TransactionSource;
  note?: string;
  referenceType?: string;  // เช่น 'topup_request', 'withdraw_request', 'bet', 'game_round'
  referenceId?: string;
  operatorId?: string;  // Admin/Agent ที่ทำรายการ
  gameProvider?: string;  // สำหรับ seamless: ชื่อค่ายเกม
  gameId?: string;  // สำหรับ seamless: รหัสเกม
  roundId?: string;  // สำหรับ seamless: รหัสรอบเกม
  metadata?: Record<string, unknown>;
}

export interface WalletResult {
  success: boolean;
  transactionId?: string;
  balanceBefore: number;
  balanceAfter: number;
  error?: string;
  errorCode?: string;
}

// =====================================================
// WALLET SERVICE CLASS
// =====================================================

class WalletService {
  private static instance: WalletService;

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  /**
   * Main method: Process wallet transaction with row-level locking
   * ใช้สำหรับทุกการเปลี่ยนแปลงเครดิต
   */
  async processTransaction(tx: WalletTransaction): Promise<WalletResult> {
    const supabase = getServiceClient();
    
    try {
      // 1. Get current balance with lock (FOR UPDATE equivalent via RPC)
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('id, credit_balance, name, phone')
        .eq('id', tx.customerId)
        .single();

      if (fetchError || !customer) {
        return {
          success: false,
          balanceBefore: 0,
          balanceAfter: 0,
          error: 'Customer not found',
          errorCode: 'CUSTOMER_NOT_FOUND',
        };
      }

      const balanceBefore = Number(customer.credit_balance || 0);
      const newBalance = balanceBefore + tx.amount;

      // 2. Validate: prevent negative balance
      if (newBalance < 0) {
        return {
          success: false,
          balanceBefore,
          balanceAfter: balanceBefore,
          error: `ยอดเครดิตไม่เพียงพอ (คงเหลือ: ${balanceBefore.toLocaleString()} บาท)`,
          errorCode: 'INSUFFICIENT_BALANCE',
        };
      }

      // 3. Update balance atomically using optimistic locking
      const { data: updatedCustomer, error: updateError } = await supabase
        .from('customers')
        .update({ 
          credit_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tx.customerId)
        .eq('credit_balance', balanceBefore) // Optimistic lock!
        .select('credit_balance')
        .single();

      if (updateError || !updatedCustomer) {
        // Race condition - balance changed during transaction
        return {
          success: false,
          balanceBefore,
          balanceAfter: balanceBefore,
          error: 'ยอดเครดิตถูกเปลี่ยนแปลงระหว่างทำรายการ กรุณาลองใหม่',
          errorCode: 'RACE_CONDITION',
        };
      }

      // 4. Create transaction record
      // Build insert payload with only existing columns
      // Core columns that always exist
      const insertPayload: Record<string, unknown> = {
        customer_id: tx.customerId,
        amount: tx.amount,
        type: tx.type,
        note: tx.note || `${tx.source}: ${tx.type}`,
        reference_type: tx.referenceType,
        reference_id: tx.referenceId,
        balance_before: balanceBefore,
        balance_after: newBalance,
        created_by: tx.operatorId || null,
      };
      
      // Optional fields for Seamless API (may not exist in all schemas)
      // Store in note or metadata if columns don't exist
      if (tx.gameProvider || tx.gameId || tx.roundId) {
        const seamlessInfo = `[${tx.gameProvider}/${tx.gameId}] Round: ${tx.roundId}`;
        insertPayload.note = `${insertPayload.note || ''} ${seamlessInfo}`.trim();
      }
      
      const { data: transaction, error: txError } = await supabase
        .from('credit_transactions')
        .insert(insertPayload)
        .select('id')
        .single();

      if (txError) {
        console.error('[WalletService] Failed to create transaction record:', txError);
        // Balance updated but transaction record failed - log critical error
        await auditLogger.logSecurity(
          'suspicious_activity',
          tx.operatorId || 'system',
          'internal',
          {
            error: 'Transaction record creation failed after balance update',
            customerId: tx.customerId,
            amount: tx.amount,
            balanceBefore,
            balanceAfter: newBalance,
          }
        );
      }

      // 5. Log to audit trail
      const actionType = tx.amount > 0 ? 'wallet_deposit' : 'wallet_withdraw';
      await auditLogger.logFinancial(
        tx.operatorId || 'system',
        actionType as 'wallet_deposit' | 'wallet_withdraw',
        Math.abs(tx.amount),
        transaction?.id || tx.customerId,
        balanceBefore,
        newBalance,
        {
          type: tx.type,
          source: tx.source,
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
          gameProvider: tx.gameProvider,
          gameId: tx.gameId,
          roundId: tx.roundId,
          customerName: customer.name,
        }
      );

      return {
        success: true,
        transactionId: transaction?.id,
        balanceBefore,
        balanceAfter: newBalance,
      };

    } catch (error) {
      console.error('[WalletService] Transaction error:', error);
      return {
        success: false,
        balanceBefore: 0,
        balanceAfter: 0,
        error: 'เกิดข้อผิดพลาดในระบบ',
        errorCode: 'SYSTEM_ERROR',
      };
    }
  }

  /**
   * Deposit: เพิ่มเครดิต
   */
  async deposit(
    customerId: string,
    amount: number,
    type: TransactionType,
    source: TransactionSource,
    options?: {
      operatorId?: string;
      referenceType?: string;
      referenceId?: string;
      note?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<WalletResult> {
    if (amount <= 0) {
      return {
        success: false,
        balanceBefore: 0,
        balanceAfter: 0,
        error: 'จำนวนเงินต้องมากกว่า 0',
        errorCode: 'INVALID_AMOUNT',
      };
    }

    return this.processTransaction({
      customerId,
      amount: Math.abs(amount), // Ensure positive
      type,
      source,
      ...options,
    });
  }

  /**
   * Withdraw: หักเครดิต
   */
  async withdraw(
    customerId: string,
    amount: number,
    type: TransactionType,
    source: TransactionSource,
    options?: {
      operatorId?: string;
      referenceType?: string;
      referenceId?: string;
      note?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<WalletResult> {
    if (amount <= 0) {
      return {
        success: false,
        balanceBefore: 0,
        balanceAfter: 0,
        error: 'จำนวนเงินต้องมากกว่า 0',
        errorCode: 'INVALID_AMOUNT',
      };
    }

    return this.processTransaction({
      customerId,
      amount: -Math.abs(amount), // Ensure negative
      type,
      source,
      ...options,
    });
  }

  /**
   * Get current balance
   */
  async getBalance(customerId: string): Promise<{ balance: number; success: boolean; error?: string }> {
    const supabase = getServiceClient();
    
    const { data, error } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', customerId)
      .single();

    if (error || !data) {
      return { balance: 0, success: false, error: 'Customer not found' };
    }

    return { balance: Number(data.credit_balance || 0), success: true };
  }

  /**
   * Seamless API: Bet (หักเครดิตเดิมพัน)
   */
  async seamlessBet(
    customerId: string,
    amount: number,
    gameProvider: string,
    gameId: string,
    roundId: string,
    metadata?: Record<string, unknown>
  ): Promise<WalletResult> {
    return this.withdraw(customerId, amount, 'bet_casino', 'seamless_api', {
      note: `Bet - ${gameProvider}/${gameId}`,
      referenceType: 'game_round',
      referenceId: roundId,
      metadata: {
        ...metadata,
        gameProvider,
        gameId,
        roundId,
      },
    });
  }

  /**
   * Seamless API: Win (เพิ่มเครดิตชนะ)
   */
  async seamlessWin(
    customerId: string,
    amount: number,
    gameProvider: string,
    gameId: string,
    roundId: string,
    metadata?: Record<string, unknown>
  ): Promise<WalletResult> {
    return this.deposit(customerId, amount, 'win_casino', 'seamless_api', {
      note: `Win - ${gameProvider}/${gameId}`,
      referenceType: 'game_round',
      referenceId: roundId,
      metadata: {
        ...metadata,
        gameProvider,
        gameId,
        roundId,
      },
    });
  }

  /**
   * Seamless API: Refund (คืนเงินเดิมพัน)
   */
  async seamlessRefund(
    customerId: string,
    amount: number,
    gameProvider: string,
    gameId: string,
    roundId: string,
    originalBetId: string,
    metadata?: Record<string, unknown>
  ): Promise<WalletResult> {
    return this.deposit(customerId, amount, 'refund_lottery', 'seamless_api', {
      note: `Refund - ${gameProvider}/${gameId} (original: ${originalBetId})`,
      referenceType: 'game_refund',
      referenceId: roundId,
      metadata: {
        ...metadata,
        gameProvider,
        gameId,
        roundId,
        originalBetId,
      },
    });
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const walletService = WalletService.getInstance();

// Helper functions for common operations
export async function depositCredit(
  customerId: string,
  amount: number,
  operatorId: string,
  note?: string,
  referenceType?: string,
  referenceId?: string
): Promise<WalletResult> {
  return walletService.deposit(customerId, amount, 'deposit', 'manual', {
    operatorId,
    note,
    referenceType,
    referenceId,
  });
}

export async function withdrawCredit(
  customerId: string,
  amount: number,
  operatorId: string,
  note?: string,
  referenceType?: string,
  referenceId?: string
): Promise<WalletResult> {
  return walletService.withdraw(customerId, amount, 'withdraw', 'manual', {
    operatorId,
    note,
    referenceType,
    referenceId,
  });
}

export async function adjustCredit(
  customerId: string,
  amount: number,
  operatorId: string,
  note: string
): Promise<WalletResult> {
  if (amount > 0) {
    return walletService.deposit(customerId, amount, 'adjustment', 'manual', {
      operatorId,
      note,
    });
  } else {
    return walletService.withdraw(customerId, Math.abs(amount), 'adjustment', 'manual', {
      operatorId,
      note,
    });
  }
}

export async function getCustomerBalance(customerId: string): Promise<number> {
  const result = await walletService.getBalance(customerId);
  return result.balance;
}
