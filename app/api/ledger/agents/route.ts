import { NextRequest, NextResponse } from 'next/server';
import { getAgentWallet, getAllAgentWalletsSummary, deductAgentCredit, addAgentCredit } from '@/lib/ledger/multi-tier-ledger';

export const dynamic = 'force-dynamic';

// GET - Get Agent Wallets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (agentId) {
      const wallet = await getAgentWallet(agentId);
      if (!wallet) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      return NextResponse.json(wallet);
    }

    const summary = await getAllAgentWalletsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error getting agent wallets:', error);
    return NextResponse.json(
      { error: 'Failed to get agent wallets' },
      { status: 500 }
    );
  }
}

// POST - Credit Operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agentId, amount, transactionType, referenceId, description, processedBy } = body;

    if (!agentId || !amount) {
      return NextResponse.json(
        { error: 'agentId and amount are required' },
        { status: 400 }
      );
    }

    if (action === 'deduct') {
      const result = await deductAgentCredit(
        agentId,
        amount,
        referenceId || `TXN-${Date.now()}`,
        description || 'Credit deduction'
      );
      return NextResponse.json(result);
    }

    if (action === 'add') {
      const result = await addAgentCredit(
        agentId,
        amount,
        transactionType || 'deposit',
        referenceId || `TXN-${Date.now()}`,
        description || 'Credit addition',
        processedBy
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing agent credit:', error);
    return NextResponse.json(
      { error: 'Failed to process credit operation' },
      { status: 500 }
    );
  }
}
