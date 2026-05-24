// =============================================================================
// MULTI-WALLET SYSTEM - Production Ready
// =============================================================================
// ระบบ Wallet หลายประเภท: Main, Bonus, Cashback, Promo, Referral
// รองรับ Freeze Balance, Turnover Tracking, Auto-Expiry
// =============================================================================

import { createClient } from '@/lib/supabase/server';

// Types
export type WalletTypeCode = 'main' | 'bonus' | 'cashback' | 'promo' | 'referral';

export type TransactionType = 
  | 'deposit' 
  | 'withdraw' 
  | 'bet' 
  | 'win' 
  | 'bonus_credit' 
  | 'cashback' 
  | 'promo_credit' 
  | 'transfer_in' 
  | 'transfer_out' 
  | 'freeze' 
  | 'unfreeze' 
  | 'expire' 
  | 'adjustment'
  | 'commission'
  | 'referral_bonus';

export interface WalletType {
  id: string;
  code: WalletTypeCode;
  name: string;
  nameTh: string;
  canWithdraw: boolean;
  canBet: boolean;
  canTransfer: boolean;
  expiresDays: number | null;
  minTurnoverMultiplier: number;
  priority: number;
}

export interface UserWallet {
  id: string;
  userId: string;
  siteId: string;
  walletTypeId: string;
  walletType?: WalletType;
  balance: number;
  frozenAmount: number;
  availableBalance: number;
  turnoverRequired: number;
  turnoverCompleted: number;
  turnoverRemaining: number;
  expiresAt: string | null;
  isExpired: boolean;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenBy: string | null;
  frozenReason: string | null;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  siteId: string;
  walletId: string;
  walletTypeId: string;
  transactionType: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  turnoverContribution: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface FreezeRequest {
  id: string;
  userId: string;
  siteId: string;
  walletId: string | null;
  amount: number | null;
  reason: string;
  status: 'active' | 'released' | 'expired';
  frozenAt: string;
  frozenBy: string;
  frozenByName: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseReason: string | null;
  autoReleaseAt: string | null;
}

export interface WalletSummary {
  totalBalance: number;
  mainBalance: number;
  bonusBalance: number;
  cashbackBalance: number;
  promoBalance: number;
  referralBalance: number;
  totalFrozen: number;
  totalAvailable: number;
  wallets: UserWallet[];
}

// =============================================================================
// WALLET SERVICE
// =============================================================================

export class MultiWalletService {
  private supabase: Awaited<ReturnType<typeof createClient>>;

  constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  // ---------------------------------------------------------------------------
  // GET WALLET INFO
  // ---------------------------------------------------------------------------

  async getUserWallets(userId: string, siteId: string): Promise<UserWallet[]> {
    const { data, error } = await this.supabase
      .from('user_wallets')
      .select(`
        *,
        wallet_type:wallet_types(*)
      `)
      .eq('user_id', userId)
      .eq('site_id', siteId)
      .order('wallet_type(priority)');

    if (error) throw error;
    return data?.map(this.mapWallet) || [];
  }

  async getWalletSummary(userId: string, siteId: string): Promise<WalletSummary> {
    const wallets = await this.getUserWallets(userId, siteId);
    
    const summary: WalletSummary = {
      totalBalance: 0,
      mainBalance: 0,
      bonusBalance: 0,
      cashbackBalance: 0,
      promoBalance: 0,
      referralBalance: 0,
      totalFrozen: 0,
      totalAvailable: 0,
      wallets,
    };

    for (const wallet of wallets) {
      summary.totalBalance += wallet.balance;
      summary.totalFrozen += wallet.frozenAmount;
      summary.totalAvailable += wallet.availableBalance;

      switch (wallet.walletType?.code) {
        case 'main':
          summary.mainBalance = wallet.balance;
          break;
        case 'bonus':
          summary.bonusBalance = wallet.balance;
          break;
        case 'cashback':
          summary.cashbackBalance = wallet.balance;
          break;
        case 'promo':
          summary.promoBalance = wallet.balance;
          break;
        case 'referral':
          summary.referralBalance = wallet.balance;
          break;
      }
    }

    return summary;
  }

  async getWalletByType(
    userId: string, 
    siteId: string, 
    typeCode: WalletTypeCode
  ): Promise<UserWallet | null> {
    const { data, error } = await this.supabase
      .from('user_wallets')
      .select(`
        *,
        wallet_type:wallet_types!inner(*)
      `)
      .eq('user_id', userId)
      .eq('site_id', siteId)
      .eq('wallet_types.code', typeCode)
      .single();

    if (error) return null;
    return this.mapWallet(data);
  }

  // ---------------------------------------------------------------------------
  // WALLET OPERATIONS
  // ---------------------------------------------------------------------------

  async createUserWallets(userId: string, siteId: string): Promise<void> {
    // Get all active wallet types
    const { data: walletTypes } = await this.supabase
      .from('wallet_types')
      .select('*')
      .eq('is_active', true);

    if (!walletTypes?.length) return;

    // Create wallets for each type
    const walletsToCreate = walletTypes.map(wt => ({
      user_id: userId,
      site_id: siteId,
      wallet_type_id: wt.id,
      balance: 0,
      frozen_amount: 0,
      turnover_required: 0,
      turnover_completed: 0,
      expires_at: wt.expires_days 
        ? new Date(Date.now() + wt.expires_days * 24 * 60 * 60 * 1000).toISOString()
        : null,
    }));

    await this.supabase
      .from('user_wallets')
      .upsert(walletsToCreate, { onConflict: 'user_id,site_id,wallet_type_id' });
  }

  async creditWallet(params: {
    userId: string;
    siteId: string;
    walletType: WalletTypeCode;
    amount: number;
    transactionType: TransactionType;
    description?: string;
    referenceType?: string;
    referenceId?: string;
    createdBy?: string;
    ipAddress?: string;
    turnoverMultiplier?: number;
  }): Promise<WalletTransaction> {
    const wallet = await this.getWalletByType(params.userId, params.siteId, params.walletType);
    if (!wallet) {
      // Create wallet if not exists
      await this.createUserWallets(params.userId, params.siteId);
      const newWallet = await this.getWalletByType(params.userId, params.siteId, params.walletType);
      if (!newWallet) throw new Error('Failed to create wallet');
      return this.creditWallet(params);
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + params.amount;

    // Calculate turnover requirement for bonus/promo credits
    let turnoverRequired = wallet.turnoverRequired;
    if (params.turnoverMultiplier && params.amount > 0) {
      turnoverRequired += params.amount * params.turnoverMultiplier;
    }

    // Update wallet balance
    const { error: updateError } = await this.supabase
      .from('user_wallets')
      .update({
        balance: balanceAfter,
        turnover_required: turnoverRequired,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateError) throw updateError;

    // Create transaction log
    const { data: transaction, error: txError } = await this.supabase
      .from('wallet_transactions')
      .insert({
        user_id: params.userId,
        site_id: params.siteId,
        wallet_id: wallet.id,
        wallet_type_id: wallet.walletTypeId,
        transaction_type: params.transactionType,
        amount: params.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: params.description,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        created_by: params.createdBy,
        ip_address: params.ipAddress,
      })
      .select()
      .single();

    if (txError) throw txError;
    return this.mapTransaction(transaction);
  }

  async debitWallet(params: {
    userId: string;
    siteId: string;
    walletType: WalletTypeCode;
    amount: number;
    transactionType: TransactionType;
    description?: string;
    referenceType?: string;
    referenceId?: string;
    createdBy?: string;
    ipAddress?: string;
    countAsTurnover?: boolean;
  }): Promise<WalletTransaction> {
    const wallet = await this.getWalletByType(params.userId, params.siteId, params.walletType);
    if (!wallet) throw new Error('Wallet not found');

    if (wallet.availableBalance < params.amount) {
      throw new Error('Insufficient balance');
    }

    if (wallet.isFrozen) {
      throw new Error('Wallet is frozen');
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - params.amount;

    // Calculate turnover contribution
    let turnoverCompleted = wallet.turnoverCompleted;
    if (params.countAsTurnover && params.transactionType === 'bet') {
      turnoverCompleted += params.amount;
    }

    // Update wallet balance
    const { error: updateError } = await this.supabase
      .from('user_wallets')
      .update({
        balance: balanceAfter,
        turnover_completed: turnoverCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateError) throw updateError;

    // Create transaction log
    const { data: transaction, error: txError } = await this.supabase
      .from('wallet_transactions')
      .insert({
        user_id: params.userId,
        site_id: params.siteId,
        wallet_id: wallet.id,
        wallet_type_id: wallet.walletTypeId,
        transaction_type: params.transactionType,
        amount: -params.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        turnover_contribution: params.countAsTurnover ? params.amount : 0,
        description: params.description,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        created_by: params.createdBy,
        ip_address: params.ipAddress,
      })
      .select()
      .single();

    if (txError) throw txError;
    return this.mapTransaction(transaction);
  }

  // ---------------------------------------------------------------------------
  // FREEZE BALANCE
  // ---------------------------------------------------------------------------

  async freezeBalance(params: {
    userId: string;
    siteId: string;
    amount?: number; // null = freeze all
    reason: string;
    frozenBy: string;
    frozenByName?: string;
    frozenByRole?: string;
    autoReleaseHours?: number;
    ipAddress?: string;
  }): Promise<FreezeRequest> {
    const wallet = await this.getWalletByType(params.userId, params.siteId, 'main');
    if (!wallet) throw new Error('Main wallet not found');

    const freezeAmount = params.amount ?? wallet.availableBalance;

    if (freezeAmount > wallet.availableBalance) {
      throw new Error('Freeze amount exceeds available balance');
    }

    // Update wallet
    const { error: updateError } = await this.supabase
      .from('user_wallets')
      .update({
        frozen_amount: wallet.frozenAmount + freezeAmount,
        is_frozen: true,
        frozen_at: new Date().toISOString(),
        frozen_by: params.frozenBy,
        frozen_reason: params.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (updateError) throw updateError;

    // Create freeze request
    const autoReleaseAt = params.autoReleaseHours
      ? new Date(Date.now() + params.autoReleaseHours * 60 * 60 * 1000).toISOString()
      : null;

    const { data: freezeRequest, error: freezeError } = await this.supabase
      .from('freeze_requests')
      .insert({
        user_id: params.userId,
        site_id: params.siteId,
        wallet_id: wallet.id,
        amount: freezeAmount,
        reason: params.reason,
        status: 'active',
        frozen_by: params.frozenBy,
        frozen_by_name: params.frozenByName,
        frozen_by_role: params.frozenByRole,
        auto_release_at: autoReleaseAt,
        ip_address: params.ipAddress,
      })
      .select()
      .single();

    if (freezeError) throw freezeError;

    // Log transaction
    await this.supabase.from('wallet_transactions').insert({
      user_id: params.userId,
      site_id: params.siteId,
      wallet_id: wallet.id,
      wallet_type_id: wallet.walletTypeId,
      transaction_type: 'freeze',
      amount: -freezeAmount,
      balance_before: wallet.availableBalance,
      balance_after: wallet.availableBalance - freezeAmount,
      description: `Frozen: ${params.reason}`,
      created_by: params.frozenBy,
      ip_address: params.ipAddress,
    });

    return this.mapFreezeRequest(freezeRequest);
  }

  async releaseFrozenBalance(params: {
    freezeId: string;
    releasedBy: string;
    releasedByName?: string;
    releaseReason: string;
    ipAddress?: string;
  }): Promise<boolean> {
    // Get freeze request
    const { data: freezeRequest, error: getError } = await this.supabase
      .from('freeze_requests')
      .select('*')
      .eq('id', params.freezeId)
      .eq('status', 'active')
      .single();

    if (getError || !freezeRequest) return false;

    // Get wallet
    const { data: wallet, error: walletError } = await this.supabase
      .from('user_wallets')
      .select('*')
      .eq('id', freezeRequest.wallet_id)
      .single();

    if (walletError || !wallet) return false;

    const releaseAmount = freezeRequest.amount ?? wallet.frozen_amount;
    const newFrozenAmount = Math.max(0, wallet.frozen_amount - releaseAmount);

    // Update wallet
    await this.supabase
      .from('user_wallets')
      .update({
        frozen_amount: newFrozenAmount,
        is_frozen: newFrozenAmount > 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    // Update freeze request
    await this.supabase
      .from('freeze_requests')
      .update({
        status: 'released',
        released_at: new Date().toISOString(),
        released_by: params.releasedBy,
        released_by_name: params.releasedByName,
        release_reason: params.releaseReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.freezeId);

    // Log transaction
    await this.supabase.from('wallet_transactions').insert({
      user_id: freezeRequest.user_id,
      site_id: freezeRequest.site_id,
      wallet_id: wallet.id,
      wallet_type_id: wallet.wallet_type_id,
      transaction_type: 'unfreeze',
      amount: releaseAmount,
      balance_before: wallet.balance - wallet.frozen_amount,
      balance_after: wallet.balance - newFrozenAmount,
      description: `Released: ${params.releaseReason}`,
      created_by: params.releasedBy,
      ip_address: params.ipAddress,
    });

    return true;
  }

  async getActiveFreezeRequests(userId: string, siteId: string): Promise<FreezeRequest[]> {
    const { data, error } = await this.supabase
      .from('freeze_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('site_id', siteId)
      .eq('status', 'active')
      .order('frozen_at', { ascending: false });

    if (error) throw error;
    return data?.map(this.mapFreezeRequest) || [];
  }

  // ---------------------------------------------------------------------------
  // TRANSACTIONS
  // ---------------------------------------------------------------------------

  async getTransactionHistory(params: {
    userId: string;
    siteId: string;
    walletType?: WalletTypeCode;
    transactionType?: TransactionType;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: WalletTransaction[]; total: number }> {
    let query = this.supabase
      .from('wallet_transactions')
      .select('*, wallet_type:wallet_types(*)', { count: 'exact' })
      .eq('user_id', params.userId)
      .eq('site_id', params.siteId)
      .order('created_at', { ascending: false });

    if (params.walletType) {
      query = query.eq('wallet_types.code', params.walletType);
    }

    if (params.transactionType) {
      query = query.eq('transaction_type', params.transactionType);
    }

    if (params.startDate) {
      query = query.gte('created_at', params.startDate);
    }

    if (params.endDate) {
      query = query.lte('created_at', params.endDate);
    }

    if (params.limit) {
      query = query.limit(params.limit);
    }

    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      transactions: data?.map(this.mapTransaction) || [],
      total: count || 0,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private mapWallet(data: Record<string, unknown>): UserWallet {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      siteId: data.site_id as string,
      walletTypeId: data.wallet_type_id as string,
      walletType: data.wallet_type ? this.mapWalletType(data.wallet_type as Record<string, unknown>) : undefined,
      balance: Number(data.balance || 0),
      frozenAmount: Number(data.frozen_amount || 0),
      availableBalance: Number(data.available_balance || 0),
      turnoverRequired: Number(data.turnover_required || 0),
      turnoverCompleted: Number(data.turnover_completed || 0),
      turnoverRemaining: Number(data.turnover_remaining || 0),
      expiresAt: data.expires_at as string | null,
      isExpired: Boolean(data.is_expired),
      isFrozen: Boolean(data.is_frozen),
      frozenAt: data.frozen_at as string | null,
      frozenBy: data.frozen_by as string | null,
      frozenReason: data.frozen_reason as string | null,
    };
  }

  private mapWalletType(data: Record<string, unknown>): WalletType {
    return {
      id: data.id as string,
      code: data.code as WalletTypeCode,
      name: data.name as string,
      nameTh: data.name_th as string,
      canWithdraw: Boolean(data.can_withdraw),
      canBet: Boolean(data.can_bet),
      canTransfer: Boolean(data.can_transfer),
      expiresDays: data.expires_days as number | null,
      minTurnoverMultiplier: Number(data.min_turnover_multiplier || 1),
      priority: Number(data.priority || 0),
    };
  }

  private mapTransaction(data: Record<string, unknown>): WalletTransaction {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      siteId: data.site_id as string,
      walletId: data.wallet_id as string,
      walletTypeId: data.wallet_type_id as string,
      transactionType: data.transaction_type as TransactionType,
      amount: Number(data.amount || 0),
      balanceBefore: Number(data.balance_before || 0),
      balanceAfter: Number(data.balance_after || 0),
      turnoverContribution: Number(data.turnover_contribution || 0),
      referenceType: data.reference_type as string | null,
      referenceId: data.reference_id as string | null,
      description: data.description as string | null,
      metadata: (data.metadata as Record<string, unknown>) || {},
      createdBy: data.created_by as string | null,
      ipAddress: data.ip_address as string | null,
      createdAt: data.created_at as string,
    };
  }

  private mapFreezeRequest(data: Record<string, unknown>): FreezeRequest {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      siteId: data.site_id as string,
      walletId: data.wallet_id as string | null,
      amount: data.amount as number | null,
      reason: data.reason as string,
      status: data.status as 'active' | 'released' | 'expired',
      frozenAt: data.frozen_at as string,
      frozenBy: data.frozen_by as string,
      frozenByName: data.frozen_by_name as string | null,
      releasedAt: data.released_at as string | null,
      releasedBy: data.released_by as string | null,
      releaseReason: data.release_reason as string | null,
      autoReleaseAt: data.auto_release_at as string | null,
    };
  }
}

// Factory function
export async function createMultiWalletService() {
  const supabase = await createClient();
  return new MultiWalletService(supabase);
}
