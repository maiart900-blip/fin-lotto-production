/**
 * Financial Auto-Pilot API - FIN LOTTO R+
 * 
 * Endpoints for automated financial processing:
 * - Slip verification
 * - Auto credit injection
 * - Batch processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  verifySlip,
  autoApproveAndCredit,
  processPendingDeposits,
  logToMasterLedger,
  getDailySummary,
  reconcileAgentBalance,
} from '@/lib/financial-autopilot';

// POST - Process financial operations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'verify_slip': {
        const { imageUrl, manualData } = body;
        
        if (!imageUrl && !manualData) {
          return NextResponse.json(
            { error: 'imageUrl or manualData is required' },
            { status: 400 }
          );
        }
        
        const result = await verifySlip(imageUrl, manualData);
        
        return NextResponse.json({
          success: result.verified,
          confidence: result.confidence,
          slipData: result.slipData,
          matchedRequest: result.matchedRequest,
          reason: result.reason,
        });
      }
      
      case 'auto_approve': {
        const { requestId, slipData, performedBy } = body;
        
        if (!requestId || !slipData) {
          return NextResponse.json(
            { error: 'requestId and slipData are required' },
            { status: 400 }
          );
        }
        
        const result = await autoApproveAndCredit(requestId, slipData, performedBy);
        
        // Log activity
        await supabase.from('activity_logs').insert({
          action: result.success ? 'deposit_auto_approved' : 'deposit_auto_failed',
          category: 'financial',
          details: {
            requestId,
            amount: result.amount,
            customerId: result.customerId,
            error: result.error,
          },
          performed_by: performedBy || 'system',
          created_at: new Date().toISOString(),
        });
        
        return NextResponse.json(result);
      }
      
      case 'process_batch': {
        // Batch process pending deposits (for cron job)
        const result = await processPendingDeposits();
        
        // Log batch processing
        await supabase.from('activity_logs').insert({
          action: 'batch_deposit_processing',
          category: 'system',
          details: result,
          performed_by: 'system_cron',
          created_at: new Date().toISOString(),
        });
        
        return NextResponse.json({
          success: true,
          ...result,
        });
      }
      
      case 'log_transaction': {
        const { type, amount, customerId, agentSiteId, transactionRef, requestId, performedBy, notes } = body;
        
        if (!type || !amount || !customerId) {
          return NextResponse.json(
            { error: 'type, amount, and customerId are required' },
            { status: 400 }
          );
        }
        
        await logToMasterLedger({
          type,
          amount,
          customerId,
          agentSiteId,
          transactionRef,
          requestId,
          performedBy: performedBy || 'manual',
          notes,
        });
        
        return NextResponse.json({ success: true });
      }
      
      case 'reconcile': {
        const { agentSiteId } = body;
        
        if (!agentSiteId) {
          return NextResponse.json(
            { error: 'agentSiteId is required' },
            { status: 400 }
          );
        }
        
        const result = await reconcileAgentBalance(agentSiteId);
        
        // Log reconciliation
        await supabase.from('activity_logs').insert({
          action: 'balance_reconciliation',
          category: 'financial',
          details: { agentSiteId, ...result },
          performed_by: body.performedBy || 'system',
          created_at: new Date().toISOString(),
        });
        
        return NextResponse.json(result);
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[FinancialAutoPilot API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get financial summary and status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const date = searchParams.get('date');
  
  try {
    switch (type) {
      case 'daily_summary': {
        const summary = await getDailySummary(date || undefined);
        return NextResponse.json({ summary });
      }
      
      case 'pending_count': {
        const supabase = await createClient();
        
        const [deposits, withdrawals] = await Promise.all([
          supabase
            .from('topup_requests')
            .select('id', { count: 'exact' })
            .eq('status', 'pending'),
          supabase
            .from('withdraw_requests')
            .select('id', { count: 'exact' })
            .eq('status', 'pending'),
        ]);
        
        return NextResponse.json({
          pendingDeposits: deposits.count || 0,
          pendingWithdrawals: withdrawals.count || 0,
        });
      }
      
      case 'recent_transactions': {
        const supabase = await createClient();
        const limit = Number(searchParams.get('limit')) || 20;
        
        const { data: transactions } = await supabase
          .from('master_ledger')
          .select('*, customers(username)')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        return NextResponse.json({ transactions });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('[FinancialAutoPilot API] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
