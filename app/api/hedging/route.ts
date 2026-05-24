import { NextRequest, NextResponse } from 'next/server';
import { 
  getHedgingPartners, 
  exportBetToPartner, 
  bulkExportBets,
  getHedgingStats,
  getPendingHedgingOrders
} from '@/lib/hedging/hedging-system';

export const dynamic = 'force-dynamic';

// GET - Get hedging data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'partners';
    const date = searchParams.get('date');

    switch (type) {
      case 'partners':
        const partners = await getHedgingPartners();
        return NextResponse.json({ partners });
      
      case 'stats':
        const stats = await getHedgingStats(date || undefined);
        return NextResponse.json(stats);
      
      case 'pending':
        const pending = await getPendingHedgingOrders();
        return NextResponse.json({ orders: pending });
      
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error getting hedging data:', error);
    return NextResponse.json(
      { error: 'Failed to get hedging data' },
      { status: 500 }
    );
  }
}

// POST - Export bets to partner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, partnerId, bet, bets } = body;

    if (action === 'export_single') {
      if (!partnerId || !bet) {
        return NextResponse.json(
          { error: 'partnerId and bet data are required' },
          { status: 400 }
        );
      }

      const result = await exportBetToPartner(partnerId, bet);
      return NextResponse.json(result);
    }

    if (action === 'export_bulk') {
      if (!partnerId || !bets || !Array.isArray(bets)) {
        return NextResponse.json(
          { error: 'partnerId and bets array are required' },
          { status: 400 }
        );
      }

      const result = await bulkExportBets(partnerId, bets);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing hedging request:', error);
    return NextResponse.json(
      { error: 'Failed to process hedging request' },
      { status: 500 }
    );
  }
}
