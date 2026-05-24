import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Lazy initialization for webhooks
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }
  return createSupabaseClient(url, key);
}

// Verify webhook signature
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Webhook types
type WebhookEvent = 
  | 'deposit.completed'
  | 'deposit.failed'
  | 'withdrawal.completed'
  | 'withdrawal.failed'
  | 'transfer.completed';

interface WebhookPayload {
  event: WebhookEvent;
  data: {
    transaction_id: string;
    user_id?: string;
    amount: number;
    reference: string;
    bank_account?: string;
    timestamp: string;
    metadata?: Record<string, any>;
  };
  signature?: string;
}

// POST: Receive Webhook from Payment Gateway
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const payload: WebhookPayload = JSON.parse(rawBody);
    
    // Get webhook secret from env
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    
    // Verify signature if provided
    if (webhookSecret && payload.signature) {
      const isValid = verifySignature(
        JSON.stringify(payload.data),
        payload.signature,
        webhookSecret
      );
      
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Log webhook event
    const supabase = getSupabase();
    await supabase.from('webhooks').insert({
      event_type: payload.event,
      payload: payload.data,
      status: 'pending',
    });

    // Process based on event type
    switch (payload.event) {
      case 'deposit.completed':
        await handleDepositCompleted(payload.data);
        break;
        
      case 'deposit.failed':
        await handleDepositFailed(payload.data);
        break;
        
      case 'withdrawal.completed':
        await handleWithdrawalCompleted(payload.data);
        break;
        
      case 'withdrawal.failed':
        await handleWithdrawalFailed(payload.data);
        break;
        
      case 'transfer.completed':
        await handleTransferCompleted(payload.data);
        break;
        
      default:
        console.warn('Unknown webhook event:', payload.event);
    }

    // Update webhook status
    await supabase
      .from('webhooks')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('payload->>transaction_id', payload.data.transaction_id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle deposit completed
async function handleDepositCompleted(data: WebhookPayload['data']) {
  const { transaction_id, user_id, amount, reference } = data;
  
  if (!user_id) {
    // Try to find user by reference code
    const { data: pending } = await getSupabase()
      .from('transactions')
      .select('user_id, wallet_id')
      .eq('payment_ref', reference)
      .eq('status', 'pending')
      .single();
    
    if (!pending) {
      console.error('No pending transaction found for reference:', reference);
      return;
    }
    
    // Update transaction and wallet
    await processDeposit(pending.user_id, pending.wallet_id, amount, transaction_id, reference);
  } else {
    // Get wallet
    const { data: wallet } = await getSupabase()
      .from('wallets')
      .select('id, balance')
      .eq('user_id', user_id)
      .single();
    
    if (wallet) {
      await processDeposit(user_id, wallet.id, amount, transaction_id, reference);
    }
  }
}

async function processDeposit(
  userId: string, 
  walletId: string, 
  amount: number, 
  txId: string,
  reference: string
) {
  // Get current balance
  const { data: wallet } = await getSupabase()
    .from('wallets')
    .select('balance')
    .eq('id', walletId)
    .single();
  
  if (!wallet) return;
  
  const newBalance = Number(wallet.balance) + amount;
  
  // Update wallet balance
  await getSupabase()
    .from('wallets')
    .update({ 
      balance: newBalance,
      last_activity_at: new Date().toISOString()
    })
    .eq('id', walletId);
  
  // Create or update transaction record
  await getSupabase()
    .from('transactions')
    .upsert({
      user_id: userId,
      wallet_id: walletId,
      type: 'deposit',
      amount: amount,
      balance_before: wallet.balance,
      balance_after: newBalance,
      status: 'completed',
      payment_ref: reference,
      tx_hash: txId,
      approved_at: new Date().toISOString(),
    }, {
      onConflict: 'payment_ref',
    });
  
  // Create audit log
  await getSupabase().from('audit_logs').insert({
    user_id: userId,
    action: 'deposit_completed',
    entity_type: 'transaction',
    new_data: { amount, reference, tx_id: txId },
  });
  
  console.log('Deposit completed:', amount, 'for user', userId);
}

// Handle deposit failed
async function handleDepositFailed(data: WebhookPayload['data']) {
  const { reference } = data;
  
  await getSupabase()
    .from('transactions')
    .update({ status: 'failed' })
    .eq('payment_ref', reference);
  
  console.log('Deposit failed:', reference);
}

// Handle withdrawal completed
async function handleWithdrawalCompleted(data: WebhookPayload['data']) {
  const { transaction_id, reference } = data;
  
  await getSupabase()
    .from('transactions')
    .update({ 
      status: 'completed',
      tx_hash: transaction_id,
      approved_at: new Date().toISOString()
    })
    .eq('payment_ref', reference);
  
  console.log('Withdrawal completed:', reference);
}

// Handle withdrawal failed
async function handleWithdrawalFailed(data: WebhookPayload['data']) {
  const { reference, amount } = data;
  
  // Get the pending transaction
  const { data: tx } = await getSupabase()
    .from('transactions')
    .select('user_id, wallet_id, amount')
    .eq('payment_ref', reference)
    .eq('status', 'pending')
    .single();
  
  if (tx) {
    // Refund the amount back to wallet
    const { data: wallet } = await getSupabase()
      .from('wallets')
      .select('balance')
      .eq('id', tx.wallet_id)
      .single();
    
    if (wallet) {
      await getSupabase()
        .from('wallets')
        .update({ balance: Number(wallet.balance) + Math.abs(amount) })
        .eq('id', tx.wallet_id);
    }
    
    // Update transaction status
    await getSupabase()
      .from('transactions')
      .update({ status: 'failed' })
      .eq('payment_ref', reference);
  }
  
  console.log('Withdrawal failed:', reference);
}

// Handle transfer completed
async function handleTransferCompleted(data: WebhookPayload['data']) {
  const { reference, transaction_id } = data;
  
  await getSupabase()
    .from('transactions')
    .update({ 
      status: 'completed',
      tx_hash: transaction_id,
      approved_at: new Date().toISOString()
    })
    .eq('payment_ref', reference);
  
  console.log('Transfer completed:', reference);
}
