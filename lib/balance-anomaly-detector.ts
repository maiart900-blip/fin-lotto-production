/**
 * Balance Anomaly Detection System (ข้อ 71)
 * ตรวจสอบยอดผิดปกติอัตโนมัติ
 * - ยอดเงินติดลบ
 * - เครดิตไม่ตรง
 * - โพยคำนวณผิด
 * - ฝากแล้วเครดิตไม่เข้า
 * - ถอนแล้วเงินไม่ตัด
 */

import { createClient } from '@/lib/supabase/server';
import { auditLogger } from '@/lib/audit-logger';
import { redis, REDIS_KEYS } from '@/lib/redis';
import { sendLineAlert } from '@/lib/notifications/line-notify';

// =============================================
// TYPES
// =============================================

export type AnomalyType = 
  | 'negative_balance'      // ยอดเงินติดลบ
  | 'credit_mismatch'       // เครดิตไม่ตรง
  | 'bet_calculation_error' // โพยคำนวณผิด
  | 'deposit_not_credited'  // ฝากแล้วเครดิตไม่เข้า
  | 'withdraw_not_deducted' // ถอนแล้วเงินไม่ตัด
  | 'balance_inconsistency' // ยอดคงเหลือไม่ตรงกับ ledger
  | 'suspicious_activity'   // พฤติกรรมผิดปกติ
  | 'duplicate_transaction' // รายการซ้ำ
  | 'orphan_transaction';   // รายการไม่มี reference

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BalanceAnomaly {
  id?: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  customer_id?: string;
  customer_phone?: string;
  customer_name?: string;
  agent_id?: string;
  reference_id?: string;
  reference_type?: string;
  expected_amount?: number;
  actual_amount?: number;
  difference?: number;
  description: string;
  details?: Record<string, unknown>;
  detected_at: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

export interface AnomalyCheckResult {
  passed: boolean;
  anomalies: BalanceAnomaly[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

type CustomerRelation = {
  phone: string | null;
  name: string | null;
  agent_id: string | null;
};

function getRelatedCustomer(
  relation: CustomerRelation | CustomerRelation[] | null | undefined
): CustomerRelation | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation ?? null;
}

// =============================================
// ANOMALY DETECTION CLASS
// =============================================

export class BalanceAnomalyDetector {
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  
  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  /**
   * ตรวจสอบทุกประเภทยอดผิดปกติ
   */
  async runFullCheck(): Promise<AnomalyCheckResult> {
    const anomalies: BalanceAnomaly[] = [];
    const now = new Date().toISOString();

    // 1. ตรวจยอดเงินติดลบ
    const negativeBalances = await this.checkNegativeBalances();
    anomalies.push(...negativeBalances);

    // 2. ตรวจเครดิตไม่ตรง
    const creditMismatches = await this.checkCreditMismatch();
    anomalies.push(...creditMismatches);

    // 3. ตรวจฝากแล้วเครดิตไม่เข้า
    const depositNotCredited = await this.checkDepositsNotCredited();
    anomalies.push(...depositNotCredited);

    // 4. ตรวจถอนแล้วเงินไม่ตัด
    const withdrawNotDeducted = await this.checkWithdrawalsNotDeducted();
    anomalies.push(...withdrawNotDeducted);

    // 5. ตรวจโพยคำนวณผิด
    const betErrors = await this.checkBetCalculationErrors();
    anomalies.push(...betErrors);

    // บันทึกผลและแจ้งเตือน
    if (anomalies.length > 0) {
      await this.saveAnomalies(anomalies);
      await this.notifyAnomalies(anomalies);
    }

    // สรุปผล
    const summary = {
      total: anomalies.length,
      critical: anomalies.filter(a => a.severity === 'critical').length,
      high: anomalies.filter(a => a.severity === 'high').length,
      medium: anomalies.filter(a => a.severity === 'medium').length,
      low: anomalies.filter(a => a.severity === 'low').length,
    };

    return {
      passed: anomalies.length === 0,
      anomalies,
      summary,
    };
  }

  /**
   * 1. ตรวจยอดเงินติดลบ
   */
  async checkNegativeBalances(): Promise<BalanceAnomaly[]> {
    const supabase = await this.getClient();
    const anomalies: BalanceAnomaly[] = [];
    const now = new Date().toISOString();

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, phone, name, balance, agent_id')
      .lt('balance', 0);

    if (error || !customers) return anomalies;

    for (const customer of customers) {
      anomalies.push({
        type: 'negative_balance',
        severity: Math.abs(customer.balance) > 10000 ? 'critical' : 'high',
        customer_id: customer.id,
        customer_phone: customer.phone,
        customer_name: customer.name,
        agent_id: customer.agent_id,
        expected_amount: 0,
        actual_amount: customer.balance,
        difference: customer.balance,
        description: `ลูกค้า ${customer.phone} มียอดเงินติดลบ ${customer.balance.toLocaleString()} บาท`,
        detected_at: now,
        resolved: false,
      });
    }

    return anomalies;
  }

  /**
   * 2. ตรวจเครดิตไม่ตรงกับ Ledger
   */
  async checkCreditMismatch(): Promise<BalanceAnomaly[]> {
    const supabase = await this.getClient();
    const anomalies: BalanceAnomaly[] = [];
    const now = new Date().toISOString();

    // คำนวณยอดจาก transactions และเทียบกับ balance
    const { data: mismatches, error } = await supabase.rpc('check_balance_mismatch');

    if (error || !mismatches) return anomalies;

    for (const m of mismatches) {
      const diff = Math.abs(m.balance - m.calculated_balance);
      if (diff > 0.01) { // ต่างกันมากกว่า 1 สตางค์
        anomalies.push({
          type: 'credit_mismatch',
          severity: diff > 1000 ? 'critical' : diff > 100 ? 'high' : 'medium',
          customer_id: m.customer_id,
          customer_phone: m.phone,
          customer_name: m.name,
          expected_amount: m.calculated_balance,
          actual_amount: m.balance,
          difference: diff,
          description: `เครดิตไม่ตรง: ควรเป็น ${m.calculated_balance.toLocaleString()} แต่แสดง ${m.balance.toLocaleString()} (ต่าง ${diff.toLocaleString()})`,
          details: { calculated_balance: m.calculated_balance, current_balance: m.balance },
          detected_at: now,
          resolved: false,
        });
      }
    }

    return anomalies;
  }

  /**
   * 3. ตรวจฝากแล้วเครดิตไม่เข้า
   */
  async checkDepositsNotCredited(): Promise<BalanceAnomaly[]> {
    const supabase = await this.getClient();
    const anomalies: BalanceAnomaly[] = [];
    const now = new Date().toISOString();

    // หาการฝากที่สำเร็จแต่ไม่มี transaction record
    const { data: deposits, error } = await supabase
      .from('topup_requests')
      .select(`
        id, customer_id, amount, status, approved_at, 
        customers!inner(phone, name, agent_id)
      `)
      .eq('status', 'approved')
      .gte('approved_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // 24 ชม.

    if (error || !deposits) return anomalies;

    for (const deposit of deposits) {
      // ตรวจว่ามี transaction record หรือไม่
      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .select('id')
        .eq('reference_id', deposit.id)
        .eq('type', 'deposit')
        .single();

      if (txnError || !txn) {
        const customer = getRelatedCustomer(deposit.customers);
        if (!customer) continue;

        anomalies.push({
          type: 'deposit_not_credited',
          severity: 'critical',
          customer_id: deposit.customer_id,
          customer_phone: customer.phone ?? undefined,
          customer_name: customer.name ?? undefined,
          agent_id: customer.agent_id ?? undefined,
          reference_id: deposit.id,
          reference_type: 'topup_request',
          expected_amount: deposit.amount,
          actual_amount: 0,
          difference: deposit.amount,
          description: `ฝากเงิน ${deposit.amount.toLocaleString()} บาท สำเร็จแล้วแต่เครดิตไม่เข้า`,
          details: { deposit_id: deposit.id, approved_at: deposit.approved_at },
          detected_at: now,
          resolved: false,
        });
      }
    }

    return anomalies;
  }

  /**
   * 4. ตรวจถอนแล้วเงินไม่ตัด
   */
  async checkWithdrawalsNotDeducted(): Promise<BalanceAnomaly[]> {
    const supabase = await this.getClient();
    const anomalies: BalanceAnomaly[] = [];
    const now = new Date().toISOString();

    // หาการถอนที่สำเร็จแต่ไม่มี transaction record
    const { data: withdrawals, error } = await supabase
      .from('withdraw_requests')
      .select(`
        id, customer_id, amount, status, approved_at,
        customers!inner(phone, name, agent_id)
      `)
      .eq('status', 'approved')
      .gte('approved_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error || !withdrawals) return anomalies;

    for (const withdrawal of withdrawals) {
      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .select('id')
        .eq('reference_id', withdrawal.id)
        .eq('type', 'withdraw')
        .single();

      if (txnError || !txn) {
        const customer = getRelatedCustomer(withdrawal.customers);
        if (!customer) continue;

        anomalies.push({
          type: 'withdraw_not_deducted',
          severity: 'critical',
          customer_id: withdrawal.customer_id,
          customer_phone: customer.phone ?? undefined,
          customer_name: customer.name ?? undefined,
          agent_id: customer.agent_id ?? undefined,
          reference_id: withdrawal.id,
          reference_type: 'withdraw_request',
          expected_amount: -withdrawal.amount,
          actual_amount: 0,
          difference: withdrawal.amount,
          description: `ถอนเงิน ${withdrawal.amount.toLocaleString()} บาท สำเร็จแล้วแต่เงินไม่ตัด`,
          details: { withdrawal_id: withdrawal.id, approved_at: withdrawal.approved_at },
          detected_at: now,
          resolved: false,
        });
      }
    }

    return anomalies;
  }

  /**
   * 5. ตรวจโพยคำนวณผิด
   */
  async checkBetCalculationErrors(): Promise<BalanceAnomaly[]> {
    const supabase = await this.getClient();
    const anomalies: BalanceAnomaly[] = [];
    const now = new Date().toISOString();

    // หาโพยที่ยอดรวมไม่ตรงกับผลรวมรายการ
    const { data: bets, error } = await supabase
      .from('bets')
      .select(`
        id, customer_id, total_amount, bet_items,
        customers!inner(phone, name, agent_id)
      `)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error || !bets) return anomalies;

    for (const bet of bets) {
      if (!bet.bet_items) continue;

      const items = Array.isArray(bet.bet_items) ? bet.bet_items : [];
      const calculatedTotal = items.reduce((sum: number, item: { amount?: number }) => 
        sum + (item.amount || 0), 0
      );

      const diff = Math.abs(bet.total_amount - calculatedTotal);
      if (diff > 0.01) {
        const customer = getRelatedCustomer(bet.customers);
        if (!customer) continue;

        anomalies.push({
          type: 'bet_calculation_error',
          severity: diff > 100 ? 'high' : 'medium',
          customer_id: bet.customer_id,
          customer_phone: customer.phone ?? undefined,
          customer_name: customer.name ?? undefined,
          agent_id: customer.agent_id ?? undefined,
          reference_id: bet.id,
          reference_type: 'bet',
          expected_amount: calculatedTotal,
          actual_amount: bet.total_amount,
          difference: diff,
          description: `โพยคำนวณผิด: ยอดรวมควรเป็น ${calculatedTotal.toLocaleString()} แต่แสดง ${bet.total_amount.toLocaleString()}`,
          details: { bet_id: bet.id, items_count: items.length },
          detected_at: now,
          resolved: false,
        });
      }
    }

    return anomalies;
  }

  /**
   * บันทึก Anomalies ลงฐานข้อมูล
   */
  async saveAnomalies(anomalies: BalanceAnomaly[]): Promise<void> {
    const supabase = await this.getClient();

    for (const anomaly of anomalies) {
      const { error } = await supabase.from('balance_anomalies').insert({
        type: anomaly.type,
        severity: anomaly.severity,
        customer_id: anomaly.customer_id,
        customer_phone: anomaly.customer_phone,
        customer_name: anomaly.customer_name,
        agent_id: anomaly.agent_id,
        reference_id: anomaly.reference_id,
        reference_type: anomaly.reference_type,
        expected_amount: anomaly.expected_amount,
        actual_amount: anomaly.actual_amount,
        difference: anomaly.difference,
        description: anomaly.description,
        details: anomaly.details,
        detected_at: anomaly.detected_at,
        resolved: false,
      });

      if (!error) {
        await auditLogger.log({
          userId: 'system',
          action: 'ANOMALY_DETECTED',
          tableName: 'balance_anomalies',
          recordId: anomaly.reference_id || anomaly.id || 'system',
          metadata: {
            type: anomaly.type,
            severity: anomaly.severity,
            customer_id: anomaly.customer_id,
            difference: anomaly.difference,
          },
        });
      }
    }
  }

  /**
   * แจ้งเตือน LINE เมื่อพบ Anomaly
   */
  async notifyAnomalies(anomalies: BalanceAnomaly[]): Promise<void> {
    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const highCount = anomalies.filter(a => a.severity === 'high').length;

    if (criticalCount > 0 || highCount > 0) {
      await sendLineAlert('system_alert', 'พบยอดผิดปกติ', {
        'รายการทั้งหมด': `${anomalies.length} รายการ`,
        'วิกฤต (Critical)': `${criticalCount} รายการ`,
        'สูง (High)': `${highCount} รายการ`,
        'ตัวอย่าง': anomalies[0]?.description || '-',
      });
    }
  }

  /**
   * ดึงรายการ Anomalies ที่ยังไม่ได้แก้ไข
   */
  async getUnresolvedAnomalies(
    filters?: {
      type?: AnomalyType;
      severity?: AnomalySeverity;
      customerId?: string;
      agentId?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<BalanceAnomaly[]> {
    const supabase = await this.getClient();

    let query = supabase
      .from('balance_anomalies')
      .select('*')
      .eq('resolved', false)
      .order('detected_at', { ascending: false });

    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
    if (filters?.agentId) query = query.eq('agent_id', filters.agentId);
    if (filters?.fromDate) query = query.gte('detected_at', filters.fromDate);
    if (filters?.toDate) query = query.lte('detected_at', filters.toDate);

    const { data, error } = await query;

    return data || [];
  }

  /**
   * แก้ไข Anomaly
   */
  async resolveAnomaly(
    anomalyId: string,
    resolvedBy: string,
    notes: string
  ): Promise<boolean> {
    const supabase = await this.getClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('balance_anomalies')
      .update({
        resolved: true,
        resolved_at: now,
        resolved_by: resolvedBy,
        resolution_notes: notes,
      })
      .eq('id', anomalyId);

    if (!error) {
      await auditLogger.log({
        userId: resolvedBy,
        action: 'ANOMALY_RESOLVED',
        tableName: 'balance_anomalies',
        recordId: anomalyId,
        metadata: { notes },
      });
    }

    return !error;
  }
}

// Export singleton instance
export const balanceAnomalyDetector = new BalanceAnomalyDetector();