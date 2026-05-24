import { NextRequest, NextResponse } from 'next/server';
import { getMasterStatement, getDailyMasterStatement, resetDailyStatement } from '@/lib/ledger/multi-tier-ledger';

export const dynamic = 'force-dynamic';

// GET - Get Master Statement
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (date) {
      const dailyStatement = await getDailyMasterStatement(date);
      return NextResponse.json(dailyStatement);
    }

    const statement = await getMasterStatement();
    return NextResponse.json(statement);
  } catch (error) {
    console.error('Error getting master statement:', error);
    return NextResponse.json(
      { error: 'Failed to get master statement' },
      { status: 500 }
    );
  }
}

// POST - Reset Daily Statement (End of day)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'reset_daily') {
      await resetDailyStatement();
      return NextResponse.json({ success: true, message: 'Daily statement reset' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing master statement action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
