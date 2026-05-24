/**
 * FIN LOTTO R+ Universal API Core
 * ================================
 * API ศูนย์กลางสำหรับเว็บลูกทุกเว็บเรียกใช้ Data เดียวกัน
 * รองรับ 100,000+ concurrent users
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: number;
    requestId: string;
    siteId: string;
    processingTime: number;
  };
}

export interface TenantContext {
  siteId: string;
  apiKey: string;
  permissions: string[];
  rateLimit: {
    requests: number;
    window: number; // seconds
  };
}

export interface BetRequest {
  userId: string;
  lotteryId: string;
  betType: 'top3' | 'bottom2' | 'top2' | 'run_top' | 'run_bottom' | 'tood';
  numbers: string;
  amount: number;
  customerName?: string; // For manual agents
}

export interface WalletOperation {
  userId: string;
  type: 'deposit' | 'withdraw' | 'bet' | 'payout' | 'commission' | 'credit_adjust';
  amount: number;
  reference?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// UNIVERSAL API CORE CLASS
// =============================================================================

export class UniversalAPICore {
  private supabase;
  private requestCount = new Map<string, { count: number; resetAt: number }>();
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ===========================================================================
  // AUTHENTICATION & AUTHORIZATION
  // ===========================================================================

  async validateTenant(apiKey: string): Promise<TenantContext | null> {
    const { data: site, error } = await this.supabase
      .from('sites')
      .select('*')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single();

    if (error || !site) return null;

    return {
      siteId: site.id,
      apiKey: site.api_key,
      permissions: site.permissions || ['read', 'write'],
      rateLimit: {
        requests: site.rate_limit || 1000,
        window: 60,
      },
    };
  }

  async checkRateLimit(tenant: TenantContext): Promise<boolean> {
    const key = `rate:${tenant.siteId}`;
    const now = Date.now();
    const record = this.requestCount.get(key);

    if (!record || now > record.resetAt) {
      this.requestCount.set(key, { count: 1, resetAt: now + tenant.rateLimit.window * 1000 });
      return true;
    }

    if (record.count >= tenant.rateLimit.requests) {
      return false;
    }

    record.count++;
    return true;
  }

  // ===========================================================================
  // LOTTERY OPERATIONS
  // ===========================================================================

  async getLotteries(tenant: TenantContext): Promise<APIResponse> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await this.supabase
        .from('lotteries')
        .select('*')
        .eq('is_active', true)
        .order('close_time', { ascending: true });

      if (error) throw error;

      return this.success(data, tenant, startTime);
    } catch (err) {
      return this.error('LOTTERY_FETCH_FAILED', 'ไม่สามารถดึงข้อมูลหวยได้', tenant, startTime);
    }
  }

  async getLotteryRates(tenant: TenantContext, lotteryId: string): Promise<APIResponse> {
    const startTime = Date.now();
    
    try {
      // Check if site uses global rates or custom rates
      const { data: site } = await this.supabase
        .from('sites')
        .select('use_global_rates')
        .eq('id', tenant.siteId)
        .single();

      let rates;
      
      if (site?.use_global_rates) {
        // Use master rates
        const { data } = await this.supabase
          .from('master_rates')
          .select('*')
          .eq('lottery_id', lotteryId)
          .eq('is_active', true);
        rates = data;
      } else {
        // Use site-specific rates
        const { data } = await this.supabase
          .from('site_rates')
          .select('*')
          .eq('site_id', tenant.siteId)
          .eq('lottery_id', lotteryId)
          .eq('is_active', true);
        rates = data;
      }

      return this.success(rates, tenant, startTime);
    } catch (err) {
      return this.error('RATES_FETCH_FAILED', 'ไม่สามารถดึงเรทจ่ายได้', tenant, startTime);
    }
  }

  async getLimitedNumbers(tenant: TenantContext, lotteryId: string): Promise<APIResponse> {
    const startTime = Date.now();
    
    try {
      // Get global limits first
      const { data: globalLimits } = await this.supabase
        .from('master_number_limits')
        .select('*')
        .eq('lottery_id', lotteryId)
        .eq('is_active', true);

      // Get site-specific limits
      const { data: siteLimits } = await this.supabase
        .from('site_number_limits')
        .select('*')
        .eq('site_id', tenant.siteId)
        .eq('lottery_id', lotteryId)
        .eq('is_active', true);

      // Merge limits (global takes priority)
      const limits = new Map();
      
      siteLimits?.forEach((l: { number: string; max_amount: number; current_amount: number }) => {
        limits.set(l.number, l);
      });
      
      globalLimits?.forEach((l: { number: string; max_amount: number; current_amount: number }) => {
        limits.set(l.number, { ...limits.get(l.number), ...l, isGlobal: true });
      });

      return this.success(Array.from(limits.values()), tenant, startTime);
    } catch (err) {
      return this.error('LIMITS_FETCH_FAILED', 'ไม่สามารถดึงข้อมูลเลขอั้นได้', tenant, startTime);
    }
  }

  // ===========================================================================
  // BETTING OPERATIONS (HIGH PERFORMANCE)
  // ===========================================================================

  async placeBet(tenant: TenantContext, bet: BetRequest): Promise<APIResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // 1. Validate lottery is open
      const { data: lottery, error: lotteryError } = await this.supabase
        .from('lotteries')
        .select('*')
        .eq('id', bet.lotteryId)
        .single();

      if (lotteryError || !lottery) {
        return this.error('LOTTERY_NOT_FOUND', 'ไม่พบหวยที่ระบุ', tenant, startTime);
      }

      if (new Date(lottery.close_time) < new Date()) {
        return this.error('LOTTERY_CLOSED', 'หวยปิดรับแทงแล้ว', tenant, startTime);
      }

      // 2. Check number limits
      const limitCheck = await this.checkNumberLimit(tenant.siteId, bet.lotteryId, bet.numbers, bet.amount);
      if (!limitCheck.allowed) {
        return this.error('NUMBER_LIMITED', `เลข ${bet.numbers} ${limitCheck.reason}`, tenant, startTime);
      }

      // 3. Get user wallet balance (from central wallet)
      const balance = await this.getWalletBalance(bet.userId, tenant.siteId);
      if (balance < bet.amount) {
        return this.error('INSUFFICIENT_BALANCE', 'ยอดเงินไม่เพียงพอ', tenant, startTime);
      }

      // 4. Calculate commission
      const commission = await this.calculateCommission(tenant.siteId, bet.amount, bet.betType);

      // 5. Place bet in transaction
      const { data: newBet, error: betError } = await this.supabase.rpc('place_bet_transaction', {
        p_site_id: tenant.siteId,
        p_user_id: bet.userId,
        p_lottery_id: bet.lotteryId,
        p_bet_type: bet.betType,
        p_numbers: bet.numbers,
        p_amount: bet.amount,
        p_commission: commission.agentCommission,
        p_net_amount: commission.netAmount,
        p_customer_name: bet.customerName,
        p_request_id: requestId,
      });

      if (betError) throw betError;

      // 6. Update number volume
      await this.updateNumberVolume(tenant.siteId, bet.lotteryId, bet.numbers, bet.amount);

      return this.success({
        betId: newBet.bet_id,
        amount: bet.amount,
        commission: commission,
        newBalance: newBet.new_balance,
        timestamp: new Date().toISOString(),
      }, tenant, startTime);

    } catch (err) {
      console.error('[UniversalAPI] placeBet error:', err);
      return this.error('BET_FAILED', 'ไม่สามารถบันทึกการแทงได้', tenant, startTime);
    }
  }

  async placeBulkBets(tenant: TenantContext, bets: BetRequest[]): Promise<APIResponse> {
    const startTime = Date.now();
    const results: Array<{ success: boolean; betId?: string; error?: string }> = [];

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < bets.length; i += batchSize) {
      const batch = bets.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(bet => this.placeBet(tenant, bet))
      );

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.success) {
          results.push({ success: true, betId: (result.value.data as any)?.betId });
        } else {
          results.push({ 
            success: false, 
            error: result.status === 'rejected' ? result.reason : result.value.error?.message 
          });
        }
      });
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    return this.success({
      total: bets.length,
      successful,
      failed,
      results,
    }, tenant, startTime);
  }

  // ===========================================================================
  // WALLET OPERATIONS (CENTRALIZED)
  // ===========================================================================

  async getWalletBalance(userId: string, siteId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .eq('site_id', siteId)
      .single();

    if (error || !data) return 0;
    return data.balance;
  }

  async processWalletOperation(tenant: TenantContext, op: WalletOperation): Promise<APIResponse> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.supabase.rpc('process_wallet_transaction', {
        p_site_id: tenant.siteId,
        p_user_id: op.userId,
        p_type: op.type,
        p_amount: op.amount,
        p_reference: op.reference,
        p_metadata: op.metadata,
      });

      if (error) throw error;

      return this.success({
        transactionId: data.transaction_id,
        newBalance: data.new_balance,
        type: op.type,
        amount: op.amount,
      }, tenant, startTime);

    } catch (err) {
      return this.error('WALLET_OP_FAILED', 'ไม่สามารถดำเนินการกระเป๋าเงินได้', tenant, startTime);
    }
  }

  // ===========================================================================
  // RESULTS & PAYOUTS
  // ===========================================================================

  async getResults(tenant: TenantContext, lotteryId: string, date?: string): Promise<APIResponse> {
    const startTime = Date.now();

    try {
      let query = this.supabase
        .from('lottery_results')
        .select('*')
        .eq('lottery_id', lotteryId);

      if (date) {
        query = query.eq('draw_date', date);
      } else {
        query = query.order('draw_date', { ascending: false }).limit(10);
      }

      const { data, error } = await query;
      if (error) throw error;

      return this.success(data, tenant, startTime);
    } catch (err) {
      return this.error('RESULTS_FETCH_FAILED', 'ไม่สามารถดึงผลรางวัลได้', tenant, startTime);
    }
  }

  async processPayouts(tenant: TenantContext, lotteryId: string, resultId: string): Promise<APIResponse> {
    const startTime = Date.now();

    try {
      // This would trigger the payout calculation for all winning bets
      const { data, error } = await this.supabase.rpc('process_lottery_payouts', {
        p_site_id: tenant.siteId,
        p_lottery_id: lotteryId,
        p_result_id: resultId,
      });

      if (error) throw error;

      return this.success({
        processedBets: data.processed_count,
        totalPayout: data.total_payout,
        winners: data.winners_count,
      }, tenant, startTime);

    } catch (err) {
      return this.error('PAYOUT_FAILED', 'ไม่สามารถประมวลผลรางวัลได้', tenant, startTime);
    }
  }

  // ===========================================================================
  // REPORTING
  // ===========================================================================

  async getSiteSummary(tenant: TenantContext, dateRange: { from: string; to: string }): Promise<APIResponse> {
    const startTime = Date.now();

    try {
      const { data, error } = await this.supabase.rpc('get_site_summary', {
        p_site_id: tenant.siteId,
        p_from_date: dateRange.from,
        p_to_date: dateRange.to,
      });

      if (error) throw error;

      return this.success(data, tenant, startTime);
    } catch (err) {
      return this.error('SUMMARY_FAILED', 'ไม่สามารถดึงรายงานสรุปได้', tenant, startTime);
    }
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private async checkNumberLimit(
    siteId: string,
    lotteryId: string,
    numbers: string,
    amount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const { data: limit } = await this.supabase
      .from('number_volumes')
      .select('*')
      .eq('site_id', siteId)
      .eq('lottery_id', lotteryId)
      .eq('number', numbers)
      .single();

    if (!limit) return { allowed: true };

    const newTotal = (limit.current_volume || 0) + amount;
    
    if (limit.max_volume && newTotal > limit.max_volume) {
      return { 
        allowed: false, 
        reason: `เต็มเพดาน (${limit.current_volume}/${limit.max_volume})` 
      };
    }

    if (limit.is_banned) {
      return { allowed: false, reason: 'เลขอั้น' };
    }

    return { allowed: true };
  }

  private async calculateCommission(
    siteId: string,
    amount: number,
    betType: string
  ): Promise<{ agentCommission: number; siteCommission: number; masterCommission: number; netAmount: number }> {
    // Get commission rates for this site
    const { data: site } = await this.supabase
      .from('sites')
      .select('commission_rate, parent_commission_rate')
      .eq('id', siteId)
      .single();

    const commissionRate = site?.commission_rate || 0.20; // Default 20%
    const parentRate = site?.parent_commission_rate || 0.05; // Master takes 5%

    const totalCommission = amount * commissionRate;
    const masterCommission = amount * parentRate;
    const agentCommission = totalCommission - masterCommission;

    return {
      agentCommission,
      siteCommission: agentCommission,
      masterCommission,
      netAmount: amount - totalCommission,
    };
  }

  private async updateNumberVolume(
    siteId: string,
    lotteryId: string,
    numbers: string,
    amount: number
  ): Promise<void> {
    await this.supabase.rpc('update_number_volume', {
      p_site_id: siteId,
      p_lottery_id: lotteryId,
      p_number: numbers,
      p_amount: amount,
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private success<T>(data: T, tenant: TenantContext, startTime: number): APIResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: Date.now(),
        requestId: this.generateRequestId(),
        siteId: tenant.siteId,
        processingTime: Date.now() - startTime,
      },
    };
  }

  private error(code: string, message: string, tenant: TenantContext, startTime: number): APIResponse {
    return {
      success: false,
      error: { code, message },
      meta: {
        timestamp: Date.now(),
        requestId: this.generateRequestId(),
        siteId: tenant.siteId,
        processingTime: Date.now() - startTime,
      },
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let apiCoreInstance: UniversalAPICore | null = null;

export function getAPICore(): UniversalAPICore {
  if (!apiCoreInstance) {
    apiCoreInstance = new UniversalAPICore();
  }
  return apiCoreInstance;
}

// =============================================================================
// API ROUTE HANDLER HELPER
// =============================================================================

export async function withTenantAuth<T>(
  apiKey: string,
  handler: (tenant: TenantContext) => Promise<APIResponse<T>>
): Promise<APIResponse<T>> {
  const api = getAPICore();
  
  const tenant = await api.validateTenant(apiKey);
  if (!tenant) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
    };
  }

  const allowed = await api.checkRateLimit(tenant);
  if (!allowed) {
    return {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    };
  }

  return handler(tenant);
}
