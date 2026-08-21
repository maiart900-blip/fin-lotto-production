/**
 * Data Retention Cron Job
 * รันทุกวัน 03:00 น. (20:00 UTC)
 * Archive และ cleanup ข้อมูลเก่าตาม retention policy
 *
 * Retention Policies:
 * - audit_logs: Delete after 90 days
 * - lottery_bets (completed): Archive after 180 days
 * - slip images: Delete after 90 days
 */

import { NextResponse } from 'next/server';
import { dataRetention } from '@/lib/storage/data-retention';
import { auditLogger } from '@/lib/audit-logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');

  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[Data Retention] Starting daily cleanup...');

    const {
      results,
      totalRecordsProcessed,
      totalDuration,
    } = await dataRetention.runFullCleanup();

    const description =
      `Data retention completed: ${totalRecordsProcessed} records processed in ${totalDuration}ms`;

    // logSystem expects:
    // 1) action
    // 2) description string
    // 3) optional details object
    await auditLogger.logSystem(
      'maintenance_mode',
      description,
      {
        operation: 'data_retention',
        results,
        totalRecordsProcessed,
        totalDuration,
      }
    );

    console.log(
      '[Data Retention] Cleanup completed:',
      {
        totalRecordsProcessed,
        totalDuration,
      }
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalRecordsProcessed,
        totalDuration,
      },
      results,
    });
  } catch (error) {
    console.error('[Data Retention] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to run retention cleanup',
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}

// Manual trigger for admins
export async function POST(request: Request) {
  return GET(request);
}