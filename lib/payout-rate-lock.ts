/**
 * Payout Rate Lock System (ข้อ 73)
 * ระบบล็อกอัตราจ่ายก่อนหวยปิด
 * - กันแอดมินแก้อัตราจ่ายย้อนหลัง
 * - หลังปิดรับแทงแล้วห้ามแก้
 */

import { createClient } from '@/lib/supabase/server';
import { auditLogger } from '@/lib/audit-logger';
import { redis, REDIS_KEYS } from '@/lib/redis';

// =============================================
// TYPES
// =============================================

export interface PayoutRateSnapshot {
  id?: string;
  lottery_id: string;
  lottery_name: string;
  round_id: string;
  round_date: string;
  bet_types: BetTypeRate[];
  locked_at: string;
  locked_by: string;
  is_active: boolean;
  can_modify: boolean;
  modification_deadline: string;
}

export interface BetTypeRate {
  type: string;
  name: string;
  digits: number;
  payout_rate: number;
  max_bet: number;
}

export interface RateLockStatus {
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  reason?: string;
  canOverride: boolean;
  overrideRequires: 'super_admin' | 'dual_approval';
}

export interface RateModificationRequest {
  id?: string;
  lottery_id: string;
  round_id: string;
  bet_type: string;
  old_rate: number;
  new_rate: number;
  requested_by: string;
  requested_at: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

// =============================================
// PAYOUT RATE LOCK SERVICE
// =============================================

export class PayoutRateLockService {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  /**
   * ตรวจสอบว่าอัตราจ่ายถูกล็อกหรือยัง
   */
  async checkLockStatus(lotteryId: string, roundId: string): Promise<RateLockStatus> {
    const supabase = await this.getClient();

    // Check from database
    const { data: snapshot } = await supabase
      .from('payout_rate_snapshots')
      .select('*')
      .eq('lottery_id', lotteryId)
      .eq('round_id', roundId)
      .single();

    if (snapshot && !snapshot.can_modify) {
      return {
        isLocked: true,
        lockedAt: snapshot.locked_at,
        lockedBy: snapshot.locked_by,
        reason: 'หวยปิดรับแทงแล้ว อัตราจ่ายถูกล็อก',
        canOverride: true,
        overrideRequires: 'dual_approval',
      };
    }

    // Check if lottery round is closed
    const { data: round } = await supabase
      .from('lottery_rounds')
      .select('status, close_time')
      .eq('id', roundId)
      .single();

    if (round?.status === 'closed' || round?.status === 'settled') {
      return {
        isLocked: true,
        reason: 'งวดหวยปิดรับแทงแล้ว',
        canOverride: true,
        overrideRequires: 'super_admin',
      };
    }

    // Check if close time passed
    if (round?.close_time && new Date(round.close_time) < new Date()) {
      return {
        isLocked: true,
        reason: 'เลยเวลาปิดรับแทงแล้ว',
        canOverride: true,
        overrideRequires: 'dual_approval',
      };
    }

    return {
      isLocked: false,
      canOverride: false,
      overrideRequires: 'super_admin',
    };
  }

  /**
   * ล็อกอัตราจ่าย (Snapshot)
   */
  async lockRates(
    lotteryId: string,
    roundId: string,
    lockedBy: string
  ): Promise<PayoutRateSnapshot | null> {
    const supabase = await this.getClient();

    // Get current payout rates
    const { data: lottery } = await supabase
      .from('lotteries')
      .select('id, name, payout_rates')
      .eq('id', lotteryId)
      .single();

    if (!lottery) return null;

    const { data: round } = await supabase
      .from('lottery_rounds')
      .select('round_date')
      .eq('id', roundId)
      .single();

    const now = new Date().toISOString();

    // Create snapshot
    const snapshot: PayoutRateSnapshot = {
      lottery_id: lotteryId,
      lottery_name: lottery.name,
      round_id: roundId,
      round_date: round?.round_date || now.split('T')[0],
      bet_types: lottery.payout_rates || [],
      locked_at: now,
      locked_by: lockedBy,
      is_active: true,
      can_modify: false,
      modification_deadline: now, // Already passed
    };

    const { data: saved, error } = await supabase
      .from('payout_rate_snapshots')
      .upsert(snapshot, {
        onConflict: 'lottery_id,round_id',
      })
      .select()
      .single();

    if (!error && saved) {
      // Cache in Redis
      await redis?.set(
        `${REDIS_KEYS.PAYOUT_RATES}:${lotteryId}:${roundId}`,
        JSON.stringify(snapshot),
        { ex: 86400 } // 24 hours
      );

      // Audit log
      await auditLogger.log({
        action: 'PAYOUT_RATES_LOCKED',
        resource: 'payout_rate_snapshot',
        resourceId: `${lotteryId}:${roundId}`,
        userId: lockedBy,
        metadata: {
          lottery_name: lottery.name,
          bet_types_count: snapshot.bet_types.length,
        },
      });

      return saved;
    }

    return null;
  }

  /**
   * พยายามแก้ไขอัตราจ่าย (ต้องผ่านการตรวจสอบ)
   */
  async requestRateModification(
    lotteryId: string,
    roundId: string,
    betType: string,
    newRate: number,
    requestedBy: string,
    reason: string
  ): Promise<{ success: boolean; message: string; requestId?: string }> {
    const supabase = await this.getClient();

    // Check lock status
    const lockStatus = await this.checkLockStatus(lotteryId, roundId);

    if (lockStatus.isLocked) {
      // Create modification request for approval
      const { data: currentRate } = await supabase
        .from('payout_rate_snapshots')
        .select('bet_types')
        .eq('lottery_id', lotteryId)
        .eq('round_id', roundId)
        .single();

      const oldRate = (currentRate?.bet_types as BetTypeRate[])
        ?.find(bt => bt.type === betType)?.payout_rate || 0;

      const request: RateModificationRequest = {
        lottery_id: lotteryId,
        round_id: roundId,
        bet_type: betType,
        old_rate: oldRate,
        new_rate: newRate,
        requested_by: requestedBy,
        requested_at: new Date().toISOString(),
        reason,
        status: 'pending',
      };

      const { data: saved, error } = await supabase
        .from('rate_modification_requests')
        .insert(request)
        .select()
        .single();

      if (!error && saved) {
        await auditLogger.log({
          action: 'RATE_MODIFICATION_REQUESTED',
          resource: 'rate_modification_request',
          resourceId: saved.id,
          userId: requestedBy,
          metadata: {
            lottery_id: lotteryId,
            bet_type: betType,
            old_rate: oldRate,
            new_rate: newRate,
            reason,
          },
        });

        return {
          success: true,
          message: `อัตราจ่ายถูกล็อกแล้ว สร้างคำขอแก้ไขเรียบร้อย รอ ${lockStatus.overrideRequires === 'super_admin' ? 'Super Admin' : 'การอนุมัติ 2 ชั้น'}`,
          requestId: saved.id,
        };
      }

      return { success: false, message: 'ไม่สามารถสร้างคำขอแก้ไขได้' };
    }

    // Not locked, can modify directly
    const { error } = await this.updateRate(lotteryId, roundId, betType, newRate);

    if (!error) {
      await auditLogger.log({
        action: 'PAYOUT_RATE_MODIFIED',
        resource: 'payout_rates',
        resourceId: `${lotteryId}:${roundId}:${betType}`,
        userId: requestedBy,
        metadata: { betType, newRate, reason },
      });

      return { success: true, message: 'อัปเดตอัตราจ่ายเรียบร้อย' };
    }

    return { success: false, message: 'ไม่สามารถอัปเดตอัตราจ่ายได้' };
  }

  /**
   * อนุมัติคำขอแก้ไขอัตราจ่าย (Super Admin only)
   */
  async approveModificationRequest(
    requestId: string,
    approvedBy: string,
    adminRole: string
  ): Promise<{ success: boolean; message: string }> {
    if (adminRole !== 'super_admin') {
      return { success: false, message: 'ต้องเป็น Super Admin เท่านั้น' };
    }

    const supabase = await this.getClient();

    // Get request
    const { data: request } = await supabase
      .from('rate_modification_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (!request) {
      return { success: false, message: 'ไม่พบคำขอหรือคำขอถูกดำเนินการแล้ว' };
    }

    // Update the rate
    const { error: updateError } = await this.updateRate(
      request.lottery_id,
      request.round_id,
      request.bet_type,
      request.new_rate
    );

    if (updateError) {
      return { success: false, message: 'ไม่สามารถอัปเดตอัตราจ่ายได้' };
    }

    // Mark request as approved
    await supabase
      .from('rate_modification_requests')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    await auditLogger.log({
      action: 'RATE_MODIFICATION_APPROVED',
      resource: 'rate_modification_request',
      resourceId: requestId,
      userId: approvedBy,
      metadata: {
        lottery_id: request.lottery_id,
        bet_type: request.bet_type,
        old_rate: request.old_rate,
        new_rate: request.new_rate,
      },
    });

    return { success: true, message: 'อนุมัติการแก้ไขอัตราจ่ายเรียบร้อย' };
  }

  /**
   * ปฏิเสธคำขอแก้ไข
   */
  async rejectModificationRequest(
    requestId: string,
    rejectedBy: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const supabase = await this.getClient();

    const { error } = await supabase
      .from('rate_modification_requests')
      .update({
        status: 'rejected',
        approved_by: rejectedBy, // reused field
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (!error) {
      await auditLogger.log({
        action: 'RATE_MODIFICATION_REJECTED',
        resource: 'rate_modification_request',
        resourceId: requestId,
        userId: rejectedBy,
        metadata: { reason },
      });

      return { success: true, message: 'ปฏิเสธคำขอแก้ไขเรียบร้อย' };
    }

    return { success: false, message: 'ไม่สามารถปฏิเสธคำขอได้' };
  }

  /**
   * ดึงอัตราจ่ายที่ล็อกไว้
   */
  async getLockedRates(
    lotteryId: string,
    roundId: string
  ): Promise<PayoutRateSnapshot | null> {
    // Try cache first
    const cached = await redis?.get(`${REDIS_KEYS.PAYOUT_RATES}:${lotteryId}:${roundId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const supabase = await this.getClient();
    const { data } = await supabase
      .from('payout_rate_snapshots')
      .select('*')
      .eq('lottery_id', lotteryId)
      .eq('round_id', roundId)
      .single();

    return data;
  }

  /**
   * ดึงคำขอแก้ไขที่รออนุมัติ
   */
  async getPendingModificationRequests(): Promise<RateModificationRequest[]> {
    const supabase = await this.getClient();

    const { data } = await supabase
      .from('rate_modification_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    return data || [];
  }

  /**
   * ดึงประวัติการแก้ไขอัตราจ่าย
   */
  async getModificationHistory(
    lotteryId?: string,
    fromDate?: string,
    toDate?: string
  ): Promise<RateModificationRequest[]> {
    const supabase = await this.getClient();

    let query = supabase
      .from('rate_modification_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (lotteryId) query = query.eq('lottery_id', lotteryId);
    if (fromDate) query = query.gte('requested_at', fromDate);
    if (toDate) query = query.lte('requested_at', toDate);

    const { data } = await query;
    return data || [];
  }

  /**
   * Internal: Update rate in database
   */
  private async updateRate(
    lotteryId: string,
    roundId: string,
    betType: string,
    newRate: number
  ) {
    const supabase = await this.getClient();

    // Update in snapshot
    const { data: snapshot } = await supabase
      .from('payout_rate_snapshots')
      .select('bet_types')
      .eq('lottery_id', lotteryId)
      .eq('round_id', roundId)
      .single();

    if (snapshot) {
      const betTypes = (snapshot.bet_types as BetTypeRate[]) || [];
      const updatedTypes = betTypes.map(bt =>
        bt.type === betType ? { ...bt, payout_rate: newRate } : bt
      );

      return await supabase
        .from('payout_rate_snapshots')
        .update({ bet_types: updatedTypes })
        .eq('lottery_id', lotteryId)
        .eq('round_id', roundId);
    }

    // Update in lotteries table
    const { data: lottery } = await supabase
      .from('lotteries')
      .select('payout_rates')
      .eq('id', lotteryId)
      .single();

    if (lottery) {
      const rates = (lottery.payout_rates as BetTypeRate[]) || [];
      const updatedRates = rates.map(r =>
        r.type === betType ? { ...r, payout_rate: newRate } : r
      );

      return await supabase
        .from('lotteries')
        .update({ payout_rates: updatedRates })
        .eq('id', lotteryId);
    }

    return { error: new Error('Lottery not found') };
  }
}

// Export singleton
export const payoutRateLock = new PayoutRateLockService();
