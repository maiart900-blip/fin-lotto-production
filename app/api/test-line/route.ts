import { NextResponse } from 'next/server';
import { testLineConnection, sendLineAlert } from '@/lib/notifications/line-notify';

/**
 * Test LINE Messaging API Connection
 * GET - ทดสอบการเชื่อมต่อ
 * POST - ส่งข้อความทดสอบแบบกำหนดเอง
 */

export async function GET() {
  try {
    const result = await testLineConnection();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'LINE Messaging API connected successfully',
        envCheck: {
          LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
          LINE_GROUP_ID: !!process.env.LINE_GROUP_ID,
          LINE_GROUP_IDS: !!process.env.LINE_GROUP_IDS,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        envCheck: {
          LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
          LINE_GROUP_ID: !!process.env.LINE_GROUP_ID,
          LINE_GROUP_IDS: !!process.env.LINE_GROUP_IDS,
        },
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, alertType, details } = body;

    if (!message && !alertType) {
      return NextResponse.json({
        success: false,
        error: 'Message or alertType is required',
      }, { status: 400 });
    }

    let result;
    if (alertType) {
      result = await sendLineAlert(alertType, message || 'ทดสอบ', details);
    } else {
      const { sendLineNotify } = await import('@/lib/notifications/line-notify');
      result = await sendLineNotify(message);
    }

    return NextResponse.json({
      success: result.success,
      error: result.error,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
