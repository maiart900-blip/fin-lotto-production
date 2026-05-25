/**
 * Financial Ledger System
 * Production-grade double-entry accounting with immutable entries
 */

import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

// Types
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type TransactionType = 
  | 'deposit' | 'withdrawal' | 'payout' | 'refund' | 'settlement'
  | 'commission' | 'adjustment' | 'bonus' | 'rebate' | 'bet'
  | 'win' | 'transfer' | 'fee' | 'reversal';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'reversed' | 'cancelled';
export type EntryType = 'debit' | 'credit';

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  entity_type?: string;
  entity_id?: string;
  current_balance: number;
  pending_balance: number;
  available_balance: number;
}

export interface LedgerTransaction {
  id: string;
  transaction_number: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  amount: number;
  fee_amount: number;
  net_amount: number;
  currency: string;
  reference_type?: string;
  reference_id?: string;
  idempotency_key?: string;
  entity_type?: string;
  entity_id?: string;
  tenant_id?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  account_id: string;
  entry_type: EntryType;
  amount: number;
  balance_before: number;
  balance_after: number;
  sequence_number: number;
  description?: string;
  created_at: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  feeAmount?: number;
  currency?: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  entityType?: string;
  entityId?: string;
  tenantId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface JournalEntry {
  accountCode: string;
  accountId?: string;
  entryType: EntryType;
  amount: number;
  description?: string;
}

// Service client for ledger operations
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, serviceKey);
}

// Redis for distributed locking
function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

/**
 * Acquire a distributed lock for a transaction
 */
async function acquireLock(
  lockKey: string, 
  ttlSeconds: number = 30
): Promise<boolean> {
  const redis = getRedis();
  const lockValue = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  const acquired = await redis.set(lockKey, lockValue, {
    nx: true,
    ex: ttlSeconds,
  });
  
  return acquired === 'OK';
}

/**
 * Release a distributed lock
 */
async function releaseLock(lockKey: string): Promise<void> {
  const redis = getRedis();
  await redis.del(lockKey);
}

/**
 * Financial Ledger Class
 * Handles all double-entry accounting operations
 */
export class FinancialLedger {
  private supabase = getServiceClient();
  
  // Account cache
  private accountCache = new Map<string, LedgerAccount>();
  
  /**
   * Get account by code
   */
  async getAccountByCode(code: string): Promise<LedgerAccount | null> {
    // Check cache first
    if (this.accountCache.has(code)) {
      return this.accountCache.get(code)!;
    }
    
    const { data, error } = await this.supabase
      .from('ledger_accounts')
      .select('*')
      .eq('code', code)
      .single();
    
    if (error || !data) return null;
    
    this.accountCache.set(code, data);
    return data;
  }
  
  /**
   * Get or create account for an entity
   */
  async getOrCreateEntityAccount(
    entityType: string,
    entityId: string,
    accountType: AccountType = 'liability',
    name?: string
  ): Promise<LedgerAccount> {
    const code = `${entityType.toUpperCase()}-${entityId.slice(0, 8)}`;
    
    // Try to get existing account
    const { data: existing } = await this.supabase
      .from('ledger_accounts')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .single();
    
    if (existing) return existing;
    
    // Create new account
    const { data, error } = await this.supabase
      .from('ledger_accounts')
      .insert({
        code,
        name: name || `${entityType} Account - ${entityId.slice(0, 8)}`,
        account_type: accountType,
        entity_type: entityType,
        entity_id: entityId,
        is_system_account: false,
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create account: ${error.message}`);
    return data;
  }
  
  /**
   * Create a new transaction with journal entries
   * This is the core double-entry method
   */
  async createTransaction(
    input: TransactionInput,
    entries: JournalEntry[]
  ): Promise<LedgerTransaction> {
    // Validate entries balance (debits must equal credits)
    const totalDebits = entries
      .filter(e => e.entryType === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = entries
      .filter(e => e.entryType === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new Error(
        `Double-entry validation failed: Debits (${totalDebits}) must equal Credits (${totalCredits})`
      );
    }
    
    // Check idempotency
    if (input.idempotencyKey) {
      const { data: existing } = await this.supabase
        .from('ledger_transactions')
        .select('*')
        .eq('idempotency_key', input.idempotencyKey)
        .single();
      
      if (existing) {
        return existing;
      }
    }
    
    // Acquire lock for the transaction
    const lockKey = `ledger:txn:${input.idempotencyKey || Date.now()}`;
    const locked = await acquireLock(lockKey, 30);
    
    if (!locked) {
      throw new Error('Failed to acquire transaction lock - another transaction in progress');
    }
    
    try {
      // Generate transaction number
      const { data: txnNumber } = await this.supabase.rpc('generate_transaction_number');
      
      // Create transaction header
      const { data: transaction, error: txnError } = await this.supabase
        .from('ledger_transactions')
        .insert({
          transaction_number: txnNumber,
          transaction_type: input.type,
          status: 'processing',
          amount: input.amount,
          fee_amount: input.feeAmount || 0,
          currency: input.currency || 'THB',
          reference_type: input.referenceType,
          reference_id: input.referenceId,
          idempotency_key: input.idempotencyKey,
          entity_type: input.entityType,
          entity_id: input.entityId,
          tenant_id: input.tenantId,
          description: input.description,
          metadata: input.metadata || {},
          created_by: input.createdBy,
        })
        .select()
        .single();
      
      if (txnError) throw new Error(`Failed to create transaction: ${txnError.message}`);
      
      // Create journal entries
      for (const entry of entries) {
        await this.createJournalEntry(transaction.id, entry);
      }
      
      // Validate double-entry
      const { data: isValid } = await this.supabase.rpc('validate_double_entry', {
        txn_id: transaction.id,
      });
      
      if (!isValid) {
        // Rollback - mark as failed
        await this.supabase
          .from('ledger_transactions')
          .update({ status: 'failed', error_message: 'Double-entry validation failed' })
          .eq('id', transaction.id);
        
        throw new Error('Double-entry validation failed');
      }
      
      // Mark as completed
      const { data: completedTxn } = await this.supabase
        .from('ledger_transactions')
        .update({ 
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', transaction.id)
        .select()
        .single();
      
      return completedTxn;
    } finally {
      await releaseLock(lockKey);
    }
  }
  
  /**
   * Create a single journal entry
   */
  private async createJournalEntry(
    transactionId: string,
    entry: JournalEntry
  ): Promise<LedgerEntry> {
    // Get account
    let account: LedgerAccount | null;
    if (entry.accountId) {
      const { data } = await this.supabase
        .from('ledger_accounts')
        .select('*')
        .eq('id', entry.accountId)
        .single();
      account = data;
    } else {
      account = await this.getAccountByCode(entry.accountCode);
    }
    
    if (!account) {
      throw new Error(`Account not found: ${entry.accountCode || entry.accountId}`);
    }
    
    // Calculate new balance
    const balanceBefore = account.current_balance;
    let balanceAfter: number;
    
    // Assets & Expenses: Debits increase, Credits decrease
    // Liabilities, Equity & Revenue: Credits increase, Debits decrease
    if (account.account_type === 'asset' || account.account_type === 'expense') {
      balanceAfter = entry.entryType === 'debit'
        ? balanceBefore + entry.amount
        : balanceBefore - entry.amount;
    } else {
      balanceAfter = entry.entryType === 'credit'
        ? balanceBefore + entry.amount
        : balanceBefore - entry.amount;
    }
    
    // Get next sequence number
    const { data: seqResult } = await this.supabase.rpc('nextval', {
      seq_name: 'ledger_entry_seq',
    });
    const sequenceNumber = seqResult || Date.now();
    
    // Create entry
    const { data: ledgerEntry, error } = await this.supabase
      .from('ledger_entries')
      .insert({
        transaction_id: transactionId,
        account_id: account.id,
        entry_type: entry.entryType,
        amount: entry.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        sequence_number: sequenceNumber,
        description: entry.description,
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create entry: ${error.message}`);
    
    // Update account balance
    await this.supabase
      .from('ledger_accounts')
      .update({ 
        current_balance: balanceAfter,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id);
    
    // Clear cache
    this.accountCache.delete(account.code);
    
    return ledgerEntry;
  }
  
  /**
   * Get transaction by ID with entries
   */
  async getTransaction(transactionId: string): Promise<{
    transaction: LedgerTransaction;
    entries: LedgerEntry[];
  } | null> {
    const { data: transaction } = await this.supabase
      .from('ledger_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (!transaction) return null;
    
    const { data: entries } = await this.supabase
      .from('ledger_entries')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('sequence_number', { ascending: true });
    
    return {
      transaction,
      entries: entries || [],
    };
  }
  
  /**
   * Reverse a completed transaction
   */
  async reverseTransaction(
    transactionId: string,
    reason: string,
    reversedBy?: string
  ): Promise<LedgerTransaction> {
    // Get original transaction with entries
    const original = await this.getTransaction(transactionId);
    if (!original) throw new Error('Transaction not found');
    
    if (original.transaction.status !== 'completed') {
      throw new Error(`Cannot reverse transaction in status: ${original.transaction.status}`);
    }
    
    // Create reversal entries (swap debits and credits)
    const reversalEntries: JournalEntry[] = original.entries.map(entry => ({
      accountId: entry.account_id,
      accountCode: '',
      entryType: entry.entry_type === 'debit' ? 'credit' : 'debit',
      amount: entry.amount,
      description: `Reversal: ${reason}`,
    }));
    
    // Create reversal transaction
    const reversalTxn = await this.createTransaction(
      {
        type: 'reversal',
        amount: original.transaction.amount,
        referenceType: 'reversal',
        referenceId: transactionId,
        description: `Reversal of ${original.transaction.transaction_number}: ${reason}`,
        createdBy: reversedBy,
        metadata: {
          original_transaction_id: transactionId,
          original_transaction_number: original.transaction.transaction_number,
          reversal_reason: reason,
        },
      },
      reversalEntries
    );
    
    // Mark original as reversed
    await this.supabase
      .from('ledger_transactions')
      .update({ 
        status: 'reversed',
        reversed_at: new Date().toISOString(),
      })
      .eq('id', transactionId);
    
    return reversalTxn;
  }
  
  /**
   * Get account statement
   */
  async getAccountStatement(
    accountId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<{
    account: LedgerAccount;
    entries: LedgerEntry[];
    summary: {
      opening_balance: number;
      total_debits: number;
      total_credits: number;
      closing_balance: number;
    };
  }> {
    const { data: account } = await this.supabase
      .from('ledger_accounts')
      .select('*')
      .eq('id', accountId)
      .single();
    
    if (!account) throw new Error('Account not found');
    
    let query = this.supabase
      .from('ledger_entries')
      .select('*')
      .eq('account_id', accountId)
      .order('sequence_number', { ascending: true })
      .limit(limit);
    
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }
    
    const { data: entries } = await query;
    
    // Calculate summary
    const entriesList = entries || [];
    const openingBalance = entriesList[0]?.balance_before || 0;
    const closingBalance = entriesList[entriesList.length - 1]?.balance_after || account.current_balance;
    const totalDebits = entriesList
      .filter(e => e.entry_type === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = entriesList
      .filter(e => e.entry_type === 'credit')
      .reduce((sum, e) => sum + e.amount, 0);
    
    return {
      account,
      entries: entriesList,
      summary: {
        opening_balance: openingBalance,
        total_debits: totalDebits,
        total_credits: totalCredits,
        closing_balance: closingBalance,
      },
    };
  }
  
  /**
   * Reconcile all accounts
   */
  async reconcileAccounts(): Promise<{
    total_accounts: number;
    reconciled: number;
    variances: Array<{
      account_code: string;
      stored_balance: number;
      calculated_balance: number;
      variance: number;
    }>;
  }> {
    const { data: accounts } = await this.supabase
      .from('v_account_balances')
      .select('*');
    
    const accountsList = accounts || [];
    const variances = accountsList
      .filter(a => !a.is_reconciled)
      .map(a => ({
        account_code: a.code,
        stored_balance: a.stored_balance,
        calculated_balance: a.calculated_balance,
        variance: a.variance,
      }));
    
    return {
      total_accounts: accountsList.length,
      reconciled: accountsList.filter(a => a.is_reconciled).length,
      variances,
    };
  }
  
  /**
   * Create daily balance snapshot
   */
  async createDailySnapshot(date: Date = new Date()): Promise<number> {
    const snapshotDate = date.toISOString().slice(0, 10);
    
    const { data: accounts } = await this.supabase
      .from('ledger_accounts')
      .select('*')
      .eq('is_active', true);
    
    let created = 0;
    
    for (const account of accounts || []) {
      // Get previous snapshot
      const { data: prevSnapshot } = await this.supabase
        .from('balance_snapshots')
        .select('closing_balance')
        .eq('account_id', account.id)
        .lt('snapshot_date', snapshotDate)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();
      
      const openingBalance = prevSnapshot?.closing_balance || 0;
      
      // Get today's entries
      const { data: entries } = await this.supabase
        .from('ledger_entries')
        .select('entry_type, amount')
        .eq('account_id', account.id)
        .gte('created_at', `${snapshotDate}T00:00:00`)
        .lt('created_at', `${snapshotDate}T23:59:59`);
      
      const entriesList = entries || [];
      const totalDebits = entriesList
        .filter(e => e.entry_type === 'debit')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalCredits = entriesList
        .filter(e => e.entry_type === 'credit')
        .reduce((sum, e) => sum + e.amount, 0);
      
      // Insert snapshot
      const { error } = await this.supabase
        .from('balance_snapshots')
        .upsert({
          account_id: account.id,
          snapshot_date: snapshotDate,
          snapshot_type: 'daily',
          opening_balance: openingBalance,
          closing_balance: account.current_balance,
          total_debits: totalDebits,
          total_credits: totalCredits,
          debit_count: entriesList.filter(e => e.entry_type === 'debit').length,
          credit_count: entriesList.filter(e => e.entry_type === 'credit').length,
        }, {
          onConflict: 'account_id,snapshot_date,snapshot_type',
        });
      
      if (!error) created++;
    }
    
    return created;
  }
}

// Singleton instance
let ledgerInstance: FinancialLedger | null = null;

export function getFinancialLedger(): FinancialLedger {
  if (!ledgerInstance) {
    ledgerInstance = new FinancialLedger();
  }
  return ledgerInstance;
}

// Convenience functions for common transaction patterns

/**
 * Record a deposit transaction
 */
export async function recordDeposit(
  entityType: string,
  entityId: string,
  amount: number,
  options: {
    referenceId?: string;
    description?: string;
    createdBy?: string;
    idempotencyKey?: string;
  } = {}
): Promise<LedgerTransaction> {
  const ledger = getFinancialLedger();
  
  // Get or create entity account
  const entityAccount = await ledger.getOrCreateEntityAccount(
    entityType,
    entityId,
    entityType === 'agent' ? 'asset' : 'liability',
    `${entityType} Balance - ${entityId.slice(0, 8)}`
  );
  
  return ledger.createTransaction(
    {
      type: 'deposit',
      amount,
      entityType,
      entityId,
      referenceType: 'deposit',
      referenceId: options.referenceId,
      description: options.description || `Deposit for ${entityType} ${entityId.slice(0, 8)}`,
      createdBy: options.createdBy,
      idempotencyKey: options.idempotencyKey,
    },
    [
      // Debit: Cash increases (asset increases)
      { accountCode: 'CASH-OPERATING', entryType: 'debit', amount },
      // Credit: Customer/Agent liability increases
      { accountId: entityAccount.id, accountCode: '', entryType: 'credit', amount },
    ]
  );
}

/**
 * Record a withdrawal transaction
 */
export async function recordWithdrawal(
  entityType: string,
  entityId: string,
  amount: number,
  options: {
    referenceId?: string;
    description?: string;
    createdBy?: string;
    idempotencyKey?: string;
  } = {}
): Promise<LedgerTransaction> {
  const ledger = getFinancialLedger();
  
  // Get entity account
  const entityAccount = await ledger.getOrCreateEntityAccount(entityType, entityId);
  
  // Check balance
  if (entityAccount.available_balance < amount) {
    throw new Error(`Insufficient balance: ${entityAccount.available_balance} < ${amount}`);
  }
  
  return ledger.createTransaction(
    {
      type: 'withdrawal',
      amount,
      entityType,
      entityId,
      referenceType: 'withdrawal',
      referenceId: options.referenceId,
      description: options.description || `Withdrawal for ${entityType} ${entityId.slice(0, 8)}`,
      createdBy: options.createdBy,
      idempotencyKey: options.idempotencyKey,
    },
    [
      // Debit: Customer/Agent liability decreases
      { accountId: entityAccount.id, accountCode: '', entryType: 'debit', amount },
      // Credit: Cash decreases (asset decreases)
      { accountCode: 'CASH-OPERATING', entryType: 'credit', amount },
    ]
  );
}

/**
 * Record a payout (win) transaction
 */
export async function recordPayout(
  entityType: string,
  entityId: string,
  amount: number,
  options: {
    referenceId?: string;
    description?: string;
    createdBy?: string;
    idempotencyKey?: string;
  } = {}
): Promise<LedgerTransaction> {
  const ledger = getFinancialLedger();
  
  const entityAccount = await ledger.getOrCreateEntityAccount(entityType, entityId);
  
  return ledger.createTransaction(
    {
      type: 'payout',
      amount,
      entityType,
      entityId,
      referenceType: 'payout',
      referenceId: options.referenceId,
      description: options.description || `Payout for ${entityType} ${entityId.slice(0, 8)}`,
      createdBy: options.createdBy,
      idempotencyKey: options.idempotencyKey,
    },
    [
      // Debit: Payout expense increases
      { accountCode: 'EXP-PAYOUTS', entryType: 'debit', amount },
      // Credit: Customer/Agent balance increases
      { accountId: entityAccount.id, accountCode: '', entryType: 'credit', amount },
    ]
  );
}

/**
 * Record a bet transaction
 */
export async function recordBet(
  entityType: string,
  entityId: string,
  amount: number,
  options: {
    referenceId?: string;
    description?: string;
    createdBy?: string;
    idempotencyKey?: string;
  } = {}
): Promise<LedgerTransaction> {
  const ledger = getFinancialLedger();
  
  const entityAccount = await ledger.getOrCreateEntityAccount(entityType, entityId);
  
  // Check balance
  if (entityAccount.available_balance < amount) {
    throw new Error(`Insufficient balance: ${entityAccount.available_balance} < ${amount}`);
  }
  
  return ledger.createTransaction(
    {
      type: 'bet',
      amount,
      entityType,
      entityId,
      referenceType: 'bet',
      referenceId: options.referenceId,
      description: options.description || `Bet from ${entityType} ${entityId.slice(0, 8)}`,
      createdBy: options.createdBy,
      idempotencyKey: options.idempotencyKey,
    },
    [
      // Debit: Customer balance decreases
      { accountId: entityAccount.id, accountCode: '', entryType: 'debit', amount },
      // Credit: Betting revenue increases
      { accountCode: 'REV-BETTING', entryType: 'credit', amount },
    ]
  );
}

export default FinancialLedger;
