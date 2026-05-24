/**
 * Duplicate Detection System (ข้อ 74, 77)
 * - ระบบตรวจโพยซ้ำ (ข้อ 74)
 * - ระบบตรวจสลิปซ้ำ (ข้อ 77)
 */

import { createClient } from '@/lib/supabase/server';
import { redis, REDIS_KEYS } from '@/lib/redis';
import { auditLogger } from '@/lib/audit-logger';

// =============================================
// TYPES
// =============================================

export interface DuplicateBetCheck {
  isDuplicate: boolean;
  confidence: number; // 0-100
  matchedBets: MatchedBet[];
  warning?: string;
  canProceed: boolean;
}

export interface MatchedBet {
  betId: string;
  lotteryId: string;
  lotteryName: string;
  roundId: string;
  numbers: string[];
  totalAmount: number;
  createdAt: string;
  matchScore: number;
}

export interface DuplicateSlipCheck {
  isDuplicate: boolean;
  slipReference: string;
  matchedTransaction?: {
    id: string;
    customerId: string;
    customerPhone: string;
    amount: number;
    usedAt: string;
  };
  confidence: number;
}

export interface BetSubmission {
  customerId: string;
  lotteryId: string;
  roundId: string;
  betItems: {
    number: string;
    type: string;
    amount: number;
  }[];
  totalAmount: number;
}

export interface SlipData {
  reference: string;
  amount: number;
  transactionDate: string;
  bankCode?: string;
  senderAccount?: string;
  hash?: string;
}

// =============================================
// DUPLICATE BET DETECTION
// =============================================

export class DuplicateBetDetector {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  
  // Thresholds
  private readonly DUPLICATE_TIME_WINDOW = 5 * 60 * 1000; // 5 minutes
  private readonly SIMILAR_THRESHOLD = 70; // 70% similar = warning
  private readonly EXACT_THRESHOLD = 95; // 95% similar = block

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  /**
   * ตรวจสอบโพยซ้ำก่อนยืนยัน
   */
  async checkDuplicateBet(submission: BetSubmission): Promise<DuplicateBetCheck> {
    const supabase = await this.getClient();
    const matchedBets: MatchedBet[] = [];

    // Get recent bets from same customer
    const windowStart = new Date(Date.now() - this.DUPLICATE_TIME_WINDOW).toISOString();

    const { data: recentBets } = await supabase
      .from('bets')
      .select(`
        id, lottery_id, round_id, bet_items, total_amount, created_at,
        lotteries!inner(name)
      `)
      .eq('customer_id', submission.customerId)
      .eq('lottery_id', submission.lotteryId)
      .eq('round_id', submission.roundId)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false });

    if (!recentBets || recentBets.length === 0) {
      return {
        isDuplicate: false,
        confidence: 0,
        matchedBets: [],
        canProceed: true,
      };
    }

    // Check each recent bet for similarity
    for (const bet of recentBets) {
      const lottery = bet.lotteries as { name: string };
      const betItems = bet.bet_items as { number: string; type: string; amount: number }[];
      const matchScore = this.calculateSimilarity(submission.betItems, betItems);

      if (matchScore >= this.SIMILAR_THRESHOLD) {
        matchedBets.push({
          betId: bet.id,
          lotteryId: bet.lottery_id,
          lotteryName: lottery?.name || 'Unknown',
          roundId: bet.round_id,
          numbers: betItems.map(i => i.number),
          totalAmount: bet.total_amount,
          createdAt: bet.created_at,
          matchScore,
        });
      }
    }

    const highestMatch = matchedBets.length > 0 
      ? Math.max(...matchedBets.map(b => b.matchScore))
      : 0;

    const isDuplicate = highestMatch >= this.EXACT_THRESHOLD;
    const canProceed = highestMatch < this.EXACT_THRESHOLD;
    
    let warning: string | undefined;
    if (highestMatch >= this.EXACT_THRESHOLD) {
      warning = `พบโพยที่เหมือนกัน ${highestMatch}% ไม่สามารถแทงซ้ำได้`;
    } else if (highestMatch >= this.SIMILAR_THRESHOLD) {
      warning = `พบโพยที่คล้ายกัน ${highestMatch}% คุณต้องการแทงต่อหรือไม่?`;
    }

    // Log detection
    if (matchedBets.length > 0) {
      await auditLogger.log({
        action: 'DUPLICATE_BET_DETECTED',
        resource: 'bet',
        userId: submission.customerId,
        metadata: {
          lottery_id: submission.lotteryId,
          matched_count: matchedBets.length,
          highest_match: highestMatch,
          blocked: isDuplicate,
        },
      });
    }

    return {
      isDuplicate,
      confidence: highestMatch,
      matchedBets,
      warning,
      canProceed,
    };
  }

  /**
   * คำนวณความคล้ายคลึงของโพย
   */
  private calculateSimilarity(
    newItems: { number: string; type: string; amount: number }[],
    existingItems: { number: string; type: string; amount: number }[]
  ): number {
    if (newItems.length === 0 || existingItems.length === 0) return 0;

    // Create maps for comparison
    const newMap = new Map<string, { type: string; amount: number }>();
    newItems.forEach(item => {
      newMap.set(item.number, { type: item.type, amount: item.amount });
    });

    const existingMap = new Map<string, { type: string; amount: number }>();
    existingItems.forEach(item => {
      existingMap.set(item.number, { type: item.type, amount: item.amount });
    });

    // Count matches
    let matchCount = 0;
    let exactMatchCount = 0;

    for (const [number, newData] of newMap) {
      const existingData = existingMap.get(number);
      if (existingData) {
        matchCount++;
        if (existingData.type === newData.type && existingData.amount === newData.amount) {
          exactMatchCount++;
        }
      }
    }

    // Calculate similarity score
    const totalUniqueNumbers = new Set([...newMap.keys(), ...existingMap.keys()]).size;
    const numberMatchRatio = matchCount / totalUniqueNumbers;
    const exactMatchRatio = exactMatchCount / Math.max(newItems.length, existingItems.length);

    // Weighted score: 60% number match + 40% exact match
    return Math.round((numberMatchRatio * 60 + exactMatchRatio * 40));
  }

  /**
   * บันทึกการยืนยันแทงซ้ำ (เมื่อลูกค้ายืนยันว่าต้องการแทงต่อ)
   */
  async confirmDuplicateBet(
    customerId: string,
    betId: string,
    matchedBetIds: string[]
  ): Promise<void> {
    await auditLogger.log({
      action: 'DUPLICATE_BET_CONFIRMED',
      resource: 'bet',
      resourceId: betId,
      userId: customerId,
      metadata: {
        matched_bet_ids: matchedBetIds,
        confirmed_at: new Date().toISOString(),
      },
    });
  }
}

// =============================================
// DUPLICATE SLIP DETECTION
// =============================================

export class DuplicateSlipDetector {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  
  // Duplicate window: 30 days
  private readonly DUPLICATE_WINDOW_DAYS = 30;

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  /**
   * ตรวจสอบสลิปซ้ำ
   */
  async checkDuplicateSlip(slip: SlipData): Promise<DuplicateSlipCheck> {
    const supabase = await this.getClient();

    // Generate slip hash if not provided
    const slipHash = slip.hash || this.generateSlipHash(slip);
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - this.DUPLICATE_WINDOW_DAYS);

    // Check in database
    const { data: existingSlip } = await supabase
      .from('used_slips')
      .select(`
        id, customer_id, amount, used_at, slip_reference,
        customers!inner(phone)
      `)
      .or(`slip_reference.eq.${slip.reference},slip_hash.eq.${slipHash}`)
      .gte('used_at', windowStart.toISOString())
      .single();

    if (existingSlip) {
      const customer = existingSlip.customers as { phone: string };
      
      await auditLogger.log({
        action: 'DUPLICATE_SLIP_DETECTED',
        resource: 'slip',
        resourceId: slip.reference,
        metadata: {
          original_transaction_id: existingSlip.id,
          original_customer: existingSlip.customer_id,
          amount: slip.amount,
        },
      });

      return {
        isDuplicate: true,
        slipReference: slip.reference,
        matchedTransaction: {
          id: existingSlip.id,
          customerId: existingSlip.customer_id,
          customerPhone: customer?.phone || 'Unknown',
          amount: existingSlip.amount,
          usedAt: existingSlip.used_at,
        },
        confidence: 100,
      };
    }

    // Also check Redis cache for recent slips
    const cachedSlip = await redis?.get(`${REDIS_KEYS.USED_SLIP}:${slipHash}`);
    if (cachedSlip) {
      const parsed = JSON.parse(cachedSlip);
      return {
        isDuplicate: true,
        slipReference: slip.reference,
        matchedTransaction: parsed,
        confidence: 100,
      };
    }

    return {
      isDuplicate: false,
      slipReference: slip.reference,
      confidence: 0,
    };
  }

  /**
   * บันทึกสลิปที่ใช้แล้ว
   */
  async markSlipAsUsed(
    slip: SlipData,
    customerId: string,
    topupRequestId: string
  ): Promise<void> {
    const supabase = await this.getClient();
    const slipHash = slip.hash || this.generateSlipHash(slip);
    const now = new Date().toISOString();

    // Save to database
    await supabase.from('used_slips').insert({
      slip_reference: slip.reference,
      slip_hash: slipHash,
      customer_id: customerId,
      topup_request_id: topupRequestId,
      amount: slip.amount,
      transaction_date: slip.transactionDate,
      bank_code: slip.bankCode,
      sender_account: slip.senderAccount,
      used_at: now,
    });

    // Cache in Redis for quick lookup (7 days)
    await redis?.set(
      `${REDIS_KEYS.USED_SLIP}:${slipHash}`,
      JSON.stringify({
        id: topupRequestId,
        customerId,
        amount: slip.amount,
        usedAt: now,
      }),
      { ex: 7 * 24 * 60 * 60 }
    );

    await auditLogger.log({
      action: 'SLIP_MARKED_USED',
      resource: 'slip',
      resourceId: slip.reference,
      userId: customerId,
      metadata: {
        topup_request_id: topupRequestId,
        amount: slip.amount,
        slip_hash: slipHash,
      },
    });
  }

  /**
   * สร้าง hash จากข้อมูลสลิป
   */
  private generateSlipHash(slip: SlipData): string {
    const data = `${slip.reference}|${slip.amount}|${slip.transactionDate}|${slip.bankCode || ''}|${slip.senderAccount || ''}`;
    // Simple hash for demo - in production use crypto
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `slip_${Math.abs(hash).toString(16)}`;
  }

  /**
   * ดึงประวัติสลิปที่ใช้แล้ว
   */
  async getUsedSlips(
    filters?: {
      customerId?: string;
      fromDate?: string;
      toDate?: string;
      reference?: string;
    }
  ): Promise<{
    id: string;
    slip_reference: string;
    customer_id: string;
    amount: number;
    used_at: string;
    customer_phone?: string;
  }[]> {
    const supabase = await this.getClient();

    let query = supabase
      .from('used_slips')
      .select(`
        id, slip_reference, customer_id, amount, used_at,
        customers(phone)
      `)
      .order('used_at', { ascending: false });

    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters?.fromDate) query = query.gte('used_at', filters.fromDate);
    if (filters?.toDate) query = query.lte('used_at', filters.toDate);
    if (filters?.reference) query = query.ilike('slip_reference', `%${filters.reference}%`);

    const { data } = await query.limit(100);

    return data?.map(d => ({
      id: d.id,
      slip_reference: d.slip_reference,
      customer_id: d.customer_id,
      amount: d.amount,
      used_at: d.used_at,
      customer_phone: (d.customers as { phone: string })?.phone,
    })) || [];
  }
}

// Export singletons
export const duplicateBetDetector = new DuplicateBetDetector();
export const duplicateSlipDetector = new DuplicateSlipDetector();
