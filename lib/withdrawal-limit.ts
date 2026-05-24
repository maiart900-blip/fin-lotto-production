/**
 * Daily Withdrawal Limit System (ข้อ 79)
 * ระบบจำกัดถอนต่อวัน
 * - จำกัดตามสมาชิก
 * - จำกัดตาม VIP
 * - จำกัดตามความเสี่ยง
 */

import { createClient } from '@/lib/supabase/server';
import { redis, REDIS_KEYS } from '@/lib/redis';
import { auditLogger } from '@/lib/audit-logger';

// =============================================
// TYPES
// =============================================

export interface WithdrawalLimitConfig {
  // Default limits
  defaultDailyLimit: number;
  defaultMinAmount: number;
  defaultMaxAmount: number;
  
  // VIP tier limits
  vipLimits: {
    tier: number;
    name: string;
    dailyLimit: number;
    maxPerTransaction: number;
    cooldownMinutes: number;
  }[];
  
  // Risk-based limits
  riskLimits: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    dailyLimit: number;
    maxPerTransaction: number;
    requiresApproval: boolean;
  }[];
}

export interface WithdrawalLimitCheck {
  allowed: boolean;
  reason?: string;
  
  // Limit info
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  
  // Transaction limits
  minAmount: number;
  maxAmount: number;
  maxAllowedNow: number;
  
  // Status
  requiresApproval: boolean;
  approvalReason?: string;
  
  // Cooldown
  cooldownActive: boolean;
  cooldownEndsAt?: string;
  
  // Recommendations
  suggestions?: string[];
}

export interface CustomerWithdrawalStatus {
  customerId: string;
  customerPhone: string;
  vipTier: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Today's activity
  withdrawalsToday: number;
  amountWithdrawnToday: number;
  
  // Limits
  dailyLimit: number;
  remainingLimit: number;
  
  // Last withdrawal
  lastWithdrawalAt?: string;
  lastWithdrawalAmount?: number;
  
  // Flags
  isFrozen: boolean;
  frozenReason?: string;
}

// =============================================
// DEFAULT CONFIGURATION
// =============================================

const DEFAULT_CONFIG: WithdrawalLimitConfig = {
  defaultDailyLimit: 100000, // 100,000 บาท
  defaultMinAmount: 100,     // 100 บาท
  defaultMaxAmount: 50000,   // 50,000 บาท
  
  vipLimits: [
    { tier: 0, name: 'Normal', dailyLimit: 100000, maxPerTransaction: 50000, cooldownMinutes: 30 },
    { tier: 1, name: 'Bronze', dailyLimit: 200000, maxPerTransaction: 100000, cooldownMinutes: 15 },
    { tier: 2, name: 'Silver', dailyLimit: 300000, maxPerTransaction: 150000, cooldownMinutes: 10 },
    { tier: 3, name: 'Gold', dailyLimit: 500000, maxPerTransaction: 200000, cooldownMinutes: 5 },
    { tier: 4, name: 'Platinum', dailyLimit: 1000000, maxPerTransaction: 500000, cooldownMinutes: 0 },
    { tier: 5, name: 'Diamond', dailyLimit: 2000000, maxPerTransaction: 1000000, cooldownMinutes: 0 },
  ],
  
  riskLimits: [
    { riskLevel: 'low', dailyLimit: 500000, maxPerTransaction: 200000, requiresApproval: false },
    { riskLevel: 'medium', dailyLimit: 200000, maxPerTransaction: 100000, requiresApproval: false },
    { riskLevel: 'high', dailyLimit: 50000, maxPerTransaction: 20000, requiresApproval: true },
    { riskLevel: 'critical', dailyLimit: 0, maxPerTransaction: 0, requiresApproval: true },
  ],
};

// =============================================
// WITHDRAWAL LIMIT SERVICE
// =============================================

export class WithdrawalLimitService {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  private config: WithdrawalLimitConfig = DEFAULT_CONFIG;

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  /**
   * ตรวจสอบว่าสามารถถอนได้หรือไม่
   */
  async checkWithdrawalLimit(
    customerId: string,
    amount: number
  ): Promise<WithdrawalLimitCheck> {
    const supabase = await this.getClient();
    const suggestions: string[] = [];

    // Get customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone, vip_level, risk_score, is_frozen, frozen_reason, balance')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return {
        allowed: false,
        reason: 'ไม่พบข้อมูลลูกค้า',
        dailyLimit: 0,
        usedToday: 0,
        remainingToday: 0,
        minAmount: 0,
        maxAmount: 0,
        maxAllowedNow: 0,
        requiresApproval: false,
        cooldownActive: false,
      };
    }

    // Check if frozen
    if (customer.is_frozen) {
      return {
        allowed: false,
        reason: customer.frozen_reason || 'บัญชีถูกระงับการถอน',
        dailyLimit: 0,
        usedToday: 0,
        remainingToday: 0,
        minAmount: 0,
        maxAmount: 0,
        maxAllowedNow: 0,
        requiresApproval: false,
        cooldownActive: false,
      };
    }

    // Check balance
    if (customer.balance < amount) {
      return {
        allowed: false,
        reason: `ยอดเงินไม่พอ (มี ${customer.balance.toLocaleString()} บาท)`,
        dailyLimit: 0,
        usedToday: 0,
        remainingToday: 0,
        minAmount: 0,
        maxAmount: 0,
        maxAllowedNow: customer.balance,
        requiresApproval: false,
        cooldownActive: false,
        suggestions: ['กรุณาเติมเงินก่อนถอน'],
      };
    }

    // Get VIP limits
    const vipTier = customer.vip_level || 0;
    const vipConfig = this.config.vipLimits.find(v => v.tier === vipTier) 
      || this.config.vipLimits[0];

    // Get risk limits
    const riskLevel = this.calculateRiskLevel(customer.risk_score || 0);
    const riskConfig = this.config.riskLimits.find(r => r.riskLevel === riskLevel)
      || this.config.riskLimits[0];

    // Calculate effective limits (use lower of VIP and risk limits)
    const dailyLimit = Math.min(vipConfig.dailyLimit, riskConfig.dailyLimit);
    const maxPerTransaction = Math.min(vipConfig.maxPerTransaction, riskConfig.maxPerTransaction);

    // Get today's withdrawals
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayWithdrawals } = await supabase
      .from('withdraw_requests')
      .select('amount, status, created_at')
      .eq('customer_id', customerId)
      .gte('created_at', today.toISOString())
      .in('status', ['pending', 'approved']);

    const usedToday = todayWithdrawals?.reduce((sum, w) => sum + w.amount, 0) || 0;
    const remainingToday = Math.max(0, dailyLimit - usedToday);

    // Check cooldown
    const { data: lastWithdrawal } = await supabase
      .from('withdraw_requests')
      .select('created_at')
      .eq('customer_id', customerId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let cooldownActive = false;
    let cooldownEndsAt: string | undefined;

    if (lastWithdrawal && vipConfig.cooldownMinutes > 0) {
      const lastTime = new Date(lastWithdrawal.created_at);
      const cooldownEnd = new Date(lastTime.getTime() + vipConfig.cooldownMinutes * 60 * 1000);
      
      if (cooldownEnd > new Date()) {
        cooldownActive = true;
        cooldownEndsAt = cooldownEnd.toISOString();
      }
    }

    // Calculate max allowed now
    const maxAllowedNow = Math.min(
      remainingToday,
      maxPerTransaction,
      customer.balance
    );

    // Check if requires approval
    const requiresApproval = riskConfig.requiresApproval || amount > 50000;
    let approvalReason: string | undefined;

    if (riskConfig.requiresApproval) {
      approvalReason = `ความเสี่ยงระดับ ${riskLevel}`;
    } else if (amount > 50000) {
      approvalReason = 'ยอดถอนเกิน 50,000 บาท';
    }

    // Determine if allowed
    let allowed = true;
    let reason: string | undefined;

    if (cooldownActive) {
      allowed = false;
      reason = `กรุณารอ cooldown สิ้นสุด (${new Date(cooldownEndsAt!).toLocaleString('th-TH')})`;
    } else if (amount < this.config.defaultMinAmount) {
      allowed = false;
      reason = `ยอดถอนขั้นต่ำ ${this.config.defaultMinAmount.toLocaleString()} บาท`;
    } else if (amount > maxPerTransaction) {
      allowed = false;
      reason = `ถอนได้สูงสุด ${maxPerTransaction.toLocaleString()} บาท/ครั้ง`;
      suggestions.push(`ลดยอดถอนเหลือไม่เกิน ${maxPerTransaction.toLocaleString()} บาท`);
    } else if (amount > remainingToday) {
      allowed = false;
      reason = `เกินวงเงินถอนวันนี้ (เหลือ ${remainingToday.toLocaleString()} บาท)`;
      suggestions.push(`ถอนได้อีก ${remainingToday.toLocaleString()} บาท วันนี้`);
      suggestions.push('รอวันใหม่เพื่อถอนเพิ่ม');
    } else if (riskLevel === 'critical') {
      allowed = false;
      reason = 'บัญชีมีความเสี่ยงสูง ไม่อนุญาตให้ถอน';
    }

    // Log check
    await auditLogger.log({
      action: 'WITHDRAWAL_LIMIT_CHECKED',
      resource: 'withdraw_request',
      userId: customerId,
      metadata: {
        amount,
        allowed,
        reason,
        daily_limit: dailyLimit,
        used_today: usedToday,
        vip_tier: vipTier,
        risk_level: riskLevel,
      },
    });

    return {
      allowed,
      reason,
      dailyLimit,
      usedToday,
      remainingToday,
      minAmount: this.config.defaultMinAmount,
      maxAmount: maxPerTransaction,
      maxAllowedNow,
      requiresApproval,
      approvalReason,
      cooldownActive,
      cooldownEndsAt,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * ดึงสถานะถอนของลูกค้า
   */
  async getCustomerStatus(customerId: string): Promise<CustomerWithdrawalStatus | null> {
    const supabase = await this.getClient();

    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone, vip_level, risk_score, is_frozen, frozen_reason')
      .eq('id', customerId)
      .single();

    if (!customer) return null;

    const vipTier = customer.vip_level || 0;
    const riskLevel = this.calculateRiskLevel(customer.risk_score || 0);
    
    const vipConfig = this.config.vipLimits.find(v => v.tier === vipTier) 
      || this.config.vipLimits[0];
    const riskConfig = this.config.riskLimits.find(r => r.riskLevel === riskLevel)
      || this.config.riskLimits[0];

    const dailyLimit = Math.min(vipConfig.dailyLimit, riskConfig.dailyLimit);

    // Get today's withdrawals
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayWithdrawals } = await supabase
      .from('withdraw_requests')
      .select('amount, status')
      .eq('customer_id', customerId)
      .gte('created_at', today.toISOString())
      .in('status', ['pending', 'approved']);

    const withdrawalsToday = todayWithdrawals?.length || 0;
    const amountWithdrawnToday = todayWithdrawals?.reduce((sum, w) => sum + w.amount, 0) || 0;

    // Get last withdrawal
    const { data: lastWithdrawal } = await supabase
      .from('withdraw_requests')
      .select('amount, created_at')
      .eq('customer_id', customerId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      customerId: customer.id,
      customerPhone: customer.phone,
      vipTier,
      riskLevel,
      withdrawalsToday,
      amountWithdrawnToday,
      dailyLimit,
      remainingLimit: Math.max(0, dailyLimit - amountWithdrawnToday),
      lastWithdrawalAt: lastWithdrawal?.created_at,
      lastWithdrawalAmount: lastWithdrawal?.amount,
      isFrozen: customer.is_frozen || false,
      frozenReason: customer.frozen_reason,
    };
  }

  /**
   * ตั้งค่าวงเงินพิเศษสำหรับลูกค้า
   */
  async setCustomLimit(
    customerId: string,
    dailyLimit: number,
    maxPerTransaction: number,
    setBy: string,
    reason: string
  ): Promise<boolean> {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from('customer_withdrawal_limits')
      .upsert({
        customer_id: customerId,
        daily_limit: dailyLimit,
        max_per_transaction: maxPerTransaction,
        set_by: setBy,
        reason,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'customer_id',
      });

    if (!error) {
      // Clear cache
      await redis?.del(`${REDIS_KEYS.WITHDRAWAL_LIMIT}:${customerId}`);

      await auditLogger.log({
        action: 'CUSTOM_WITHDRAWAL_LIMIT_SET',
        resource: 'customer_withdrawal_limits',
        resourceId: customerId,
        userId: setBy,
        metadata: {
          daily_limit: dailyLimit,
          max_per_transaction: maxPerTransaction,
          reason,
        },
      });

      return true;
    }

    return false;
  }

  /**
   * ระงับการถอนของลูกค้า
   */
  async freezeWithdrawal(
    customerId: string,
    reason: string,
    frozenBy: string
  ): Promise<boolean> {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from('customers')
      .update({
        is_frozen: true,
        frozen_reason: reason,
        frozen_at: new Date().toISOString(),
        frozen_by: frozenBy,
      })
      .eq('id', customerId);

    if (!error) {
      await auditLogger.log({
        action: 'CUSTOMER_WITHDRAWAL_FROZEN',
        resource: 'customers',
        resourceId: customerId,
        userId: frozenBy,
        metadata: { reason },
      });

      return true;
    }

    return false;
  }

  /**
   * ปลดระงับการถอน
   */
  async unfreezeWithdrawal(
    customerId: string,
    unfreezedBy: string,
    reason: string
  ): Promise<boolean> {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from('customers')
      .update({
        is_frozen: false,
        frozen_reason: null,
        frozen_at: null,
        frozen_by: null,
      })
      .eq('id', customerId);

    if (!error) {
      await auditLogger.log({
        action: 'CUSTOMER_WITHDRAWAL_UNFROZEN',
        resource: 'customers',
        resourceId: customerId,
        userId: unfreezedBy,
        metadata: { reason },
      });

      return true;
    }

    return false;
  }

  /**
   * ดึงรายงานวงเงินถอน
   */
  async getWithdrawalReport(
    date?: string
  ): Promise<{
    totalWithdrawn: number;
    totalPending: number;
    customersNearLimit: {
      customerId: string;
      phone: string;
      usedPercent: number;
      remaining: number;
    }[];
    frozenCustomers: number;
  }> {
    const supabase = await this.getClient();
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startOfDay = `${targetDate}T00:00:00+07:00`;
    const endOfDay = `${targetDate}T23:59:59+07:00`;

    // Total withdrawn
    const { data: approved } = await supabase
      .from('withdraw_requests')
      .select('amount')
      .eq('status', 'approved')
      .gte('approved_at', startOfDay)
      .lte('approved_at', endOfDay);

    const totalWithdrawn = approved?.reduce((sum, w) => sum + w.amount, 0) || 0;

    // Total pending
    const { data: pending } = await supabase
      .from('withdraw_requests')
      .select('amount')
      .eq('status', 'pending');

    const totalPending = pending?.reduce((sum, w) => sum + w.amount, 0) || 0;

    // Frozen customers count
    const { count: frozenCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('is_frozen', true);

    // Customers near limit (>80%)
    const customersNearLimit: {
      customerId: string;
      phone: string;
      usedPercent: number;
      remaining: number;
    }[] = [];

    // This would need optimization for large datasets
    // For now, return empty as placeholder

    return {
      totalWithdrawn,
      totalPending,
      customersNearLimit,
      frozenCustomers: frozenCustomers || 0,
    };
  }

  /**
   * Calculate risk level from score
   */
  private calculateRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  /**
   * Update config
   */
  updateConfig(updates: Partial<WithdrawalLimitConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current config
   */
  getConfig(): WithdrawalLimitConfig {
    return { ...this.config };
  }
}

// Export singleton
export const withdrawalLimit = new WithdrawalLimitService();
