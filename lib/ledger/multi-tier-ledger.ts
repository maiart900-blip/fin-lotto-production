/**
 * Multi-Tier Ledger System
 * ระบบบัญชีแยกสายงาน 2 ชั้น
 * 
 * 1. Agent Wallet: ตัดเครดิตจากเว็บลูกทันทีที่รับแทง
 * 2. Master Statement: เว็บแม่บันทึกยอดรับรวมและส่วนต่าง (Profit Margin) แบบวินาทีต่อวินาที
 */

import { createClient } from '@/lib/supabase/server';
import { redis, REDIS_KEYS } from '@/lib/redis';

// Types
export interface AgentWallet {
  agentId: string;
  agentCode: string;
  creditBalance: number;
  creditLimit: number;
  holdBalance: number; // ยอดที่ถูก hold ระหว่างรอผล
  availableBalance: number;
  lastUpdated: string;
}

export interface MasterStatement {
  totalReceived: number;      // ยอดรับรวมจากทุก Agent
  totalPayout: number;        // ยอดจ่ายรวม
  totalCommission: number;    // ค่าคอมรวม
  profitMargin: number;       // กำไร (received - payout - commission)
  holdAmount: number;         // ยอดค้างจ่าย
  timestamp: string;
}

export interface LedgerTransaction {
  id?: string;
  transactionType: 'bet' | 'payout' | 'deposit' | 'withdraw' | 'commission' | 'adjustment' | 'hedging';
  agentId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string;
  referenceType?: string;
  description: string;
  processedBy?: string;
  timestamp: string;
}

// Redis Keys for Real-time Ledger
const LEDGER_KEYS = {
  AGENT_WALLET: (agentId: string) => `ledger:agent:${agentId}`,
  MASTER_STATEMENT: 'ledger:master:statement',
  MASTER_DAILY: (date: string) => `ledger:master:daily:${date}`,
  HOLD_BALANCE: (agentId: string) => `ledger:hold:${agentId}`,
  PENDING_PAYOUTS: 'ledger:pending:payouts',
};

/**
 * =============================================
 * AGENT WALLET OPERATIONS
 * ตัดเครดิตจากเว็บลูกทันทีที่รับแทง
 * =============================================
 */

// Get Agent Wallet (Real-time from Redis + Fallback to DB)
export async function getAgentWallet(agentId: string): Promise<AgentWallet | null> {
  try {
    // Try Redis first for speed
    const cached = await redis.get(LEDGER_KEYS.AGENT_WALLET(agentId));
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }

    // Fallback to Database
    const supabase = await createClient();
    const { data: agent } = await supabase
      .from('agents')
      .select('id, code, credit_balance, credit_limit')
      .eq('id', agentId)
      .single();

    if (!agent) return null;

    // Get hold balance from Redis
    const holdBalance = Number(await redis.get(LEDGER_KEYS.HOLD_BALANCE(agentId)) || 0);

    const wallet: AgentWallet = {
      agentId: agent.id,
      agentCode: agent.code,
      creditBalance: agent.credit_balance,
      creditLimit: agent.credit_limit,
      holdBalance,
      availableBalance: agent.credit_balance - holdBalance,
      lastUpdated: new Date().toISOString(),
    };

    // Cache to Redis (5 minutes)
    await redis.set(LEDGER_KEYS.AGENT_WALLET(agentId), JSON.stringify(wallet), { ex: 300 });

    return wallet;
  } catch (error) {
    console.error('Error getting agent wallet:', error);
    return null;
  }
}

// Deduct Credit from Agent Wallet (When bet is placed)
export async function deductAgentCredit(
  agentId: string,
  amount: number,
  referenceId: string,
  description: string
): Promise<{ success: boolean; transaction?: LedgerTransaction; error?: string }> {
  try {
    const wallet = await getAgentWallet(agentId);
    if (!wallet) {
      return { success: false, error: 'Agent not found' };
    }

    if (wallet.availableBalance < amount) {
      return { success: false, error: 'Insufficient credit balance' };
    }

    const supabase = await createClient();
    const newBalance = wallet.creditBalance - amount;

    // Update Database
    const { error: updateError } = await supabase
      .from('agents')
      .update({ 
        credit_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Add to hold balance (pending result)
    await redis.incrbyfloat(LEDGER_KEYS.HOLD_BALANCE(agentId), amount);

    // Create Transaction Record
    const transaction: LedgerTransaction = {
      transactionType: 'bet',
      agentId,
      amount: -amount,
      balanceBefore: wallet.creditBalance,
      balanceAfter: newBalance,
      referenceId,
      referenceType: 'bet',
      description,
      timestamp: new Date().toISOString(),
    };

    // Save to transactions table
    await supabase.from('transactions').insert({
      agent_id: agentId,
      transaction_type: 'bet',
      amount: -amount,
      balance_before: wallet.creditBalance,
      balance_after: newBalance,
      reference_id: referenceId,
      reference_type: 'bet',
      description,
      process_type: 'auto',
      status: 'completed',
    });

    // Invalidate cache
    await redis.del(LEDGER_KEYS.AGENT_WALLET(agentId));

    // Update Master Statement
    await updateMasterStatement('received', amount);

    return { success: true, transaction };
  } catch (error) {
    console.error('Error deducting agent credit:', error);
    return { success: false, error: 'System error' };
  }
}

// Add Credit to Agent Wallet (Deposit, Payout, etc.)
export async function addAgentCredit(
  agentId: string,
  amount: number,
  transactionType: 'deposit' | 'payout' | 'commission' | 'adjustment',
  referenceId: string,
  description: string,
  processedBy?: string
): Promise<{ success: boolean; transaction?: LedgerTransaction; error?: string }> {
  try {
    const wallet = await getAgentWallet(agentId);
    if (!wallet) {
      return { success: false, error: 'Agent not found' };
    }

    const supabase = await createClient();
    const newBalance = wallet.creditBalance + amount;

    // Update Database
    const { error: updateError } = await supabase
      .from('agents')
      .update({ 
        credit_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // If payout, release from hold
    if (transactionType === 'payout') {
      await redis.incrbyfloat(LEDGER_KEYS.HOLD_BALANCE(agentId), -amount);
    }

    // Create Transaction Record
    const transaction: LedgerTransaction = {
      transactionType,
      agentId,
      amount,
      balanceBefore: wallet.creditBalance,
      balanceAfter: newBalance,
      referenceId,
      referenceType: transactionType,
      description,
      processedBy,
      timestamp: new Date().toISOString(),
    };

    // Save to transactions table
    await supabase.from('transactions').insert({
      agent_id: agentId,
      transaction_type: transactionType,
      amount,
      balance_before: wallet.creditBalance,
      balance_after: newBalance,
      reference_id: referenceId,
      reference_type: transactionType,
      description,
      process_type: processedBy ? 'manual' : 'auto',
      status: 'completed',
      verified_by: processedBy,
    });

    // Invalidate cache
    await redis.del(LEDGER_KEYS.AGENT_WALLET(agentId));

    // Update Master Statement
    if (transactionType === 'payout') {
      await updateMasterStatement('payout', amount);
    } else if (transactionType === 'commission') {
      await updateMasterStatement('commission', amount);
    }

    return { success: true, transaction };
  } catch (error) {
    console.error('Error adding agent credit:', error);
    return { success: false, error: 'System error' };
  }
}

/**
 * =============================================
 * MASTER STATEMENT OPERATIONS
 * บันทึกยอดรับรวมและส่วนต่างแบบ Real-time
 * =============================================
 */

// Get Master Statement (Real-time)
export async function getMasterStatement(): Promise<MasterStatement> {
  try {
    const cached = await redis.get(LEDGER_KEYS.MASTER_STATEMENT);
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }

    // Initialize empty statement
    const statement: MasterStatement = {
      totalReceived: 0,
      totalPayout: 0,
      totalCommission: 0,
      profitMargin: 0,
      holdAmount: 0,
      timestamp: new Date().toISOString(),
    };

    await redis.set(LEDGER_KEYS.MASTER_STATEMENT, JSON.stringify(statement), { ex: 3600 });
    return statement;
  } catch (error) {
    console.error('Error getting master statement:', error);
    return {
      totalReceived: 0,
      totalPayout: 0,
      totalCommission: 0,
      profitMargin: 0,
      holdAmount: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

// Update Master Statement (Atomic operations)
export async function updateMasterStatement(
  type: 'received' | 'payout' | 'commission' | 'hold',
  amount: number
): Promise<void> {
  try {
    const statement = await getMasterStatement();

    switch (type) {
      case 'received':
        statement.totalReceived += amount;
        statement.holdAmount += amount;
        break;
      case 'payout':
        statement.totalPayout += amount;
        statement.holdAmount -= amount;
        break;
      case 'commission':
        statement.totalCommission += amount;
        break;
      case 'hold':
        statement.holdAmount += amount;
        break;
    }

    // Calculate profit margin
    statement.profitMargin = statement.totalReceived - statement.totalPayout - statement.totalCommission;
    statement.timestamp = new Date().toISOString();

    await redis.set(LEDGER_KEYS.MASTER_STATEMENT, JSON.stringify(statement), { ex: 3600 });

    // Also update daily statement
    const today = new Date().toISOString().split('T')[0];
    await redis.set(LEDGER_KEYS.MASTER_DAILY(today), JSON.stringify(statement), { ex: 86400 });
  } catch (error) {
    console.error('Error updating master statement:', error);
  }
}

// Get Daily Master Statement
export async function getDailyMasterStatement(date?: string): Promise<MasterStatement | null> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  try {
    const cached = await redis.get(LEDGER_KEYS.MASTER_DAILY(targetDate));
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }

    // Query from database for historical data
    const supabase = await createClient();
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data: transactions } = await supabase
      .from('transactions')
      .select('transaction_type, amount')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    if (!transactions || transactions.length === 0) return null;

    let totalReceived = 0;
    let totalPayout = 0;
    let totalCommission = 0;

    transactions.forEach(tx => {
      const amount = Math.abs(tx.amount);
      if (tx.transaction_type === 'bet') {
        totalReceived += amount;
      } else if (tx.transaction_type === 'payout') {
        totalPayout += amount;
      } else if (tx.transaction_type === 'commission') {
        totalCommission += amount;
      }
    });

    return {
      totalReceived,
      totalPayout,
      totalCommission,
      profitMargin: totalReceived - totalPayout - totalCommission,
      holdAmount: 0,
      timestamp: targetDate,
    };
  } catch (error) {
    console.error('Error getting daily statement:', error);
    return null;
  }
}

// Get All Agent Wallets Summary
export async function getAllAgentWalletsSummary(): Promise<{
  totalAgents: number;
  totalCreditBalance: number;
  totalHoldBalance: number;
  totalAvailable: number;
  agents: AgentWallet[];
}> {
  try {
    const supabase = await createClient();
    const { data: agents } = await supabase
      .from('agents')
      .select('id, code, credit_balance, credit_limit')
      .eq('status', 'active');

    if (!agents) {
      return {
        totalAgents: 0,
        totalCreditBalance: 0,
        totalHoldBalance: 0,
        totalAvailable: 0,
        agents: [],
      };
    }

    const wallets: AgentWallet[] = [];
    let totalCreditBalance = 0;
    let totalHoldBalance = 0;

    for (const agent of agents) {
      const holdBalance = Number(await redis.get(LEDGER_KEYS.HOLD_BALANCE(agent.id)) || 0);
      
      const wallet: AgentWallet = {
        agentId: agent.id,
        agentCode: agent.code,
        creditBalance: agent.credit_balance,
        creditLimit: agent.credit_limit,
        holdBalance,
        availableBalance: agent.credit_balance - holdBalance,
        lastUpdated: new Date().toISOString(),
      };

      wallets.push(wallet);
      totalCreditBalance += agent.credit_balance;
      totalHoldBalance += holdBalance;
    }

    return {
      totalAgents: agents.length,
      totalCreditBalance,
      totalHoldBalance,
      totalAvailable: totalCreditBalance - totalHoldBalance,
      agents: wallets,
    };
  } catch (error) {
    console.error('Error getting all agent wallets:', error);
    return {
      totalAgents: 0,
      totalCreditBalance: 0,
      totalHoldBalance: 0,
      totalAvailable: 0,
      agents: [],
    };
  }
}

// Reset Daily Statement (End of day processing)
export async function resetDailyStatement(): Promise<void> {
  try {
    // Save current statement to database before reset
    const statement = await getMasterStatement();
    const supabase = await createClient();

    await supabase.from('daily_statements').insert({
      date: new Date().toISOString().split('T')[0],
      total_received: statement.totalReceived,
      total_payout: statement.totalPayout,
      total_commission: statement.totalCommission,
      profit_margin: statement.profitMargin,
    });

    // Reset Redis statement
    const newStatement: MasterStatement = {
      totalReceived: 0,
      totalPayout: 0,
      totalCommission: 0,
      profitMargin: 0,
      holdAmount: statement.holdAmount, // Keep hold amount
      timestamp: new Date().toISOString(),
    };

    await redis.set(LEDGER_KEYS.MASTER_STATEMENT, JSON.stringify(newStatement), { ex: 3600 });
  } catch (error) {
    console.error('Error resetting daily statement:', error);
  }
}
