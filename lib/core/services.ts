/**
 * Base Service Class
 * Provides common patterns for all domain services
 */

import { createClient } from '@/lib/supabase/server';
import { createLogger, Logger } from './logger';
import { Result, ok, err, AppError, appError, ErrorCodes, tryCatchAsync } from './result';

export interface ServiceContext {
  userId?: string;
  tenantId?: string;
  requestId?: string;
}

export abstract class BaseService {
  protected logger: Logger;
  protected context: ServiceContext;

  constructor(serviceName: string, context: ServiceContext = {}) {
    this.logger = createLogger(serviceName);
    this.context = context;
  }

  protected async getSupabase() {
    return createClient();
  }

  protected logContext(): Record<string, unknown> {
    return {
      userId: this.context.userId,
      tenantId: this.context.tenantId,
      requestId: this.context.requestId,
    };
  }

  // Wrap database operations with consistent error handling
  protected async dbOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<Result<T, AppError>> {
    const endTimer = this.logger.time(operation);
    
    const result = await tryCatchAsync(fn);
    endTimer();

    if (!result.success) {
      this.logger.error(`Database operation failed: ${operation}`, result.error, this.logContext());
      return err(appError(
        ErrorCodes.DATABASE_ERROR,
        `Database operation failed: ${operation}`,
        { originalError: result.error.message }
      ));
    }

    return ok(result.data);
  }

  // Check if user has permission for operation
  protected async checkPermission(
    permission: string
  ): Promise<Result<void, AppError>> {
    // For now, return ok - integrate with RBAC system
    // In production, this would check user_permissions table
    return ok(undefined);
  }
}

/**
 * Customer Service
 * Handles all customer-related operations
 */
export class CustomerService extends BaseService {
  constructor(context: ServiceContext = {}) {
    super('CustomerService', context);
  }

  async getCustomer(customerId: string): Promise<Result<Customer, AppError>> {
    return this.dbOperation('getCustomer', async () => {
      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Customer not found');
      return data as Customer;
    });
  }

  async getCustomerByUsername(
    tenantId: string,
    username: string
  ): Promise<Result<Customer | null, AppError>> {
    return this.dbOperation('getCustomerByUsername', async () => {
      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('username', username)
        .maybeSingle();

      if (error) throw error;
      return data as Customer | null;
    });
  }

  async updateBalance(
    customerId: string,
    amount: number,
    operation: 'add' | 'subtract'
  ): Promise<Result<number, AppError>> {
    return this.dbOperation('updateBalance', async () => {
      const supabase = await this.getSupabase();
      
      // Get current balance
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', customerId)
        .single();

      if (fetchError) throw fetchError;
      if (!customer) throw new Error('Customer not found');

      const currentBalance = customer.credit_balance || 0;
      const newBalance = operation === 'add' 
        ? currentBalance + amount 
        : currentBalance - amount;

      if (newBalance < 0) {
        throw new Error('Insufficient balance');
      }

      // Update balance
      const { error: updateError } = await supabase
        .from('customers')
        .update({ credit_balance: newBalance })
        .eq('id', customerId);

      if (updateError) throw updateError;
      return newBalance;
    });
  }

  async listCustomers(
    tenantId: string,
    options: { page?: number; limit?: number; search?: string } = {}
  ): Promise<Result<{ data: Customer[]; total: number }, AppError>> {
    const { page = 1, limit = 20, search } = options;
    const offset = (page - 1) * limit;

    return this.dbOperation('listCustomers', async () => {
      const supabase = await this.getSupabase();
      
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { data: data as Customer[], total: count || 0 };
    });
  }
}

/**
 * Finance Service
 * Handles all financial operations
 */
export class FinanceService extends BaseService {
  constructor(context: ServiceContext = {}) {
    super('FinanceService', context);
  }

  async createDeposit(
    deposit: Omit<TopupRequest, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Result<TopupRequest, AppError>> {
    return this.dbOperation('createDeposit', async () => {
      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('topup_requests')
        .insert(deposit)
        .select()
        .single();

      if (error) throw error;
      return data as TopupRequest;
    });
  }

  async approveDeposit(
    depositId: string,
    approvedBy: string
  ): Promise<Result<void, AppError>> {
    return this.dbOperation('approveDeposit', async () => {
      const supabase = await this.getSupabase();
      
      // Get deposit details
      const { data: deposit, error: fetchError } = await supabase
        .from('topup_requests')
        .select('*')
        .eq('id', depositId)
        .single();

      if (fetchError) throw fetchError;
      if (!deposit) throw new Error('Deposit not found');
      if (deposit.status !== 'pending') throw new Error('Deposit already processed');

      // Update deposit status
      const { error: updateError } = await supabase
        .from('topup_requests')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
        })
        .eq('id', depositId);

      if (updateError) throw updateError;

      // Update customer balance
      const customerService = new CustomerService(this.context);
      const balanceResult = await customerService.updateBalance(
        deposit.customer_id,
        deposit.amount,
        'add'
      );

      if (!balanceResult.success) {
        throw new Error(balanceResult.error.message);
      }
    });
  }

  async createWithdrawal(
    withdrawal: Omit<WithdrawRequest, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Result<WithdrawRequest, AppError>> {
    return this.dbOperation('createWithdrawal', async () => {
      const supabase = await this.getSupabase();
      
      // Check customer balance first
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', withdrawal.customer_id)
        .single();

      if (fetchError) throw fetchError;
      if (!customer) throw new Error('Customer not found');
      if ((customer.credit_balance || 0) < withdrawal.amount) {
        throw new Error('Insufficient balance');
      }

      // Create withdrawal request
      const { data, error } = await supabase
        .from('withdraw_requests')
        .insert(withdrawal)
        .select()
        .single();

      if (error) throw error;
      return data as WithdrawRequest;
    });
  }
}

/**
 * Betting Service  
 * Handles lottery betting operations
 */
export class BettingService extends BaseService {
  constructor(context: ServiceContext = {}) {
    super('BettingService', context);
  }

  async placeBet(
    entry: Omit<LotteryEntry, 'id' | 'created_at'>
  ): Promise<Result<LotteryEntry, AppError>> {
    return this.dbOperation('placeBet', async () => {
      const supabase = await this.getSupabase();
      
      // Check customer balance
      const customerService = new CustomerService(this.context);
      const balanceResult = await customerService.updateBalance(
        entry.customer_id,
        entry.amount,
        'subtract'
      );

      if (!balanceResult.success) {
        throw new Error(balanceResult.error.message);
      }

      // Create entry
      const { data, error } = await supabase
        .from('entries')
        .insert(entry)
        .select()
        .single();

      if (error) {
        // Rollback balance on error
        await customerService.updateBalance(entry.customer_id, entry.amount, 'add');
        throw error;
      }

      return data as LotteryEntry;
    });
  }

  async getCustomerEntries(
    customerId: string,
    options: { status?: string; limit?: number } = {}
  ): Promise<Result<LotteryEntry[], AppError>> {
    return this.dbOperation('getCustomerEntries', async () => {
      const supabase = await this.getSupabase();
      
      let query = supabase
        .from('entries')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (options.status) {
        query = query.eq('status', options.status);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LotteryEntry[];
    });
  }
}

// Type definitions
interface Customer {
  id: string;
  tenant_id: string;
  username: string;
  full_name?: string;
  phone?: string;
  credit_balance: number;
  created_at: string;
  [key: string]: unknown;
}

interface TopupRequest {
  id: string;
  customer_id: string;
  tenant_id: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface WithdrawRequest {
  id: string;
  customer_id: string;
  tenant_id: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface LotteryEntry {
  id: string;
  customer_id: string;
  tenant_id: string;
  amount: number;
  status: string;
  created_at: string;
  [key: string]: unknown;
}

// Service factory
export function createServices(context: ServiceContext = {}) {
  return {
    customer: new CustomerService(context),
    finance: new FinanceService(context),
    betting: new BettingService(context),
  };
}
