import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Aggregate Key-in Risk Cron Job
 *
 * POST /api/cron/aggregate-keyin-risk
 *
 * Aggregates betting data from key-in agents (stored in FIN LOTTO's entries table)
 * into the risk_aggregations table.
 *
 * Should run every 30-60 seconds for near real-time updates.
 *
 * Headers:
 * - Authorization: Bearer [CRON_SECRET]
 */

type LotteryRelation = {
  name?: string;
  draw_date?: string;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Get aggregated data from entries table for key-in agents
    // Entries from key-in flow have agent_id set
    const { data: entriesData, error: entriesError } = await supabase
      .from('entries')
      .select(`
        lottery_id,
        bet_type,
        bet_number,
        bet_amount,
        potential_payout,
        customer_id,
        agent_id,
        lottery:lotteries(name, draw_date)
      `)
      .not('agent_id', 'is', null)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return NextResponse.json(
        { error: entriesError.message },
        { status: 500 }
      );
    }

    if (!entriesData || entriesData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No key-in entries found for today',
        processed: 0,
      });
    }

    // Aggregate by lottery + number + bet_type
    const aggregations: Record<
      string,
      {
        lottery_type: string;
        lottery_id: string | null;
        draw_date: string;
        lottery_number: string;
        bet_type: string;
        total_bet_amount: number;
        payout_liability: number;
        bet_count: number;
        unique_customers: Set<string>;
      }
    > = {};

    entriesData.forEach((entry) => {
      const lottery = firstRelation<LotteryRelation>(
        entry.lottery as LotteryRelation | LotteryRelation[] | null
      );

      const lotteryType = lottery?.name || 'Unknown';
      const drawDate = lottery?.draw_date || today;
      const lotteryNumber = entry.bet_number || '';
      const betType = entry.bet_type || 'Unknown';

      const key = `${lotteryType}:${drawDate}:${lotteryNumber}:${betType}`;

      if (!aggregations[key]) {
        aggregations[key] = {
          lottery_type: lotteryType,
          lottery_id: entry.lottery_id,
          draw_date: drawDate,
          lottery_number: lotteryNumber,
          bet_type: betType,
          total_bet_amount: 0,
          payout_liability: 0,
          bet_count: 0,
          unique_customers: new Set<string>(),
        };
      }

      aggregations[key].total_bet_amount += Number(entry.bet_amount) || 0;
      aggregations[key].payout_liability +=
        Number(entry.potential_payout) || 0;
      aggregations[key].bet_count += 1;

      if (entry.customer_id) {
        aggregations[key].unique_customers.add(entry.customer_id);
      }
    });

    // Prepare upsert data
    const upsertData = Object.values(aggregations).map((agg) => ({
      source_type: 'keyin',
      source_site_id: 'fin_lotto_main',
      source_site_name: 'FIN LOTTO Key-in',
      lottery_type: agg.lottery_type,
      lottery_id: agg.lottery_id,
      draw_date: agg.draw_date,
      lottery_number: agg.lottery_number,
      bet_type: agg.bet_type,
      total_bet_amount: agg.total_bet_amount,
      payout_liability: agg.payout_liability,
      bet_count: agg.bet_count,
      unique_customers: agg.unique_customers.size,
      aggregated_at: now.toISOString(),
      received_at: now.toISOString(),
    }));

    // Upsert to risk_aggregations
    const { error: upsertError } = await supabase
      .from('risk_aggregations')
      .upsert(upsertData, {
        onConflict:
          'source_type,source_site_id,lottery_type,draw_date,lottery_number,bet_type',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Error upserting aggregations:', upsertError);
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Aggregated ${upsertData.length} number/bet_type combinations from ${entriesData.length} entries`,
      processed: upsertData.length,
      entries_scanned: entriesData.length,
      aggregated_at: now.toISOString(),
    });
  } catch (error) {
    console.error('Aggregate keyin risk error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual trigger / status check
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cron/aggregate-keyin-risk',
    method: 'POST',
    description:
      'Aggregates key-in betting data into risk_aggregations table',
    authentication: 'Bearer [CRON_SECRET]',
    recommended_frequency: '30-60 seconds',
    source: 'FIN LOTTO entries table (agent_id IS NOT NULL)',
  });
}