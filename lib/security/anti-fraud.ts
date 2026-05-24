/**
 * Anti-Fraud System for FIN LOTTO R+
 * ตรวจจับพฤติกรรมผิดปกติและป้องกันการฉ้อโกง
 */

import { createClient } from '@/lib/supabase/server';
import { redis, REDIS_KEYS } from '@/lib/redis';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface FraudCheckResult {
  passed: boolean;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: FraudFlag[];
  action: 'allow' | 'review' | 'block';
  message?: string;
}

export interface FraudFlag {
  type: string;
  severity: 'warning' | 'danger' | 'critical';
  description: string;
  timestamp: string;
}

export interface BettingPattern {
  customerId: string;
  totalBets: number;
  totalAmount: number;
  uniqueNumbers: number;
  avgBetSize: number;
  maxBetSize: number;
  timeSpan: number; // minutes
  ipAddresses: string[];
  devices: string[];
}

export interface SlipVerificationResult {
  valid: boolean;
  isDuplicate: boolean;
  matchedTransaction?: {
    amount: number;
    reference: string;
    timestamp: string;
  };
  confidence: number;
  flags: string[];
}

// =============================================
// FRAUD DETECTION THRESHOLDS
// =============================================

const THRESHOLDS = {
  // Betting patterns
  MAX_BETS_PER_MINUTE: 10,
  MAX_BETS_PER_HOUR: 100,
  MAX_SAME_NUMBER_BETS: 5,
  MAX_BET_AMOUNT_SINGLE: 100000,
  MAX_BET_AMOUNT_HOURLY: 500000,
  
  // IP & Device
  MAX_IPS_PER_ACCOUNT: 3,
  MAX_ACCOUNTS_PER_IP: 5,
  MAX_DEVICES_PER_ACCOUNT: 3,
  
  // Slip verification
  SLIP_DUPLICATE_WINDOW_HOURS: 24,
  MIN_SLIP_CONFIDENCE: 0.8,
  
  // Risk scores
  RISK_SCORE_REVIEW: 50,
  RISK_SCORE_BLOCK: 80,
};

// =============================================
// ANTI-FRAUD CORE FUNCTIONS
// =============================================

/**
 * ตรวจสอบการแทงที่ผิดปกติ
 */
export async function checkBettingFraud(
  customerId: string,
  betAmount: number,
  number: string,
  ipAddress: string,
  deviceId: string
): Promise<FraudCheckResult> {
  const flags: FraudFlag[] = [];
  let riskScore = 0;

  try {
    // 1. Check betting frequency
    const frequencyCheck = await checkBettingFrequency(customerId);
    if (frequencyCheck.exceeded) {
      riskScore += 30;
      flags.push({
        type: 'high_frequency',
        severity: 'warning',
        description: `แทงเร็วผิดปกติ: ${frequencyCheck.count} ครั้งใน ${frequencyCheck.window}`,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Check bet amount
    if (betAmount > THRESHOLDS.MAX_BET_AMOUNT_SINGLE) {
      riskScore += 20;
      flags.push({
        type: 'high_amount',
        severity: 'warning',
        description: `ยอดแทงสูงผิดปกติ: ${betAmount.toLocaleString()} บาท`,
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Check same number pattern
    const sameNumberCount = await checkSameNumberBets(customerId, number);
    if (sameNumberCount > THRESHOLDS.MAX_SAME_NUMBER_BETS) {
      riskScore += 25;
      flags.push({
        type: 'same_number_spam',
        severity: 'danger',
        description: `แทงเลขซ้ำ ${number} จำนวน ${sameNumberCount} ครั้ง`,
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Check IP anomaly
    const ipCheck = await checkIPAnomaly(customerId, ipAddress);
    if (ipCheck.suspicious) {
      riskScore += ipCheck.score;
      flags.push({
        type: 'ip_anomaly',
        severity: ipCheck.score > 30 ? 'danger' : 'warning',
        description: ipCheck.reason,
        timestamp: new Date().toISOString(),
      });
    }

    // 5. Check device anomaly
    const deviceCheck = await checkDeviceAnomaly(customerId, deviceId);
    if (deviceCheck.suspicious) {
      riskScore += deviceCheck.score;
      flags.push({
        type: 'device_anomaly',
        severity: deviceCheck.score > 30 ? 'danger' : 'warning',
        description: deviceCheck.reason,
        timestamp: new Date().toISOString(),
      });
    }

    // 6. Check hourly limit
    const hourlyTotal = await getHourlyBetTotal(customerId);
    if (hourlyTotal + betAmount > THRESHOLDS.MAX_BET_AMOUNT_HOURLY) {
      riskScore += 35;
      flags.push({
        type: 'hourly_limit_exceeded',
        severity: 'critical',
        description: `ยอดแทงรายชั่วโมงเกิน: ${(hourlyTotal + betAmount).toLocaleString()} บาท`,
        timestamp: new Date().toISOString(),
      });
    }

    // Determine risk level and action
    const riskLevel = getRiskLevel(riskScore);
    const action = getAction(riskScore);

    // Log fraud check
    await logFraudCheck(customerId, riskScore, flags, action);

    return {
      passed: action === 'allow',
      riskScore,
      riskLevel,
      flags,
      action,
      message: action === 'block' ? 'ระบบตรวจพบความผิดปกติ กรุณาติดต่อแอดมิน' : undefined,
    };
  } catch (error) {
    console.error('Fraud check error:', error);
    return {
      passed: true,
      riskScore: 0,
      riskLevel: 'low',
      flags: [],
      action: 'allow',
    };
  }
}

/**
 * ตรวจสอบสลิปโอนเงิน
 */
export async function verifySlip(
  slipData: {
    imageUrl?: string;
    amount: number;
    reference?: string;
    bankCode?: string;
    timestamp?: string;
  },
  customerId: string
): Promise<SlipVerificationResult> {
  const flags: string[] = [];
  let confidence = 1.0;

  try {
    const supabase = await createClient();

    // 1. Check for duplicate slip
    const { data: existingSlip } = await supabase
      .from('transactions')
      .select('id, reference_id, amount, created_at')
      .eq('reference_id', slipData.reference)
      .gte('created_at', new Date(Date.now() - THRESHOLDS.SLIP_DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000).toISOString())
      .single();

    if (existingSlip) {
      return {
        valid: false,
        isDuplicate: true,
        matchedTransaction: {
          amount: existingSlip.amount,
          reference: existingSlip.reference_id,
          timestamp: existingSlip.created_at,
        },
        confidence: 1.0,
        flags: ['DUPLICATE_SLIP'],
      };
    }

    // 2. Check amount consistency
    const { data: pendingDeposit } = await supabase
      .from('topup_requests')
      .select('id, amount')
      .eq('customer_id', customerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pendingDeposit && pendingDeposit.amount !== slipData.amount) {
      confidence -= 0.3;
      flags.push('AMOUNT_MISMATCH');
    }

    // 3. Check timestamp (slip should be recent)
    if (slipData.timestamp) {
      const slipTime = new Date(slipData.timestamp).getTime();
      const now = Date.now();
      const hoursDiff = (now - slipTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        confidence -= 0.2;
        flags.push('OLD_SLIP');
      }
    }

    // 4. Check for suspicious patterns
    const recentSlips = await getRecentSlipCount(customerId);
    if (recentSlips > 10) {
      confidence -= 0.2;
      flags.push('HIGH_SLIP_FREQUENCY');
    }

    return {
      valid: confidence >= THRESHOLDS.MIN_SLIP_CONFIDENCE,
      isDuplicate: false,
      confidence,
      flags,
    };
  } catch (error) {
    console.error('Slip verification error:', error);
    return {
      valid: false,
      isDuplicate: false,
      confidence: 0,
      flags: ['VERIFICATION_ERROR'],
    };
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function checkBettingFrequency(customerId: string): Promise<{ exceeded: boolean; count: number; window: string }> {
  const key = `fraud:betting_freq:${customerId}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }

  return {
    exceeded: count > THRESHOLDS.MAX_BETS_PER_MINUTE,
    count,
    window: '1 นาที',
  };
}

async function checkSameNumberBets(customerId: string, number: string): Promise<number> {
  const key = `fraud:same_number:${customerId}:${number}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour window
  }

  return count;
}

async function checkIPAnomaly(customerId: string, ipAddress: string): Promise<{ suspicious: boolean; score: number; reason: string }> {
  const supabase = await createClient();

  // Check how many IPs this customer has used
  const { data: customerIPs } = await supabase
    .from('customer_sessions')
    .select('ip_address')
    .eq('customer_id', customerId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const uniqueIPs = new Set(customerIPs?.map(s => s.ip_address) || []);
  uniqueIPs.add(ipAddress);

  if (uniqueIPs.size > THRESHOLDS.MAX_IPS_PER_ACCOUNT) {
    return {
      suspicious: true,
      score: 25,
      reason: `ใช้งานจาก ${uniqueIPs.size} IP ที่แตกต่างกันใน 24 ชม.`,
    };
  }

  // Check how many accounts use this IP
  const { count: accountsOnIP } = await supabase
    .from('customer_sessions')
    .select('customer_id', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if ((accountsOnIP || 0) > THRESHOLDS.MAX_ACCOUNTS_PER_IP) {
    return {
      suspicious: true,
      score: 35,
      reason: `IP นี้ถูกใช้โดย ${accountsOnIP} บัญชี`,
    };
  }

  return { suspicious: false, score: 0, reason: '' };
}

async function checkDeviceAnomaly(customerId: string, deviceId: string): Promise<{ suspicious: boolean; score: number; reason: string }> {
  const supabase = await createClient();

  const { data: customerDevices } = await supabase
    .from('customer_sessions')
    .select('device_id')
    .eq('customer_id', customerId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const uniqueDevices = new Set(customerDevices?.map(s => s.device_id) || []);
  uniqueDevices.add(deviceId);

  if (uniqueDevices.size > THRESHOLDS.MAX_DEVICES_PER_ACCOUNT) {
    return {
      suspicious: true,
      score: 20,
      reason: `ใช้งานจาก ${uniqueDevices.size} อุปกรณ์ใน 7 วัน`,
    };
  }

  return { suspicious: false, score: 0, reason: '' };
}

async function getHourlyBetTotal(customerId: string): Promise<number> {
  const key = `fraud:hourly_total:${customerId}`;
  const total = await redis.get(key);
  return Number(total) || 0;
}

async function getRecentSlipCount(customerId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('transaction_type', 'deposit')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return count || 0;
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function getAction(score: number): 'allow' | 'review' | 'block' {
  if (score >= THRESHOLDS.RISK_SCORE_BLOCK) return 'block';
  if (score >= THRESHOLDS.RISK_SCORE_REVIEW) return 'review';
  return 'allow';
}

async function logFraudCheck(
  customerId: string,
  riskScore: number,
  flags: FraudFlag[],
  action: string
): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from('fraud_logs').insert({
    customer_id: customerId,
    risk_score: riskScore,
    flags: flags,
    action,
    created_at: new Date().toISOString(),
  });
}

// =============================================
// EXPORTS
// =============================================

export const AntiFraud = {
  checkBettingFraud,
  verifySlip,
  THRESHOLDS,
};
