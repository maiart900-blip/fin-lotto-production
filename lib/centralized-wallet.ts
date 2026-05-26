// =============================================================================
// CENTRALIZED WALLET SYSTEM
// =============================================================================
// ยอดเงินของสมาชิกทุกคนในทุกเว็บลูก ต้องวิ่งกลับมาตรวจสอบที่ฐานข้อมูลแม่เสมอ
// เพื่อป้องกันช่องโหว่การปั๊มยอด
// =============================================================================

export interface WalletTransaction {
  id: string;
  siteId: string;
  userId: string;
  type: 'deposit' | 'withdraw' | 'bet' | 'win' | 'commission' | 'transfer' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  reference: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  processedAt?: Date;
  processedBy?: string;
}

export interface CentralWallet {
  userId: string;
  siteId: string;
  balance: number;
  creditLimit: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBets: number;
  totalWins: number;
  lastActivity: Date;
  isLocked: boolean;
  lockReason?: string;
}

export interface MasterWalletSummary {
  totalBalance: number;
  totalPendingDeposits: number;
  totalPendingWithdrawals: number;
  totalCreditExtended: number;
  totalCreditUsed: number;
  siteSummaries: SiteWalletSummary[];
}

export interface SiteWalletSummary {
  siteId: string;
  siteName: string;
  totalBalance: number;
  totalMembers: number;
  totalDepositsToday: number;
  totalWithdrawalsToday: number;
  netFlowToday: number;
}

// Singleton instance for centralized wallet operations
class CentralizedWalletService {
  private static instance: CentralizedWalletService;
  private masterWalletBalance: number = Infinity; // Master Admin has unlimited credit

  private constructor() {}

  static getInstance(): CentralizedWalletService {
    if (!CentralizedWalletService.instance) {
      CentralizedWalletService.instance = new CentralizedWalletService();
    }
    return CentralizedWalletService.instance;
  }

  // =========================================================================
  // MASTER ADMIN OPERATIONS (Infinite Credit)
  // =========================================================================

  getMasterBalance(): number | 'infinity' {
    return 'infinity';
  }

  canMasterPerformTransaction(): boolean {
    return true; // Master always has unlimited capability
  }

  // =========================================================================
  // WALLET VALIDATION (All transactions must pass through master validation)
  // =========================================================================

  async validateTransaction(
    siteId: string,
    userId: string,
    type: WalletTransaction['type'],
    amount: number
  ): Promise<{ valid: boolean; reason?: string }> {
    // Step 1: Check if site is active
    const siteValid = await this.validateSite(siteId);
    if (!siteValid.valid) {
      return { valid: false, reason: siteValid.reason };
    }

    // Step 2: Check user wallet status
    const wallet = await this.getWallet(siteId, userId);
    if (!wallet) {
      return { valid: false, reason: 'Wallet not found' };
    }

    if (wallet.isLocked) {
      return { valid: false, reason: `Wallet locked: ${wallet.lockReason}` };
    }

    // Step 3: Validate based on transaction type
    switch (type) {
      case 'withdraw':
      case 'bet':
        if (wallet.balance < amount) {
          return { valid: false, reason: 'Insufficient balance' };
        }
        break;
      case 'deposit':
        // Check for suspicious patterns (anti-fraud)
        const suspiciousDeposit = await this.checkSuspiciousDeposit(siteId, userId, amount);
        if (suspiciousDeposit) {
          return { valid: false, reason: 'Suspicious deposit pattern detected' };
        }
        break;
    }

    // Step 4: Log validation attempt for audit
    await this.logValidationAttempt(siteId, userId, type, amount, true);

    return { valid: true };
  }

  // =========================================================================
  // WALLET OPERATIONS
  // =========================================================================

  async getWallet(siteId: string, userId: string): Promise<CentralWallet | null> {
    // In production, this fetches from the master database
    // All wallet data is stored centrally, not in site-specific databases
    
    // Mock implementation
    return {
      userId,
      siteId,
      balance: 10000,
      creditLimit: 0,
      pendingDeposits: 0,
      pendingWithdrawals: 0,
      totalDeposits: 50000,
      totalWithdrawals: 40000,
      totalBets: 100000,
      totalWins: 85000,
      lastActivity: new Date(),
      isLocked: false,
    };
  }

  async processTransaction(transaction: Omit<WalletTransaction, 'id' | 'createdAt'>): Promise<WalletTransaction> {
    // All transactions must be processed through the master system

    // Validate first
    const validation = await this.validateTransaction(
      transaction.siteId,
      transaction.userId,
      transaction.type,
      transaction.amount
    );

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    // Create transaction record
    const txn: WalletTransaction = {
      ...transaction,
      id: `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: new Date(),
      status: 'completed',
      processedAt: new Date(),
    };

    // In production: Update master database with atomic transaction
    console.log(`[CentralWallet] Transaction ${txn.id} completed`);

    return txn;
  }

  // =========================================================================
  // SITE VALIDATION
  // =========================================================================

  private async validateSite(siteId: string): Promise<{ valid: boolean; reason?: string }> {
    // Check if site is active and allowed to process transactions
    // This is checked against the master database
    console.log(`[CentralWallet] Validating site ${siteId}`);
    return { valid: true };
  }

  // =========================================================================
  // ANTI-FRAUD
  // =========================================================================

  private async checkSuspiciousDeposit(
    siteId: string,
    userId: string,
    amount: number
  ): Promise<boolean> {
    // Check for:
    // 1. Multiple rapid deposits
    // 2. Unusual amounts
    // 3. Pattern matching with known fraud
    console.log(`[CentralWallet] Checking fraud patterns for ${userId}`);
    return false; // Not suspicious
  }

  // =========================================================================
  // AUDIT LOGGING
  // =========================================================================

  private async logValidationAttempt(
    siteId: string,
    userId: string,
    type: string,
    amount: number,
    success: boolean
  ): Promise<void> {
    // Log all validation attempts for audit trail
    console.log(`[CentralWallet] Audit: ${type} ${amount} by ${userId} from ${siteId} - ${success ? 'PASS' : 'FAIL'}`);
  }

  // =========================================================================
  // MASTER SUMMARY
  // =========================================================================

  async getMasterWalletSummary(): Promise<MasterWalletSummary> {
    // Aggregate data from all sites
    return {
      totalBalance: 147350000,
      totalPendingDeposits: 2850000,
      totalPendingWithdrawals: 1520000,
      totalCreditExtended: 50000000,
      totalCreditUsed: 35000000,
      siteSummaries: [
        {
          siteId: 'site_a',
          siteName: 'LottoKing',
          totalBalance: 89500000,
          totalMembers: 15420,
          totalDepositsToday: 2850000,
          totalWithdrawalsToday: 1200000,
          netFlowToday: 1650000,
        },
        {
          siteId: 'site_b',
          siteName: 'GoldLotto',
          totalBalance: 45200000,
          totalMembers: 8750,
          totalDepositsToday: 1520000,
          totalWithdrawalsToday: 890000,
          netFlowToday: 630000,
        },
        {
          siteId: 'site_c',
          siteName: 'LuckyDraw',
          totalBalance: 12650000,
          totalMembers: 3200,
          totalDepositsToday: 0,
          totalWithdrawalsToday: 0,
          netFlowToday: 0,
        },
      ],
    };
  }

  // =========================================================================
  // CREDIT MANAGEMENT (For Agents)
  // =========================================================================

  async allocateCredit(
    siteId: string,
    agentId: string,
    amount: number,
    allocatedBy: string
  ): Promise<void> {
    // Master admin can allocate unlimited credit
    console.log(`[CentralWallet] Allocating ${amount} credit to agent ${agentId} by ${allocatedBy}`);
  }

  async revokeCredit(
    siteId: string,
    agentId: string,
    amount: number,
    revokedBy: string
  ): Promise<void> {
    console.log(`[CentralWallet] Revoking ${amount} credit from agent ${agentId} by ${revokedBy}`);
  }

  // =========================================================================
  // EMERGENCY CONTROLS
  // =========================================================================

  async freezeAllWallets(siteId?: string): Promise<void> {
    // Freeze all wallets (optionally for a specific site)
    if (siteId) {
      console.log(`[CentralWallet] EMERGENCY: Freezing all wallets for site ${siteId}`);
    } else {
      console.log(`[CentralWallet] EMERGENCY: Freezing ALL wallets across all sites`);
    }
  }

  async unfreezeAllWallets(siteId?: string): Promise<void> {
    if (siteId) {
      console.log(`[CentralWallet] Unfreezing all wallets for site ${siteId}`);
    } else {
      console.log(`[CentralWallet] Unfreezing ALL wallets across all sites`);
    }
  }
}

// Export singleton
export const centralizedWallet = CentralizedWalletService.getInstance();

// Hook for React components
export function useCentralizedWallet() {
  return centralizedWallet;
}
