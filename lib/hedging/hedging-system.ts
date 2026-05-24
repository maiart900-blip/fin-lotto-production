/**
 * Hedging System - การกระจายความเสี่ยง
 * 
 * สำหรับระบบระดับมืออาชีพ ให้แอดมินสามารถ:
 * - ส่งต่อยอด (Export) ไปเว็บเจ้ามือรายใหญ่
 * - กินส่วนต่างกินหัวคิว (Commission)
 * - ไม่ต้องแบกความเสี่ยงเอง
 */

import { createClient } from '@/lib/supabase/server';
import { redis, PUBSUB_CHANNELS } from '@/lib/redis';
import { sendLineAlert } from '@/lib/notifications/line-notify';

// Types
export interface HedgingPartner {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  status: 'active' | 'inactive';
  commissionRate: number; // % ที่เราได้จาก Partner
  minAmount: number;
  maxAmount: number;
  supportedMarkets: string[];
  lastSyncAt?: string;
}

export interface HedgingOrder {
  id?: string;
  partnerId: string;
  partnerName: string;
  lotteryId: string;
  lotteryName: string;
  number: string;
  betType: string;
  amount: number;
  originalRate: number;
  partnerRate: number;
  commissionAmount: number;
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'settled';
  partnerReference?: string;
  sentAt?: string;
  respondedAt?: string;
  settledAt?: string;
  error?: string;
}

export interface HedgingStats {
  totalExported: number;
  totalCommission: number;
  pendingAmount: number;
  successRate: number;
  partnerBreakdown: {
    partnerId: string;
    partnerName: string;
    amount: number;
    commission: number;
  }[];
}

// Redis Keys
const HEDGING_KEYS = {
  PARTNERS: 'hedging:partners',
  PENDING_ORDERS: 'hedging:orders:pending',
  ORDER: (orderId: string) => `hedging:order:${orderId}`,
  DAILY_STATS: (date: string) => `hedging:stats:${date}`,
};

/**
 * =============================================
 * PARTNER MANAGEMENT
 * =============================================
 */

// Get all hedging partners
export async function getHedgingPartners(): Promise<HedgingPartner[]> {
  try {
    const cached = await redis.get(HEDGING_KEYS.PARTNERS);
    if (cached) {
      return typeof cached === 'string' ? JSON.parse(cached) : cached;
    }

    const supabase = await createClient();
    const { data: partners } = await supabase
      .from('hedging_partners')
      .select('*')
      .eq('status', 'active');

    if (!partners) return [];

    const formattedPartners: HedgingPartner[] = partners.map(p => ({
      id: p.id,
      name: p.name,
      apiUrl: p.api_url,
      apiKey: p.api_key,
      status: p.status,
      commissionRate: p.commission_rate,
      minAmount: p.min_amount,
      maxAmount: p.max_amount,
      supportedMarkets: p.supported_markets || [],
      lastSyncAt: p.last_sync_at,
    }));

    await redis.set(HEDGING_KEYS.PARTNERS, JSON.stringify(formattedPartners), { ex: 300 });
    return formattedPartners;
  } catch (error) {
    console.error('Error getting hedging partners:', error);
    return [];
  }
}

// Check if partner supports market
export async function findSuitablePartner(
  lotteryId: string,
  amount: number
): Promise<HedgingPartner | null> {
  const partners = await getHedgingPartners();
  
  return partners.find(p => 
    p.status === 'active' &&
    p.minAmount <= amount &&
    p.maxAmount >= amount &&
    (p.supportedMarkets.length === 0 || p.supportedMarkets.includes(lotteryId))
  ) || null;
}

/**
 * =============================================
 * EXPORT OPERATIONS
 * ส่งต่อยอดไปยัง Partner
 * =============================================
 */

// Export bet to hedging partner
export async function exportBetToPartner(
  partnerId: string,
  betData: {
    lotteryId: string;
    lotteryName: string;
    number: string;
    betType: string;
    amount: number;
    originalRate: number;
  }
): Promise<{ success: boolean; order?: HedgingOrder; error?: string }> {
  try {
    const partners = await getHedgingPartners();
    const partner = partners.find(p => p.id === partnerId);

    if (!partner) {
      return { success: false, error: 'Partner not found' };
    }

    if (partner.status !== 'active') {
      return { success: false, error: 'Partner is inactive' };
    }

    if (betData.amount < partner.minAmount || betData.amount > partner.maxAmount) {
      return { success: false, error: `Amount must be between ${partner.minAmount} and ${partner.maxAmount}` };
    }

    // Create order
    const orderId = `HO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const commissionAmount = betData.amount * (partner.commissionRate / 100);

    const order: HedgingOrder = {
      id: orderId,
      partnerId: partner.id,
      partnerName: partner.name,
      lotteryId: betData.lotteryId,
      lotteryName: betData.lotteryName,
      number: betData.number,
      betType: betData.betType,
      amount: betData.amount,
      originalRate: betData.originalRate,
      partnerRate: betData.originalRate, // Assume same rate
      commissionAmount,
      status: 'pending',
      sentAt: new Date().toISOString(),
    };

    // Send to partner API
    const result = await sendToPartnerAPI(partner, order);

    if (result.success) {
      order.status = 'sent';
      order.partnerReference = result.reference;
    } else {
      order.status = 'rejected';
      order.error = result.error;
    }

    // Save order to database
    const supabase = await createClient();
    await supabase.from('hedging_orders').insert({
      id: orderId,
      partner_id: partnerId,
      partner_name: partner.name,
      lottery_id: betData.lotteryId,
      lottery_name: betData.lotteryName,
      number: betData.number,
      bet_type: betData.betType,
      amount: betData.amount,
      original_rate: betData.originalRate,
      partner_rate: betData.originalRate,
      commission_amount: commissionAmount,
      status: order.status,
      partner_reference: order.partnerReference,
      sent_at: order.sentAt,
      error: order.error,
    });

    // Cache order
    await redis.set(HEDGING_KEYS.ORDER(orderId), JSON.stringify(order), { ex: 86400 });

    // Update daily stats
    await updateHedgingStats(betData.amount, commissionAmount, order.status === 'sent');

    return { success: result.success, order, error: result.error };
  } catch (error) {
    console.error('Error exporting bet to partner:', error);
    return { success: false, error: 'System error' };
  }
}

// Send request to partner API
async function sendToPartnerAPI(
  partner: HedgingPartner,
  order: HedgingOrder
): Promise<{ success: boolean; reference?: string; error?: string }> {
  try {
    const response = await fetch(`${partner.apiUrl}/api/receive-bet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': partner.apiKey,
      },
      body: JSON.stringify({
        orderId: order.id,
        lotteryId: order.lotteryId,
        number: order.number,
        betType: order.betType,
        amount: order.amount,
        rate: order.originalRate,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return { success: false, error: `Partner returned ${response.status}` };
    }

    const data = await response.json();
    return { 
      success: data.success || data.status === 'accepted',
      reference: data.reference || data.orderId,
      error: data.error,
    };
  } catch (error: any) {
    console.error('Partner API error:', error);
    
    // For demo/development, simulate success
    if (process.env.NODE_ENV === 'development') {
      return {
        success: true,
        reference: `DEMO-${Date.now()}`,
      };
    }
    
    return { success: false, error: error.message || 'Connection failed' };
  }
}

// Bulk export multiple bets
export async function bulkExportBets(
  partnerId: string,
  bets: Array<{
    lotteryId: string;
    lotteryName: string;
    number: string;
    betType: string;
    amount: number;
    originalRate: number;
  }>
): Promise<{
  success: boolean;
  exported: number;
  failed: number;
  totalAmount: number;
  totalCommission: number;
  orders: HedgingOrder[];
  errors: string[];
}> {
  const orders: HedgingOrder[] = [];
  const errors: string[] = [];
  let exported = 0;
  let failed = 0;
  let totalAmount = 0;
  let totalCommission = 0;

  for (const bet of bets) {
    const result = await exportBetToPartner(partnerId, bet);
    
    if (result.success && result.order) {
      orders.push(result.order);
      exported++;
      totalAmount += bet.amount;
      totalCommission += result.order.commissionAmount;
    } else {
      errors.push(`${bet.number}: ${result.error}`);
      failed++;
    }
  }

  // Send LINE notification
  if (exported > 0) {
    await sendLineAlert(
      'system_alert',
      'Hedging Export Complete',
      {
        'Exported': `${exported} bets`,
        'Total': `${totalAmount.toLocaleString()} THB`,
        'Commission': `${totalCommission.toLocaleString()} THB`,
      }
    );
  }

  return {
    success: failed === 0,
    exported,
    failed,
    totalAmount,
    totalCommission,
    orders,
    errors,
  };
}

/**
 * =============================================
 * AUTO HEDGING
 * ระบบ Hedge อัตโนมัติเมื่อเกิน Threshold
 * =============================================
 */

export interface AutoHedgingConfig {
  enabled: boolean;
  triggerThreshold: number; // % of liability limit
  hedgePercent: number; // % of excess to hedge
  preferredPartner?: string;
}

// Check and auto-hedge if needed
export async function checkAndAutoHedge(
  lotteryId: string,
  lotteryName: string,
  number: string,
  betType: string,
  currentVolume: number,
  limitAmount: number,
  rate: number
): Promise<{ hedged: boolean; order?: HedgingOrder }> {
  try {
    // Get auto-hedging config
    const supabase = await createClient();
    const { data: config } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'auto_hedging_config')
      .single();

    const hedgingConfig: AutoHedgingConfig = config?.setting_value || {
      enabled: false,
      triggerThreshold: 80,
      hedgePercent: 50,
    };

    if (!hedgingConfig.enabled) {
      return { hedged: false };
    }

    const usagePercent = (currentVolume / limitAmount) * 100;
    
    if (usagePercent < hedgingConfig.triggerThreshold) {
      return { hedged: false };
    }

    // Calculate amount to hedge
    const excessAmount = currentVolume - (limitAmount * hedgingConfig.triggerThreshold / 100);
    const hedgeAmount = excessAmount * (hedgingConfig.hedgePercent / 100);

    if (hedgeAmount <= 0) {
      return { hedged: false };
    }

    // Find suitable partner
    const partner = hedgingConfig.preferredPartner 
      ? (await getHedgingPartners()).find(p => p.id === hedgingConfig.preferredPartner)
      : await findSuitablePartner(lotteryId, hedgeAmount);

    if (!partner) {
      await sendLineAlert(
        'risk_warning',
        'Auto-Hedge Failed',
        {
          'Number': number,
          'Amount': hedgeAmount.toLocaleString(),
          'Reason': 'No suitable partner found',
        }
      );
      return { hedged: false };
    }

    // Execute hedge
    const result = await exportBetToPartner(partner.id, {
      lotteryId,
      lotteryName,
      number,
      betType,
      amount: hedgeAmount,
      originalRate: rate,
    });

    return { hedged: result.success, order: result.order };
  } catch (error) {
    console.error('Auto-hedge error:', error);
    return { hedged: false };
  }
}

/**
 * =============================================
 * STATISTICS & REPORTING
 * =============================================
 */

// Update daily hedging stats
async function updateHedgingStats(
  amount: number,
  commission: number,
  success: boolean
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = HEDGING_KEYS.DAILY_STATS(today);

  try {
    const existing = await redis.get(key);
    const stats = existing 
      ? (typeof existing === 'string' ? JSON.parse(existing) : existing)
      : { exported: 0, commission: 0, success: 0, failed: 0 };

    stats.exported += amount;
    stats.commission += commission;
    if (success) {
      stats.success++;
    } else {
      stats.failed++;
    }

    await redis.set(key, JSON.stringify(stats), { ex: 86400 * 7 }); // Keep 7 days
  } catch (error) {
    console.error('Error updating hedging stats:', error);
  }
}

// Get hedging statistics
export async function getHedgingStats(date?: string): Promise<HedgingStats> {
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const supabase = await createClient();
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data: orders } = await supabase
      .from('hedging_orders')
      .select('*')
      .gte('sent_at', startOfDay)
      .lte('sent_at', endOfDay);

    if (!orders || orders.length === 0) {
      return {
        totalExported: 0,
        totalCommission: 0,
        pendingAmount: 0,
        successRate: 0,
        partnerBreakdown: [],
      };
    }

    let totalExported = 0;
    let totalCommission = 0;
    let pendingAmount = 0;
    let successCount = 0;
    const partnerMap = new Map<string, { name: string; amount: number; commission: number }>();

    orders.forEach(order => {
      totalExported += order.amount;
      totalCommission += order.commission_amount;

      if (order.status === 'pending' || order.status === 'sent') {
        pendingAmount += order.amount;
      }

      if (order.status === 'accepted' || order.status === 'settled') {
        successCount++;
      }

      const existing = partnerMap.get(order.partner_id) || {
        name: order.partner_name,
        amount: 0,
        commission: 0,
      };
      existing.amount += order.amount;
      existing.commission += order.commission_amount;
      partnerMap.set(order.partner_id, existing);
    });

    return {
      totalExported,
      totalCommission,
      pendingAmount,
      successRate: orders.length > 0 ? (successCount / orders.length) * 100 : 0,
      partnerBreakdown: Array.from(partnerMap.entries()).map(([id, data]) => ({
        partnerId: id,
        partnerName: data.name,
        amount: data.amount,
        commission: data.commission,
      })),
    };
  } catch (error) {
    console.error('Error getting hedging stats:', error);
    return {
      totalExported: 0,
      totalCommission: 0,
      pendingAmount: 0,
      successRate: 0,
      partnerBreakdown: [],
    };
  }
}

// Get pending hedging orders
export async function getPendingHedgingOrders(): Promise<HedgingOrder[]> {
  try {
    const supabase = await createClient();
    const { data: orders } = await supabase
      .from('hedging_orders')
      .select('*')
      .in('status', ['pending', 'sent'])
      .order('sent_at', { ascending: false })
      .limit(100);

    if (!orders) return [];

    return orders.map(o => ({
      id: o.id,
      partnerId: o.partner_id,
      partnerName: o.partner_name,
      lotteryId: o.lottery_id,
      lotteryName: o.lottery_name,
      number: o.number,
      betType: o.bet_type,
      amount: o.amount,
      originalRate: o.original_rate,
      partnerRate: o.partner_rate,
      commissionAmount: o.commission_amount,
      status: o.status,
      partnerReference: o.partner_reference,
      sentAt: o.sent_at,
      error: o.error,
    }));
  } catch (error) {
    console.error('Error getting pending orders:', error);
    return [];
  }
}
