/**
 * Daily Owner Report Cron Job
 * ส่งรายงานสรุปรายวันให้เจ้าของเว็บทุกวัน 01:30 น. (หลังปิดยอด)
 */

import { NextResponse } from 'next/server';
import { dailyOwnerSummary } from '@/lib/daily-owner-summary';

export const runtime = 'nodejs';
export const maxDuration = 60;

type DailySummaryResult = {
  financial: {
    netProfit: number;
    totalDeposits: number;
    totalWithdrawals: number;
  };
  betting: {
    totalBetAmount: number;
  };
  customers: {
    newCustomers: number;
  };
};

type DailyOwnerSummaryServiceCompat = {
  generateDailySummary: (date: string) => Promise<DailySummaryResult>;
  sendToLINE?: (summary: DailySummaryResult) => Promise<void>;
};

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // คำนวณวันที่เมื่อวาน (เพราะรันหลังเที่ยงคืน)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(
      `[Daily Owner Report] Generating report for ${dateStr}`
    );

    const summaryService =
      dailyOwnerSummary as unknown as DailyOwnerSummaryServiceCompat;

    // ชื่อ method ที่มีอยู่จริงใน service คือ generateDailySummary
    const summary =
      await summaryService.generateDailySummary(dateStr);

    // รองรับโปรเจกต์เก่าที่อาจมี sendToLINE อยู่ตอน runtime
    // แต่ไม่บังคับ TypeScript ให้เชื่อว่ามี method นี้
    if (typeof summaryService.sendToLINE === 'function') {
      await summaryService.sendToLINE(summary);

      console.log(
        `[Daily Owner Report] Report sent successfully for ${dateStr}`
      );
    } else {
      console.log(
        `[Daily Owner Report] Summary generated for ${dateStr}; sendToLINE is not configured on dailyOwnerSummary`
      );
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      sentToLINE:
        typeof summaryService.sendToLINE === 'function',
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
      {
        error: 'Failed to generate daily report',
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}