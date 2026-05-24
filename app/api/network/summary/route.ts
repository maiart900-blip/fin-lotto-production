import { NextRequest, NextResponse } from 'next/server';
import { networkOrchestrator } from '@/lib/double-pipe';

export async function GET(request: NextRequest) {
  try {
    const summary = await networkOrchestrator.getNetworkSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Network summary error:', error);
    return NextResponse.json({
      totalAgents: 0,
      onlineAgents: 0,
      offlineAgents: 0,
      todayTotalBets: 0,
      todayTotalVolume: 0,
      pendingCommands: 0,
      criticalAlerts: 0,
    });
  }
}
