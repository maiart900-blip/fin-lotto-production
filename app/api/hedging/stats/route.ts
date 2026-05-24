import { NextRequest, NextResponse } from 'next/server';
import { getHedgingStats } from '@/lib/hedging/hedging-system';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    const stats = await getHedgingStats(date || undefined);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting hedging stats:', error);
    return NextResponse.json(
      { error: 'Failed to get hedging stats' },
      { status: 500 }
    );
  }
}
