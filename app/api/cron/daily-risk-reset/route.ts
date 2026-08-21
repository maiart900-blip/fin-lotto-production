import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getBusinessDay, getYesterdayBusinessDay } from '@/lib/daily-reset';

/**
 * Daily Risk Reset Cron Job
 *
 * TASK 4: AUTOMATED 01:00 AM RESET CRON
 *
 * Runs every day at 01:00 AM Thailand Time (18:00 UTC previous day)
 *
 * Actions:
 * 1. Archive yesterday's risk_aggregations data to risk_aggregation_history
 * 2. Reset active risk counters to "0" for the new business day
 * 3. Log the reset for audit purposes
 *
 * Schedule: 0 18 * * * (18:00 UTC = 01:00 Thailand)
 *
 * Headers:
 * - Authorization: Bearer [CRON_SECRET]
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const now = new Date();
    const businessDay = getBusinessDay();
    const yesterdayBusinessDay = getYesterdayBusinessDay();

    console.log(
      `[CRON] Daily Risk Reset starting at ${now.toISOString()}`
    );
    console.log(
      `[CRON] Archiving data for: ${yesterdayBusinessDay}, New day: ${businessDay}`
    );

    // ========================================================
    // STEP 1: Archive yesterday's risk data to history table
    // ========================================================

    const { data: yesterdayData, error: fetchError } = await supabase
      .from('risk_aggregations')
      .select('*')
      .eq('draw_date', yesterdayBusinessDay);

    if (fetchError) {
      console.error(
        '[CRON] Error fetching yesterday data:',
        fetchError
      );
    }

    let archivedCount = 0;

    if (yesterdayData && yesterdayData.length > 0) {
      const byLotteryType: Record<
        string,
        {
          total_bet_amount: number;
          total_payout_liability: number;
          total_bet_count: number;
          unique_numbers: Set<string>;
          critical_count: number;
          high_count: number;
          medium_count: number;
          top_exposures: Array<{
            number: string;
            bet_type: string;
            liability: number;
            sources: string[];
          }>;
          source_breakdown: Record<string, number>;
        }
      > = {};

      yesterdayData.forEach((row) => {
        const lotteryType = row.lottery_type || 'Unknown';

        if (!byLotteryType[lotteryType]) {
          byLotteryType[lotteryType] = {
            total_bet_amount: 0,
            total_payout_liability: 0,
            total_bet_count: 0,
            unique_numbers: new Set<string>(),
            critical_count: 0,
            high_count: 0,
            medium_count: 0,
            top_exposures: [],
            source_breakdown: {},
          };
        }

        const group = byLotteryType[lotteryType];

        group.total_bet_amount +=
          Number(row.total_bet_amount) || 0;
        group.total_payout_liability +=
          Number(row.payout_liability) || 0;
        group.total_bet_count += Number(row.bet_count) || 0;

        if (row.lottery_number) {
          group.unique_numbers.add(row.lottery_number);
        }

        if (row.risk_level === 'critical') {
          group.critical_count += 1;
        } else if (row.risk_level === 'high') {
          group.high_count += 1;
        } else if (row.risk_level === 'medium') {
          group.medium_count += 1;
        }

        const source = row.source_type || 'unknown';

        group.source_breakdown[source] =
          (group.source_breakdown[source] || 0) +
          (Number(row.total_bet_amount) || 0);

        group.top_exposures.push({
          number: row.lottery_number || '',
          bet_type: row.bet_type || 'Unknown',
          liability: Number(row.payout_liability) || 0,
          sources: [
            row.source_site_name || row.source_type || 'unknown',
          ],
        });
      });

      const archiveRecords = Object.entries(byLotteryType).map(
        ([lotteryType, data]) => ({
          snapshot_date: yesterdayBusinessDay,
          snapshot_time: now.toISOString(),
          lottery_type: lotteryType,
          draw_date: yesterdayBusinessDay,
          total_bet_amount: data.total_bet_amount,
          total_payout_liability: data.total_payout_liability,
          total_bet_count: data.total_bet_count,
          total_unique_numbers: data.unique_numbers.size,
          critical_count: data.critical_count,
          high_count: data.high_count,
          medium_count: data.medium_count,
          top_exposures: data.top_exposures
            .sort((a, b) => b.liability - a.liability)
            .slice(0, 10),
          source_breakdown: data.source_breakdown,
        })
      );

      const { error: archiveError } = await supabase
        .from('risk_aggregation_history')
        .upsert(archiveRecords, {
          onConflict:
            'snapshot_date,lottery_type,draw_date',
          ignoreDuplicates: false,
        });

      if (archiveError) {
        console.error(
          '[CRON] Error archiving data:',
          archiveError
        );
      } else {
        archivedCount = archiveRecords.length;
        console.log(
          `[CRON] Archived ${archivedCount} lottery type summaries`
        );
      }
    }

    // ========================================================
    // STEP 2: Reset active risk counters for new day
    // ========================================================

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo
      .toISOString()
      .split('T')[0];

    // Supabase version in this project does not accept
    // .select('id', { count: 'exact', head: true }) after delete().
    // Return deleted ids instead and count them locally.
    const {
      data: deletedRows,
      error: deleteError,
    } = await supabase
      .from('risk_aggregations')
      .delete()
      .lt('draw_date', cutoffDate)
      .select('id');

    const deletedCount = deletedRows?.length || 0;

    if (deleteError) {
      console.error(
        '[CRON] Error cleaning old aggregations:',
        deleteError
      );
    } else {
      console.log(
        `[CRON] Deleted ${deletedCount} old aggregation records (before ${cutoffDate})`
      );
    }

    // ========================================================
    // STEP 3: Log the reset for audit purposes
    // ========================================================

    const duration = Date.now() - startTime;

    await supabase
      .from('system_logs')
      .insert({
        log_type: 'cron_job',
        action: 'daily_risk_reset',
        details: {
          business_day: businessDay,
          archived_date: yesterdayBusinessDay,
          archived_lottery_types: archivedCount,
          archived_records: yesterdayData?.length || 0,
          deleted_old_records: deletedCount,
          cutoff_date: cutoffDate,
          duration_ms: duration,
        },
        created_at: now.toISOString(),
      });

    return NextResponse.json({
      success: true,
      message: 'Daily risk reset completed',
      details: {
        business_day: businessDay,
        archived_date: yesterdayBusinessDay,
        archived_lottery_types: archivedCount,
        archived_records: yesterdayData?.length || 0,
        deleted_old_records: deletedCount,
        duration_ms: duration,
      },
      executed_at: now.toISOString(),
    });
  } catch (error) {
    console.error(
      '[CRON] Daily risk reset error:',
      error
    );

    return NextResponse.json(
      {
        error: 'Internal server error',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual trigger / status check
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cron/daily-risk-reset',
    method: 'POST',
    description:
      'Resets daily risk counters at 01:00 AM Thailand time and archives historical data',
    schedule: '0 18 * * * (18:00 UTC = 01:00 Thailand)',
    authentication: 'Bearer [CRON_SECRET]',
    actions: [
      'Archive yesterday risk_aggregations to risk_aggregation_history',
      'Delete risk aggregations older than 7 days',
      'Log reset to system_logs for audit',
    ],
  });
}