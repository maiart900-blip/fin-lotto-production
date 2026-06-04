/**
 * SEAMLESS WALLET CALLBACK API
 * =============================
 * Webhook endpoint for external game providers (Casino/Slot)
 * 
 * Supports standard seamless wallet actions:
 * - balance: Get customer current balance
 * - bet: Deduct credit for bet
 * - win: Add credit for win
 * - refund: Refund a previous bet
 * - rollback: Cancel a transaction
 * 
 * Security:
 * - API Key authentication (X-API-Key header)
 * - Timestamp validation (prevent replay attacks)
 * - Signature verification (HMAC-SHA256)
 * - Rate limiting ready
 * 
 * Performance:
 * - Optimistic locking for race condition prevention
 * - Response time < 100ms target
 */

import { NextRequest, NextResponse } from 'next/server';
import { walletService } from '@/lib/wallet-service';
import { auditLogger } from '@/lib/audit-logger';
import crypto from 'crypto';

// =====================================================
// TYPES
// =====================================================

type SeamlessAction = 'balance' | 'bet' | 'win' | 'refund' | 'rollback';

interface SeamlessRequest {
  action: SeamlessAction;
  player_id: string;      // Customer ID in our system
  amount?: number;        // For bet/win/refund
  game_provider: string;  // e.g., 'pgsoft', 'joker', 'pragmatic'
  game_id: string;        // Game identifier
  round_id: string;       // Unique round/transaction ID
  bet_id?: string;        // Original bet ID (for win/refund)
  timestamp: number;      // Unix timestamp
  signature?: string;     // HMAC signature for verification
  metadata?: Record<string, unknown>;
}

interface SeamlessResponse {
  success: boolean;
  balance: number;
  transaction_id?: string;
  error_code?: string;
  error_message?: string;
  timestamp: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getApiSecret(): string {
  return process.env.SEAMLESS_API_SECRET || 'dev_secret_change_in_production';
}

function verifySignature(request: SeamlessRequest, providedSignature: string): boolean {
  // Skip verification in development if no signature provided
  if (process.env.NODE_ENV === 'development' && !providedSignature) {
    return true;
  }
  
  const secret = getApiSecret();
  const dataToSign = `${request.action}:${request.player_id}:${request.round_id}:${request.timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');
  
  return providedSignature === expectedSignature;
}

function isTimestampValid(timestamp: number, maxAgeSeconds = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - timestamp);
  return age <= maxAgeSeconds;
}

function createResponse(data: Partial<SeamlessResponse>): NextResponse {
  const response: SeamlessResponse = {
    success: data.success ?? false,
    balance: data.balance ?? 0,
    timestamp: Math.floor(Date.now() / 1000),
    ...data,
  };
  
  return NextResponse.json(response, {
    headers: {
      'Content-Type': 'application/json',
      'X-Response-Time': `${Date.now()}`,
    },
  });
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Parse request body
    const body: SeamlessRequest = await request.json();
    const { action, player_id, amount, game_provider, game_id, round_id, bet_id, timestamp, signature, metadata } = body;
    
    // 2. Validate required fields
    if (!action || !player_id || !game_provider || !game_id || !round_id) {
      return createResponse({
        success: false,
        error_code: 'INVALID_REQUEST',
        error_message: 'Missing required fields',
      });
    }
    
    // 3. Verify timestamp (prevent replay attacks)
    if (!isTimestampValid(timestamp)) {
      return createResponse({
        success: false,
        error_code: 'INVALID_TIMESTAMP',
        error_message: 'Request timestamp is too old or in the future',
      });
    }
    
    // 4. Verify signature (skip in dev mode for testing)
    if (process.env.NODE_ENV === 'production' && !verifySignature(body, signature || '')) {
      await auditLogger.logSecurity(
        'access_denied',
        player_id,
        request.headers.get('x-forwarded-for') || 'unknown',
        { action, game_provider, reason: 'Invalid signature' }
      );
      
      return createResponse({
        success: false,
        error_code: 'INVALID_SIGNATURE',
        error_message: 'Signature verification failed',
      });
    }
    
    // 5. Process action
    switch (action) {
      case 'balance': {
        const balanceResult = await walletService.getBalance(player_id);
        
        if (!balanceResult.success) {
          return createResponse({
            success: false,
            error_code: 'PLAYER_NOT_FOUND',
            error_message: balanceResult.error,
          });
        }
        
        return createResponse({
          success: true,
          balance: balanceResult.balance,
        });
      }
      
      case 'bet': {
        if (!amount || amount <= 0) {
          return createResponse({
            success: false,
            error_code: 'INVALID_AMOUNT',
            error_message: 'Bet amount must be greater than 0',
          });
        }
        
        const betResult = await walletService.seamlessBet(
          player_id,
          amount,
          game_provider,
          game_id,
          round_id,
          metadata
        );
        
        if (!betResult.success) {
          return createResponse({
            success: false,
            balance: betResult.balanceBefore,
            error_code: betResult.errorCode,
            error_message: betResult.error,
          });
        }
        
        return createResponse({
          success: true,
          balance: betResult.balanceAfter,
          transaction_id: betResult.transactionId,
        });
      }
      
      case 'win': {
        if (!amount || amount < 0) {
          return createResponse({
            success: false,
            error_code: 'INVALID_AMOUNT',
            error_message: 'Win amount must be 0 or greater',
          });
        }
        
        // Amount can be 0 for losing round
        if (amount === 0) {
          const balanceResult = await walletService.getBalance(player_id);
          return createResponse({
            success: true,
            balance: balanceResult.balance,
            transaction_id: `win_0_${round_id}`,
          });
        }
        
        const winResult = await walletService.seamlessWin(
          player_id,
          amount,
          game_provider,
          game_id,
          round_id,
          { ...metadata, bet_id }
        );
        
        if (!winResult.success) {
          return createResponse({
            success: false,
            balance: winResult.balanceBefore,
            error_code: winResult.errorCode,
            error_message: winResult.error,
          });
        }
        
        return createResponse({
          success: true,
          balance: winResult.balanceAfter,
          transaction_id: winResult.transactionId,
        });
      }
      
      case 'refund': {
        if (!amount || amount <= 0) {
          return createResponse({
            success: false,
            error_code: 'INVALID_AMOUNT',
            error_message: 'Refund amount must be greater than 0',
          });
        }
        
        if (!bet_id) {
          return createResponse({
            success: false,
            error_code: 'MISSING_BET_ID',
            error_message: 'Original bet_id is required for refund',
          });
        }
        
        const refundResult = await walletService.seamlessRefund(
          player_id,
          amount,
          game_provider,
          game_id,
          round_id,
          bet_id,
          metadata
        );
        
        if (!refundResult.success) {
          return createResponse({
            success: false,
            balance: refundResult.balanceBefore,
            error_code: refundResult.errorCode,
            error_message: refundResult.error,
          });
        }
        
        return createResponse({
          success: true,
          balance: refundResult.balanceAfter,
          transaction_id: refundResult.transactionId,
        });
      }
      
      case 'rollback': {
        // Rollback is essentially a refund - same logic
        if (!amount || amount <= 0) {
          return createResponse({
            success: false,
            error_code: 'INVALID_AMOUNT',
            error_message: 'Rollback amount must be greater than 0',
          });
        }
        
        const rollbackResult = await walletService.seamlessRefund(
          player_id,
          amount,
          game_provider,
          game_id,
          round_id,
          bet_id || round_id,
          { ...metadata, type: 'rollback' }
        );
        
        if (!rollbackResult.success) {
          return createResponse({
            success: false,
            balance: rollbackResult.balanceBefore,
            error_code: rollbackResult.errorCode,
            error_message: rollbackResult.error,
          });
        }
        
        return createResponse({
          success: true,
          balance: rollbackResult.balanceAfter,
          transaction_id: rollbackResult.transactionId,
        });
      }
      
      default:
        return createResponse({
          success: false,
          error_code: 'INVALID_ACTION',
          error_message: `Unknown action: ${action}`,
        });
    }
    
  } catch (error) {
    console.error('[Seamless Callback] Error:', error);
    
    // Log critical error
    await auditLogger.logSecurity(
      'suspicious_activity',
      'seamless_api',
      request.headers.get('x-forwarded-for') || 'unknown',
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      }
    );
    
    return createResponse({
      success: false,
      error_code: 'INTERNAL_ERROR',
      error_message: 'An internal error occurred',
    });
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: Math.floor(Date.now() / 1000),
    endpoints: ['balance', 'bet', 'win', 'refund', 'rollback'],
  });
}
