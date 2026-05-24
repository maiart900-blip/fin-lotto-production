import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, bot_token, chat_id } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!bot_token || !chat_id) {
      return NextResponse.json({ error: 'Bot token and chat ID are required' }, { status: 400 });
    }

    // Send to Telegram Bot
    const response = await fetch(
      `https://api.telegram.org/bot${bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return NextResponse.json(
        { error: 'Failed to send Telegram message', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram message sent successfully',
      data 
    });
  } catch (error) {
    console.error('Telegram Bot error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
