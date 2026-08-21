/**
 * Financial Auto-Pilot System - FIN LOTTO R+
 * 
 * Automated financial processing:
 * - Auto slip verification
 * - Credit injection
 * - Balance reconciliation
 * - Master ledger logging
 */

import { createClient } from './supabase/server';
import { redis, REDIS_KEYS } from './redis';
import { addCredit } from './wallet-ledger';

export interface SlipData {
  transactionRef: string;
  amount: number;
  senderBank: string;
  senderAccount?: string;
  receiverBank: string;
  receiverAccount: string;
  timestamp: string;
  rawText?: string;
}

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  slipData?: SlipData;
  matchedRequest?: {
    id: string;
    customerId: string;
    amount: number;
  };
  reason?: string;
}

export interface CreditInjectionResult {
  success: boolean;
  customerId?: string;
  amount?: number;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}

/**
 * Mock OCR function - In production, integrate with real OCR service
 * Recommended: Google Cloud Vision, AWS Textract, or Thai-specific OCR
 */
async function extractSlipDataOCR(imageUrl: string): Promise<SlipData | null> {
  // This is a mock implementation
  // In production, call actual OCR API
  console.log('[FinancialAutoPilot] OCR extraction for:', imageUrl);
  
  // Simulate OCR processing
  return null; // Return null to indicate OCR needs real implementation
}

/**
 * Verify slip against pending deposit requests
 */
export async function verifySlip(
  imageUrl: string,
  manualData?: Partial<SlipData>
): Promise<VerificationResult> {
  const supabase = await createClient();
  
  try {
    // Step 1: Extract data from slip (OCR or manual input)
    let slipData: SlipData | null = null;
    
    if (manualData?.transactionRef && manualData?.amount) {
      // Use manual input data
      slipData = {
        transactionRef: manualData.transactionRef,
        amount: manualData.amount,
        senderBank: manualData.senderBank || 'unknown',
        receiverBank: manualData.receiverBank || 'unknown',
        receiverAccount: manualData.receiverAccount || '',
        timestamp: manualData.timestamp || new Date().toISOString(),
      };
    } else {
      // Try OCR extraction
      slipData = await extractSlipDataOCR(imageUrl);
    }
    
    if (!slipData) {
      return {
        verified: false,
        confidence: 0,
        reason: 'ไม่สามารถอ่านข้อมูลจากสลิปได้ กรุณากรอกข้อมูลด้วยตนเอง',
      };
    }
    
    // Step 2: Check for duplicate transaction
    const { data: existingTx } = await supabase
      .from('topup_requests')
      .select('id')
      .eq('transaction_ref', slipData.transactionRef)
      .eq('status', 'approved')
      .single();
    
    if (existingTx) {
      return {
        verified: false,
        confidence: 100,
        slipData,
        reason: 'เลขอ้างอิงนี้ถูกใช้ไปแล้ว (Duplicate Transaction)',
      };
    }
    
    // Step 3: Find matching pending deposit request
    const { data: pendingRequests } = await supabase
      .from('topup_requests')
      .select('id, customer_id, amount, created_at')
      .eq('status', 'pending')
      .gte('amount', slipData.amount * 0.99) // Allow 1% variance
      .lte('amount', slipData.amount * 1.01)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!pendingRequests?.length) {
      return {
        verified: false,
        confidence: 50,
        slipData,
        reason: 'ไม่พบคำขอเติมเงินที่ตรงกับยอดในสลิป',
      };
    }
    
    // Find best match (exact amount + recent time)
    const exactMatch = pendingRequests.find(r => r.amount === slipData!.amount);
    const matchedRequest = exactMatch || pendingRequests[0];
    
    const confidence = exactMatch ? 95 : 75;
    
    return {
      verified: true,
      confidence,
      slipData,
      matchedRequest: {
        id: matchedRequest.id,
        customerId: matchedRequest.customer_id,
        amount: matchedRequest.amount,
      },
    };
  } catch (error) {
    console.error('[FinancialAutoPilot] verifySlip error:', error);
    return {
      verified: false,
      confidence: 0,
      reason: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป',
    };
  }
}

/**
 * Auto-approve and inject credit for verified slip
 */
export async function autoApproveAndCredit(
  requestId: string,
  slipData: SlipData,
  performedBy?: string
): Promise<CreditInjectionResult> {
  const supabase = await createClient();
  
  try {
    // Get request details
    const { data: request, error: fetchError } = await supabase
      .from('topup_requests')
      .select('*, customers(id, username, credit_balance)')
      .eq('id', requestId)
      .single();
    
    if (fetchError || !request) {
      return { success: false, error: 'ไม่พบคำขอเติมเงิน' };
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: 'คำขอนี้ได้รับการดำเนินการแล้ว' };
    }
    
    // Update request status
    const { error: updateError } = await supabase
      .from('topup_requests')
      .update({
        status: 'approved',
        transaction_ref: slipData.transactionRef,
        approved_at: new Date().toISOString(),
        approved_by: performedBy || 'system_auto',
        notes: `Auto-approved via slip verification`,
      })
      .eq('id', requestId);
    
    if (updateError) {
      return { success: false, error: updateError.message };
    }
    
    // Add credit to customer
    const creditResult = await addCredit({
      customerId: request.customer_id,
      amount: request.amount,
      type: 'deposit',
      description: `เติมเงิน (Auto-approved) Ref: ${slipData.transactionRef}`,
      referenceId: requestId,
      referenceType: 'topup_request',
      performedBy: performedBy || 'system_auto',
    });
    
    if (!creditResult.success) {
      // Rollback request status
      await supabase
        .from('topup_requests')
        .update({ status: 'pending', approved_at: null, approved_by: null })
        .eq('id', requestId);
      
      return { success: false, error: creditResult.error };
    }
    
    // Log to master ledger
    await logToMasterLedger({
      type: 'deposit',
      amount: request.amount,
      customerId: request.customer_id,
      agentSiteId: request.agent_site_id,
      transactionRef: slipData.transactionRef,
      requestId,
      performedBy: performedBy || 'system_auto',
    });
    
    return {
      success: true,
      customerId: request.customer_id,
      amount: request.amount,
      newBalance: creditResult.newBalance,
      transactionId: creditResult.transactionId,
    };
  } catch (error) {
    console.error('[FinancialAutoPilot] autoApproveAndCredit error:', error);
    return { success: false, error: 'เกิดข้อผิดพลาดในการเติมเครดิต' };
  }
}

/**
 * Process pending deposits in batch (for cron job)
 */
export async function processPendingDeposits(): Promise<{
  processed: number;
  approved: number;
  failed: number;
}> {
  const supabase = await createClient();
  
  // Get pending requests with slip images
  const { data: pendingRequests } = await supabase
    .from('topup_requests')
    .select('id, amount, slip_url, transaction_ref')
    .eq('status', 'pending')
    .not('slip_url', 'is', null)
    .order('created_at', { ascending: true })
    .limit(50); // Process in batches
  
  if (!pendingRequests?.length) {
    return { processed: 0, approved: 0, failed: 0 };
  }
  
  let approved = 0;
  let failed = 0;
  
  for (const request of pendingRequests) {
    // If transaction_ref already exists, try to verify
    if (request.transaction_ref) {
      const verifyResult = await verifySlip(request.slip_url!, {
        transactionRef: request.transaction_ref,
        amount: request.amount,
      });
      
      if (verifyResult.verified && verifyResult.matchedRequest) {
        const creditResult = await autoApproveAndCredit(
          request.id,
          verifyResult.slipData!,
          'system_auto_batch'
        );
        
        if (creditResult.success) {
          approved++;
        } else {
          failed++;
        }
      }
    }
  }
  
  return {
    processed: pendingRequests.length,
    approved,
    failed,
  };
}

/**
 * Log transaction to Master Ledger
 */
interface MasterLedgerEntry {
  type: 'deposit' | 'withdrawal' | 'bet' | 'payout' | 'adjustment';
  amount: number;
  customerId: string;
  agentSiteId?: string;
  transactionRef?: string;
  requestId?: string;
  performedBy: string;
  notes?: string;
}

export async function logToMasterLedger(entry: MasterLedgerEntry): Promise<void> {
  const supabase = await createClient();
  
  try {
    // Insert to master_ledger table
    await supabase.from('master_ledger').insert({
      transaction_type: entry.type,
      amount: entry.type === 'withdrawal' || entry.type === 'bet' 
        ? -entry.amount 
        : entry.amount,
      customer_id: entry.customerId,
      agent_site_id: entry.agentSiteId,
      transaction_ref: entry.transactionRef,
      reference_id: entry.requestId,
      performed_by: entry.performedBy,
      notes: entry.notes,
      created_at: new Date().toISOString(),
    });
    
    // Update daily summary in Redis
    const today = new Date().toISOString().split('T')[0];
    const summaryKey = `ledger:summary:${today}`;
    
    await redis.hincrby(summaryKey, entry.type, entry.amount);
    await redis.hincrby(summaryKey, 'total_transactions', 1);
    await redis.expire(summaryKey, 86400 * 7); // Keep for 7 days
    
    // Update financial_summary in database (permanent storage)
    await updateFinancialSummary(entry.type, entry.amount, today);
  } catch (error) {
    console.error('[FinancialAutoPilot] logToMasterLedger error:', error);
  }
}

/**
 * Update financial_summary table (permanent storage)
 */
async function updateFinancialSummary(
  type: 'deposit' | 'withdrawal' | 'bet' | 'payout' | 'commission' | 'settlement' | 'adjustment',
  amount: number,
  date: string
): Promise<void> {
  const supabase = await createClient();
  
  try {
    // ดึง summary ปัจจุบันของวันนี้
    const { data: existing } = await supabase
      .from('financial_summary')
      .select('*')
      .eq('period_type', 'daily')
      .eq('period_date', date)
      .is('agent_id', null)
      .is('tenant_id', null)
      .single();
    
    // คำนวณยอดใหม่
    const updates: Record<string, number> = {};
    
    switch (type) {
      case 'deposit':
        updates.total_deposits = (existing?.total_deposits || 0) + amount;
        updates.deposit_count = (existing?.deposit_count || 0) + 1;
        break;
      case 'withdrawal':
        updates.total_withdrawals = (existing?.total_withdrawals || 0) + amount;
        updates.withdrawal_count = (existing?.withdrawal_count || 0) + 1;
        break;
      case 'bet':
        updates.total_bets = (existing?.total_bets || 0) + amount;
        updates.bet_count = (existing?.bet_count || 0) + 1;
        break;
      case 'payout':
        updates.total_payouts = (existing?.total_payouts || 0) + amount;
        updates.payout_count = (existing?.payout_count || 0) + 1;
        break;
      case 'commission':
        updates.total_commissions = (existing?.total_commissions || 0) + amount;
        break;
    }
    
    // คำนวณ net_profit
    const totalBets = updates.total_bets ?? existing?.total_bets ?? 0;
    const totalPayouts = updates.total_payouts ?? existing?.total_payouts ?? 0;
    const totalCommissions = updates.total_commissions ?? existing?.total_commissions ?? 0;
    updates.net_profit = totalBets - totalPayouts - totalCommissions;
    
    // Upsert
    await supabase
      .from('financial_summary')
      .upsert({
        period_type: 'daily',
        period_date: date,
        period_label: date,
        ...updates,
        agent_id: null,
        tenant_id: null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'period_type,period_date,agent_id,tenant_id'
      });
  } catch (error) {
    console.error('[FinancialAutoPilot] updateFinancialSummary error:', error);
  }
}

/**
 * Get daily financial summary (from Redis first, then fallback to database)
 */
export async function getDailySummary(date?: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const targetDate = date || new Date().toISOString().split('T')[0];
  const summaryKey = `ledger:summary:${targetDate}`;
  
  try {
    // Try Redis first
    const redisSummary = await redis.hgetall(summaryKey);
    if (redisSummary && Object.keys(redisSummary).length > 0) {
      return redisSummary as Record<string, number>;
    }
    
    // Fallback to database
    const { data } = await supabase
      .from('financial_summary')
      .select('*')
      .eq('period_type', 'daily')
      .eq('period_date', targetDate)
      .is('agent_id', null)
      .is('tenant_id', null)
      .single();
    
    if (data) {
      return {
        deposit: data.total_deposits || 0,
        withdrawal: data.total_withdrawals || 0,
        bet: data.total_bets || 0,
        payout: data.total_payouts || 0,
        commission: data.total_commissions || 0,
        total_transactions: (data.deposit_count || 0) + (data.withdrawal_count || 0) + (data.bet_count || 0) + (data.payout_count || 0),
        net_profit: data.net_profit || 0,
      };
    }
    
    return {};
  } catch (error) {
    console.error('[FinancialAutoPilot] getDailySummary error:', error);
    return {};
  }
}

/**
 * Get summary by period type (weekly, monthly, yearly)
 */
export async function getSummaryByPeriod(
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly',
  startDate?: string,
  endDate?: string,
  limit: number = 30
): Promise<Record<string, unknown>[]> {
  const supabase = await createClient();
  
  try {
    let query = supabase
      .from('financial_summary')
      .select('*')
      .eq('period_type', periodType)
      .is('agent_id', null)
      .is('tenant_id', null)
      .order('period_date', { ascending: false })
      .limit(limit);
    
    if (startDate) query = query.gte('period_date', startDate);
    if (endDate) query = query.lte('period_date', endDate);
    
    const { data } = await query;
    return data || [];
  } catch (error) {
    console.error('[FinancialAutoPilot] getSummaryByPeriod error:', error);
    return [];
  }
}

/**
 * Reconcile agent site balance with master
 */
export async function reconcileAgentBalance(agentSiteId: string): Promise<{
  agentBalance: number;
  masterBalance: number;
  difference: number;
  status: 'matched' | 'discrepancy';
}> {
  const supabase = await createClient();
  
  // Get agent's reported balance
  const { data: agentSite } = await supabase
    .from('child_sites')
    .select('reported_balance')
    .eq('id', agentSiteId)
    .single();
  
  // Calculate master's view of agent balance from ledger
  const { data: ledgerEntries } = await supabase
    .from('master_ledger')
    .select('amount')
    .eq('agent_site_id', agentSiteId);
  
  const masterBalance = ledgerEntries?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const agentBalance = agentSite?.reported_balance || 0;
  const difference = Math.abs(masterBalance - agentBalance);
  
  return {
    agentBalance,
    masterBalance,
    difference,
    status: difference < 1 ? 'matched' : 'discrepancy',
  };
}

