import { NextRequest, NextResponse } from 'next/server';

/**
 * Test notification endpoint
 * POST /api/notifications/test
 * 
 * Body: { type: 'line' | 'telegram', token: string, chatId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, token, chatId } = body;
    
    if (!type || !token) {
      return NextResponse.json(
        { error: 'Missing required fields: type, token' },
        { status: 400 }
      );
    }
    
    const testMessage = `🔔 ทดสอบการแจ้งเตือน FIN LOTTO R+
━━━━━━━━━━━━━━━
✅ ระบบแจ้งเตือนทำงานปกติ
⏰ เวลา: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
━━━━━━━━━━━━━━━
🎉 ยินดีด้วย! การตั้งค่าสำเร็จ`;
    
    if (type === 'line') {
      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`,
        },
        body: new URLSearchParams({ message: testMessage }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { success: false, error: `LINE Notify Error: ${response.status} - ${errorText}` },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ success: true, message: 'LINE Notify test sent successfully' });
    }
    
    if (type === 'telegram') {
      if (!chatId) {
        return NextResponse.json(
          { error: 'Missing chatId for Telegram' },
          { status: 400 }
        );
      }
      
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMessage,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json(
          { success: false, error: `Telegram Error: ${errorData.description || response.status}` },
          { status: 400 }
        );
      }
      
      return NextResponse.json({ success: true, message: 'Telegram test sent successfully' });
    }
    
    return NextResponse.json(
      { error: 'Invalid notification type. Use "line" or "telegram"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Notification Test] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}
