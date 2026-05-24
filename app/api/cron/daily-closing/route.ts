import { NextResponse } from 'next/server';
import { createDailyClosing, saveDailyClosing } from '@/lib/daily-closing';
import { getBusinessDate } from '@/lib/daily-reset';

// Cron Job: Auto Daily Closing
// Schedule: 0 18 * * * (18:00 UTC = 01:00 Thailand Time)
export async function GET(request: Request) {
  try {
    // ตรวจสอบ Authorization header (Vercel Cron Secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // คำนวณวันก่อนหน้า (เพราะ cron ทำงาน 01:00 ของวันใหม่)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const closingDate = yesterday.toISOString().split('T')[0];

    console.log(`[Daily Closing Cron] Starting auto closing for date: ${closingDate}`);

    // สร้างข้อมูล Daily Closing ของวันก่อนหน้า
    const closingData = await createDailyClosing(closingDate);
    closingData.status = 'finalized'; // Cron job = finalized (auto)

    // บันทึกลงฐานข้อมูล
    const result = await saveDailyClosing(closingData);

    if (!result.success) {
      console.error(`[Daily Closing Cron] Failed:`, result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          date: closingDate 
        },
        { status: 500 }
      );
    }

    console.log(`[Daily Closing Cron] Successfully closed for date: ${closingDate}`);
    console.log(`[Daily Closing Cron] Summary:`, {
      deposits: closingData.total_deposits,
      withdrawals: closingData.total_withdrawals,
      bets: closingData.total_bets,
      payouts: closingData.total_payouts,
      netProfit: closingData.net_profit,
    });

    return NextResponse.json({
      success: true,
      message: `Daily closing completed for ${closingDate}`,
      summary: {
        date: closingDate,
        total_deposits: closingData.total_deposits,
        total_withdrawals: closingData.total_withdrawals,
        total_bets: closingData.total_bets,
        total_payouts: closingData.total_payouts,
        gross_profit: closingData.gross_profit,
        net_profit: closingData.net_profit,
        agent_commission: closingData.agent_commission,
        new_customers: closingData.new_customers,
      },
    });
  } catch (error) {
    console.error('[Daily Closing Cron] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// POST - Manual trigger for testing
export async function POST(request: Request) {
  try {
    // ตรวจสอบ Authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetDate = body.date || getBusinessDate();

    console.log(`[Daily Closing Cron] Manual trigger for date: ${targetDate}`);

    const closingData = await createDailyClosing(targetDate);
    closingData.status = 'closed';

    const result = await saveDailyClosing(closingData);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Daily closing completed for ${targetDate}`,
      data: closingData,
    });
  } catch (error) {
    console.error('[Daily Closing Cron] Manual trigger error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
