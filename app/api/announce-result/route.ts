import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface BotSettings {
  id: string;
  platform: string;
  is_enabled: boolean;
  line_notify_token: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  facebook_page_id: string | null;
  facebook_access_token: string | null;
  message_template: string;
}

interface LotteryResult {
  lottery_name: string;
  draw_date: string;
  prize_first?: string;
  prize_last2?: string;
  prize_last3?: string;
  [key: string]: string | undefined;
}

function formatMessage(template: string, result: LotteryResult): string {
  let message = template;
  Object.entries(result).forEach(([key, value]) => {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '-');
  });
  return message;
}

async function sendToLine(token: string, message: string) {
  const response = await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${token}`,
    },
    body: new URLSearchParams({ message }),
  });
  return response.json();
}

async function sendToTelegram(botToken: string, chatId: string, message: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });
  return response.json();
}

async function sendToFacebook(pageId: string, accessToken: string, message: string) {
  const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lottery_id, result_id, result_data } = body;

    if (!result_data) {
      return NextResponse.json({ error: 'Result data is required' }, { status: 400 });
    }

    // Get all enabled bot settings
    const { data: settings, error: settingsError } = await supabase
      .from('bot_announcement_settings')
      .select('*')
      .eq('is_enabled', true);

    if (settingsError) {
      return NextResponse.json({ error: 'Failed to fetch bot settings' }, { status: 500 });
    }

    if (!settings || settings.length === 0) {
      return NextResponse.json({ message: 'No enabled bots found' }, { status: 200 });
    }

    const results: Array<{ platform: string; status: string; error?: string }> = [];

    for (const setting of settings as BotSettings[]) {
      const message = formatMessage(setting.message_template, result_data);
      let status = 'sent';
      let errorMsg = '';
      let response = null;

      try {
        if (setting.platform === 'line' && setting.line_notify_token) {
          response = await sendToLine(setting.line_notify_token, message);
        } else if (setting.platform === 'telegram' && setting.telegram_bot_token && setting.telegram_chat_id) {
          response = await sendToTelegram(setting.telegram_bot_token, setting.telegram_chat_id, message);
        } else if (setting.platform === 'facebook' && setting.facebook_page_id && setting.facebook_access_token) {
          response = await sendToFacebook(setting.facebook_page_id, setting.facebook_access_token, message);
        } else {
          status = 'failed';
          errorMsg = 'Missing credentials';
        }
      } catch (err) {
        status = 'failed';
        errorMsg = err instanceof Error ? err.message : 'Unknown error';
      }

      // Log the announcement
      await supabase.from('announcement_logs').insert({
        lottery_id,
        result_id,
        platform: setting.platform,
        status,
        message,
        response: JSON.stringify(response),
        error_message: errorMsg || null,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      });

      results.push({ platform: setting.platform, status, error: errorMsg || undefined });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Announcements processed',
      results 
    });
  } catch (error) {
    console.error('Announce result error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Fetch announcement logs
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lottery_id = searchParams.get('lottery_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('announcement_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (lottery_id) {
      query = query.eq('lottery_id', lottery_id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
