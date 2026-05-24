/**
 * Daily Owner Report Cron Job
 * ส่งรายงานสรุปรายวันให้เจ้าของเว็บทุกวัน 01:30 น. (หลังปิดยอด)
 */

import { NextResponse } from 'next/server';
import { dailyOwnerSummary } from '@/lib/daily-owner-summary';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // คำนวณวันที่เมื่อวาน (เพราะรันหลังเที่ยงคืน)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`[Daily Owner Report] Generating report for ${dateStr}`);

    // Generate summary
    const summary = await dailyOwnerSummary.generateSummary(dateStr);

    // Send to LINE
    await dailyOwnerSummary.sendToLINE(summary);

    console.log(`[Daily Owner Report] Report sent successfully for ${dateStr}`);

    return NextResponse.json({
      success: true,
      date: dateStr,
      summary: {
        netProfit: summary.financial.netProfit,
        totalDeposits: summary.financial.totalDeposits,
        totalWithdrawals: summary.financial.totalWithdrawals,
        totalBets: summary.betting.totalBetAmount,
        newCustomers: summary.customers.newCustomers,
      },
    });
  } catch (error) {
    console.error('[Daily Owner Report] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily report', details: String(error) },
      { status: 500 }
    );
  }
}
