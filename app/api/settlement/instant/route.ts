import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addCredit } from '@/lib/wallet-ledger';

/**
 * Instant Settlement API
 * ตัดยอดและจ่ายรางวัลให้ลูกสายงานทั้งหมดโดยอัตโนมัติ
 * ออกแบบให้ทำงานภายใน 1 วินาที
 */

interface SettlementResult {
  customerId: string;
  customerName: string;
  agentId?: string;
  winAmount: number;
  status: 'success' | 'failed';
  transactionId?: string;
  error?: string;
}

// Lock to prevent concurrent settlements
const settlementLocks = new Map<string, Promise<any>>();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lotteryId, winningNumbers, performedBy } = body;

    if (!lotteryId || !winningNumbers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Prevent concurrent settlement for same lottery
    const lockKey = `settlement-${lotteryId}`;
    if (settlementLocks.has(lockKey)) {
      return NextResponse.json({ 
        error: 'Settlement in progress for this lottery' 
      }, { status: 409 });
    }

    const settlementPromise = performSettlement(
      supabase, 
      lotteryId, 
      winningNumbers, 
      performedBy
    );
    settlementLocks.set(lockKey, settlementPromise);

    try {
      const result = await settlementPromise;
      const processingTime = Date.now() - startTime;
      
      return NextResponse.json({
        ...result,
        processingTimeMs: processingTime,
      });
    } finally {
      settlementLocks.delete(lockKey);
    }
  } catch (error: any) {
    console.error('Settlement error:', error);
    return NextResponse.json({ 
      error: error.message,
      processingTimeMs: Date.now() - startTime,
    }, { status: 500 });
  }
}

async function performSettlement(
  supabase: any,
  lotteryId: string,
  winningNumbers: {
    two_top?: string;
    two_bottom?: string;
    three_top?: string;
    three_front?: string;
    run_top?: string[];
    run_bottom?: string[];
  },
  performedBy?: string
) {
  const results: SettlementResult[] = [];
  let totalPayout = 0;
  let successCount = 0;
  let failedCount = 0;

  // Get all pending entries for this lottery
  const { data: entries, error: fetchError } = await supabase
    .from('entries')
    .select(`
      id,
      customer_id,
      agent_id,
      number,
      amount,
      bet_type,
      status,
      customers!inner(id, name, credit_balance)
    `)
    .eq('lottery_id', lotteryId)
    .eq('status', 'pending');

  if (fetchError) throw fetchError;
  if (!entries || entries.length === 0) {
    return {
      success: true,
      message: 'No pending entries to settle',
      results: [],
      summary: { totalPayout: 0, successCount: 0, failedCount: 0 },
    };
  }

  // Get payout rates
  const { data: rates } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'payout_rates')
    .single();

  const payoutRates = rates?.setting_value || {
    two_top: 95,
    two_bottom: 95,
    three_top: 850,
    three_tod: 140,
    run_top: 3.5,
    run_bottom: 4.5,
  };

  // Process all entries in parallel for speed
  const settlementPromises = entries.map(async (entry: any) => {
    try {
      const isWinner = checkWinner(entry, winningNumbers);
      
      if (isWinner) {
        const winAmount = calculatePayout(entry, payoutRates);
        
        // Credit the customer
        const creditResult = await addCredit({
          customerId: entry.customer_id,
          amount: winAmount,
          type: 'win',
          description: `ถูกรางวัล ${entry.bet_type} เลข ${entry.number} - ${entry.amount}x${getPayoutMultiplier(entry.bet_type, payoutRates)}`,
          referenceId: entry.id,
          referenceType: 'entry',
          performedBy,
        });

        if (creditResult.success) {
          // Update entry status
          await supabase
            .from('entries')
            .update({ 
              status: 'won',
              payout_amount: winAmount,
              settled_at: new Date().toISOString(),
            })
            .eq('id', entry.id);

          return {
            customerId: entry.customer_id,
            customerName: entry.customers?.name || 'Unknown',
            agentId: entry.agent_id,
            winAmount,
            status: 'success' as const,
            transactionId: creditResult.transactionId,
          };
        } else {
          return {
            customerId: entry.customer_id,
            customerName: entry.customers?.name || 'Unknown',
            agentId: entry.agent_id,
            winAmount,
            status: 'failed' as const,
            error: creditResult.error,
          };
        }
      } else {
        // Mark as lost
        await supabase
          .from('entries')
          .update({ 
            status: 'lost',
            settled_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        return null; // No payout for losing entries
      }
    } catch (error: any) {
      return {
        customerId: entry.customer_id,
        customerName: entry.customers?.name || 'Unknown',
        agentId: entry.agent_id,
        winAmount: 0,
        status: 'failed' as const,
        error: error.message,
      };
    }
  });

  const settledResults = await Promise.all(settlementPromises);

  // Filter and aggregate results
  settledResults.forEach(result => {
    if (result) {
      results.push(result);
      if (result.status === 'success') {
        successCount++;
        totalPayout += result.winAmount;
      } else {
        failedCount++;
      }
    }
  });

  // Group payouts by agent for reporting
  const agentPayouts: Record<string, number> = {};
  results.forEach(result => {
    if (result.status === 'success' && result.agentId) {
      agentPayouts[result.agentId] = (agentPayouts[result.agentId] || 0) + result.winAmount;
    }
  });

  // Log settlement activity
  await supabase
    .from('activity_logs')
    .insert({
      action: 'instant_settlement',
      entity_type: 'lottery',
      entity_id: lotteryId,
      details: {
        winningNumbers,
        totalPayout,
        successCount,
        failedCount,
        agentPayouts,
      },
      performed_by: performedBy,
      created_at: new Date().toISOString(),
    });

  return {
    success: true,
    message: `Settlement completed: ${successCount} winners, ${failedCount} failed`,
    results,
    summary: {
      totalPayout,
      successCount,
      failedCount,
      agentPayouts,
      entriesProcessed: entries.length,
    },
  };
}

function checkWinner(entry: any, winningNumbers: any): boolean {
  const { number, bet_type } = entry;
  
  switch (bet_type) {
    case 'two_top':
      return number === winningNumbers.two_top;
    case 'two_bottom':
      return number === winningNumbers.two_bottom;
    case 'three_top':
      return number === winningNumbers.three_top;
    case 'three_tod':
      // Tod wins if the numbers match in any order
      if (!winningNumbers.three_top) return false;
      const sortedEntry = number.split('').sort().join('');
      const sortedWinning = winningNumbers.three_top.split('').sort().join('');
      return sortedEntry === sortedWinning;
    case 'run_top':
      return winningNumbers.run_top?.includes(number) || false;
    case 'run_bottom':
      return winningNumbers.run_bottom?.includes(number) || false;
    default:
      return false;
  }
}

function calculatePayout(entry: any, rates: any): number {
  const { amount, bet_type } = entry;
  const multiplier = getPayoutMultiplier(bet_type, rates);
  return amount * multiplier;
}

function getPayoutMultiplier(betType: string, rates: any): number {
  switch (betType) {
    case 'two_top': return rates.two_top || 95;
    case 'two_bottom': return rates.two_bottom || 95;
    case 'three_top': return rates.three_top || 850;
    case 'three_tod': return rates.three_tod || 140;
    case 'run_top': return rates.run_top || 3.5;
    case 'run_bottom': return rates.run_bottom || 4.5;
    default: return 1;
  }
}
