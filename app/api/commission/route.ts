/**
 * Commission System API
 * Calculate and distribute commissions to agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateAgentCommission,
  calculateAllAgentsCommission,
  distributeCommissions,
  getNetworkCommissionSummary,
  DEFAULT_COMMISSION_TIERS,
} from '@/lib/commission/commission-system';

// GET - Get commission calculations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const agentId = searchParams.get('agentId');
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();

    switch (type) {
      case 'agent':
        if (!agentId) {
          return NextResponse.json({ error: 'agentId required for agent type' }, { status: 400 });
        }
        const agentCommission = await calculateAgentCommission(agentId, startDate, endDate);
        return NextResponse.json(agentCommission);

      case 'all':
        const allCommissions = await calculateAllAgentsCommission(startDate, endDate);
        return NextResponse.json({
          period: { startDate, endDate },
          results: allCommissions,
          total: allCommissions.reduce((sum, r) => sum + r.totalCommission, 0),
        });

      case 'summary':
        const summary = await getNetworkCommissionSummary(startDate, endDate);
        return NextResponse.json(summary);

      case 'tiers':
        return NextResponse.json(DEFAULT_COMMISSION_TIERS);

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Commission GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get commission data' },
      { status: 500 }
    );
  }
}

// POST - Distribute commissions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action, startDate, endDate, agentIds } = body;

    if (action === 'calculate') {
      // Just calculate without distributing
      const results = await calculateAllAgentsCommission(startDate, endDate);
      return NextResponse.json({
        action: 'calculate',
        period: { startDate, endDate },
        results,
        totalCommission: results.reduce((sum, r) => sum + r.totalCommission, 0),
        totalAgents: results.length,
      });
    }

    if (action === 'distribute') {
      // HTTP 501 Not Implemented
      // Commission Distribution is not supported in the current version.
      // Required RPC functions (increment_credit, increment_commission) do not exist in database.
      // See: lib/commission/commission-system.ts distributeCommissions()
      return NextResponse.json(
        { 
          error: 'Not Implemented',
          message: 'Commission Distribution ยังไม่รองรับในเวอร์ชันปัจจุบัน เนื่องจาก RPC functions ที่จำเป็นยังไม่มีใน Database',
          requiredRPCs: ['increment_credit', 'increment_commission'],
          status: 'pending_database_migration'
        },
        { status: 501 }
      );
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Commission POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process commission action' },
      { status: 500 }
    );
  }
}
