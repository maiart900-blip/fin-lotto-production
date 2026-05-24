/**
 * Data Retention Cron Job
 * รันทุกวันอาทิตย์ 03:00 น. (20:00 UTC)
 * Archive และ cleanup ข้อมูลเก่าตาม retention policy
 */

import { NextResponse } from 'next/server';
import { runRetentionCleanup } from '@/lib/data-retention';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Data Retention] Starting weekly cleanup...');

    const result = await runRetentionCleanup('system');

    console.log('[Data Retention] Cleanup completed:', result);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: result.results,
    });
  } catch (error) {
    console.error('[Data Retention] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run retention cleanup', details: String(error) },
      { status: 500 }
    );
  }
}
