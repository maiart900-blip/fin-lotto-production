import { NextRequest, NextResponse } from 'next/server';
import { AIAnalytics } from '@/lib/analytics/ai-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lotteryId = searchParams.get('lottery');

    const summary = await AIAnalytics.getAnalyticsSummary(
      lotteryId && lotteryId !== 'all' ? lotteryId : undefined
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error('AI Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, lotteryId } = body;

    switch (action) {
      case 'predict_hot_numbers':
        const hotNumbers = await AIAnalytics.predictHotNumbers(lotteryId, 20);
        return NextResponse.json({ hotNumbers });

      case 'detect_collusion':
        const collusion = await AIAnalytics.detectCollusionPatterns(lotteryId);
        return NextResponse.json(collusion);

      case 'predict_customer_churn':
        const customerChurn = await AIAnalytics.predictCustomerChurn(1000, 50);
        return NextResponse.json({ customerChurn });

      case 'predict_agent_churn':
        const agentChurn = await AIAnalytics.predictAgentChurn();
        return NextResponse.json({ agentChurn });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI Analytics POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI analytics request' },
      { status: 500 }
    );
  }
}
