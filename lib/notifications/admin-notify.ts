/**
 * Admin Notification Service
 * Supports LINE Notify and Telegram Bot API
 * 
 * Usage: 
 * - Import and call sendAdminNotification() with notification type and data
 * - Settings are fetched from site_settings table
 * - Notifications are sent asynchronously (fire-and-forget) to not block main flow
 */

import { createClient } from '@/lib/supabase/server';

export type NotificationType = 'deposit' | 'withdraw' | 'risk_alert';

export interface DepositNotificationData {
  amount: number;
  customerName: string;
  bankName: string;
  time: string;
  requestId?: string;
}

export interface WithdrawNotificationData {
  amount: number;
  userId: string;
  withdrawType: 'หวย' | 'เกมส์' | 'อื่นๆ';
  requestId?: string;
}

export interface RiskAlertData {
  userId: string;
  reason: string;
  details?: string;
  requestId?: string;
}

interface NotificationSettings {
  line_notify_enabled?: boolean;
  line_notify_token?: string;
  telegram_enabled?: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

/**
 * Format notification message based on type
 */
function formatMessage(
  type: NotificationType,
  data: DepositNotificationData | WithdrawNotificationData | RiskAlertData
): string {
  const now = new Date().toLocaleString('th-TH', { 
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit'
  });

  switch (type) {
    case 'deposit': {
      const d = data as DepositNotificationData;
      return `💰 มีรายการแจ้งฝากใหม่!
━━━━━━━━━━━━━━━
💵 ยอดเงิน: ${d.amount.toLocaleString()} บาท
👤 ชื่อผู้โอน: ${d.customerName}
🏦 ธนาคาร: ${d.bankName}
⏰ เวลา: ${d.time || now}
━━━━━━━━━━━━━━━
🔗 ${BASE_URL}/deposit-requests`;
    }
    
    case 'withdraw': {
      const w = data as WithdrawNotificationData;
      return `💸 มีคำขอถอนเงินใหม่!
━━━━━━━━━━━━━━━
💵 ยอดเงิน: ${w.amount.toLocaleString()} บาท
👤 ยูสเซอร์: ${w.userId}
📋 ประเภท: ${w.withdrawType}
━━━━━━━━━━━━━━━
🔗 ${BASE_URL}/withdraw-requests`;
    }
    
    case 'risk_alert': {
      const r = data as RiskAlertData;
      return `⚠️ [⚠️ RISK ALERT] ตรวจพบรายการน่าสงสัย!
━━━━━━━━━━━━━━━
👤 ยูสเซอร์: ${r.userId}
🚨 สาเหตุ: ${r.reason}
${r.details ? `📝 รายละเอียด: ${r.details}` : ''}
━━━━━━━━━━━━━━━
⚡ โปรดตรวจสอบด่วน!
🔗 ${BASE_URL}/pending-review`;
    }
    
    default:
      return 'มีการแจ้งเตือนใหม่';
  }
}

/**
 * Send LINE Notify notification
 */
async function sendLineNotify(token: string, message: string): Promise<boolean> {
  try {
    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`,
      },
      body: new URLSearchParams({ message }),
    });
    
    if (!response.ok) {
      console.error('[Notification] LINE Notify failed:', response.status, await response.text());
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Notification] LINE Notify error:', error);
    return false;
  }
}

/**
 * Send Telegram Bot notification
 */
async function sendTelegram(botToken: string, chatId: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    
    if (!response.ok) {
      console.error('[Notification] Telegram failed:', response.status, await response.text());
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Notification] Telegram error:', error);
    return false;
  }
}

/**
 * Get notification settings from database
 */
async function getNotificationSettings(): Promise<NotificationSettings | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('site_settings')
      .select('line_notify_enabled, line_notify_token, telegram_enabled, telegram_bot_token, telegram_chat_id')
      .limit(1)
      .single();
    
    if (error) {
      console.error('[Notification] Failed to get settings:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('[Notification] Settings fetch error:', error);
    return null;
  }
}

/**
 * Main function to send admin notifications
 * This is async but designed to be fire-and-forget (doesn't block the main flow)
 */
export async function sendAdminNotification(
  type: NotificationType,
  data: DepositNotificationData | WithdrawNotificationData | RiskAlertData
): Promise<void> {
  // Fire-and-forget - don't await in calling code
  try {
    const settings = await getNotificationSettings();
    
    if (!settings) {
      console.log('[Notification] No notification settings configured');
      return;
    }
    
    const message = formatMessage(type, data);
    const promises: Promise<boolean>[] = [];
    
    // Send LINE Notify if enabled
    if (settings.line_notify_enabled && settings.line_notify_token) {
      promises.push(sendLineNotify(settings.line_notify_token, message));
    }
    
    // Send Telegram if enabled
    if (settings.telegram_enabled && settings.telegram_bot_token && settings.telegram_chat_id) {
      promises.push(sendTelegram(settings.telegram_bot_token, settings.telegram_chat_id, message));
    }
    
    if (promises.length > 0) {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      console.log(`[Notification] Sent ${successful}/${promises.length} notifications for ${type}`);
    } else {
      console.log('[Notification] No notification channels enabled');
    }
  } catch (error) {
    // Silently fail - notifications shouldn't break the main flow
    console.error('[Notification] Failed to send:', error);
  }
}

/**
 * Helper to send notification without blocking
 * Use this in API routes to fire-and-forget
 */
export function sendAdminNotificationAsync(
  type: NotificationType,
  data: DepositNotificationData | WithdrawNotificationData | RiskAlertData
): void {
  // Don't await - fire and forget
  sendAdminNotification(type, data).catch(err => {
    console.error('[Notification] Async send failed:', err);
  });
}
