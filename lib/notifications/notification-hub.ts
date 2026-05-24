/**
 * Notification Hub for FIN LOTTO R+
 * ศูนย์รวมการแจ้งเตือนทุกช่องทาง (LINE, Email, Push, In-App)
 */

import { createClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis';

// =============================================
// TYPES
// =============================================

export type NotificationChannel = 'line' | 'email' | 'push' | 'in_app' | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationType = 
  | 'bet_placed'
  | 'bet_won'
  | 'deposit_received'
  | 'deposit_approved'
  | 'withdrawal_requested'
  | 'withdrawal_completed'
  | 'market_opened'
  | 'market_closed'
  | 'result_announced'
  | 'risk_alert'
  | 'agent_activity'
  | 'system_alert'
  | 'promotion';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
}

export interface NotificationRecipient {
  userId?: string;
  agentId?: string;
  customerId?: string;
  lineUserId?: string;
  email?: string;
  phoneNumber?: string;
  pushToken?: string;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
}

// =============================================
// LINE NOTIFY INTEGRATION
// =============================================

const LINE_NOTIFY_API = 'https://notify-api.line.me/api/notify';

export async function sendLineNotify(
  token: string,
  message: string,
  imageUrl?: string,
  stickerPackageId?: number,
  stickerId?: number
): Promise<NotificationResult> {
  try {
    const formData = new URLSearchParams();
    formData.append('message', message);
    
    if (imageUrl) {
      formData.append('imageThumbnail', imageUrl);
      formData.append('imageFullsize', imageUrl);
    }
    
    if (stickerPackageId && stickerId) {
      formData.append('stickerPackageId', stickerPackageId.toString());
      formData.append('stickerId', stickerId.toString());
    }

    const response = await fetch(LINE_NOTIFY_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`,
      },
      body: formData.toString(),
    });

    const result = await response.json();

    return {
      success: response.ok,
      channel: 'line',
      messageId: result.message,
      error: response.ok ? undefined : result.message,
    };
  } catch (error) {
    return {
      success: false,
      channel: 'line',
      error: error instanceof Error ? error.message : 'LINE Notify failed',
    };
  }
}

// =============================================
// NOTIFICATION TEMPLATES
// =============================================

const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; template: string; icon: string }> = {
  bet_placed: {
    title: 'รับแทงสำเร็จ',
    template: '📝 รับแทงเลข {number} จำนวน {amount} บาท\nหวย: {lotteryName}\nเวลา: {time}',
    icon: '📝',
  },
  bet_won: {
    title: 'ยินดีด้วย! ถูกรางวัล',
    template: '🎉 ยินดีด้วย! เลข {number} ถูกรางวัล\nยอดรับ: {payout} บาท\nหวย: {lotteryName}',
    icon: '🎉',
  },
  deposit_received: {
    title: 'รับยอดฝากแล้ว',
    template: '💰 รับยอดฝาก {amount} บาท\nจาก: {customerName}\nเวลา: {time}',
    icon: '💰',
  },
  deposit_approved: {
    title: 'เติมเครดิตสำเร็จ',
    template: '✅ เติมเครดิต {amount} บาท สำเร็จ\nเครดิตคงเหลือ: {balance} บาท',
    icon: '✅',
  },
  withdrawal_requested: {
    title: 'คำขอถอนเงิน',
    template: '📤 คำขอถอนเงิน {amount} บาท\nจาก: {customerName}\nธนาคาร: {bankName}',
    icon: '📤',
  },
  withdrawal_completed: {
    title: 'ถอนเงินสำเร็จ',
    template: '✅ โอนเงิน {amount} บาท สำเร็จ\nไปยัง: {bankAccount}',
    icon: '✅',
  },
  market_opened: {
    title: 'เปิดรับแทงแล้ว',
    template: '🟢 {lotteryName} เปิดรับแทงแล้ว\nปิดรับ: {closeTime}',
    icon: '🟢',
  },
  market_closed: {
    title: 'ปิดรับแทงแล้ว',
    template: '🔴 {lotteryName} ปิดรับแทงแล้ว\nรอผลออก: {resultTime}',
    icon: '🔴',
  },
  result_announced: {
    title: 'ผลออกแล้ว',
    template: '📢 ผล {lotteryName}\n3 ตัวบน: {top3}\n2 ตัวล่าง: {bottom2}',
    icon: '📢',
  },
  risk_alert: {
    title: 'แจ้งเตือนความเสี่ยง',
    template: '⚠️ เลข {number} ยอดแทงสูง!\nยอดรวม: {totalAmount} บาท\nLimit: {limit} บาท',
    icon: '⚠️',
  },
  agent_activity: {
    title: 'กิจกรรม Agent',
    template: '👤 {agentName}: {activity}\nเวลา: {time}',
    icon: '👤',
  },
  system_alert: {
    title: 'แจ้งเตือนระบบ',
    template: '🔔 {message}',
    icon: '🔔',
  },
  promotion: {
    title: 'โปรโมชั่น',
    template: '🎁 {title}\n{description}\nหมดเขต: {expiry}',
    icon: '🎁',
  },
};

// =============================================
// NOTIFICATION HUB CLASS
// =============================================

export class NotificationHub {
  private supabase: any;

  async init() {
    this.supabase = await createClient();
  }

  /**
   * ส่งการแจ้งเตือนไปยังผู้รับ
   */
  async send(
    recipient: NotificationRecipient,
    payload: NotificationPayload,
    channels: NotificationChannel[] = ['line', 'in_app']
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      let result: NotificationResult;

      switch (channel) {
        case 'line':
          result = await this.sendToLine(recipient, payload);
          break;
        case 'in_app':
          result = await this.sendInApp(recipient, payload);
          break;
        case 'push':
          result = await this.sendPush(recipient, payload);
          break;
        case 'email':
          result = await this.sendEmail(recipient, payload);
          break;
        case 'sms':
          result = await this.sendSMS(recipient, payload);
          break;
        default:
          result = { success: false, channel, error: 'Unknown channel' };
      }

      results.push(result);
    }

    // Log notifications
    await this.logNotification(recipient, payload, results);

    return results;
  }

  /**
   * ส่งการแจ้งเตือนแบบ Broadcast
   */
  async broadcast(
    recipientType: 'all_agents' | 'all_customers' | 'all_admins',
    payload: NotificationPayload,
    channels: NotificationChannel[] = ['line', 'in_app']
  ): Promise<{ sent: number; failed: number }> {
    let recipients: NotificationRecipient[] = [];

    switch (recipientType) {
      case 'all_agents':
        const { data: agents } = await this.supabase
          .from('agents')
          .select('id, line_notify_token')
          .eq('status', 'active');
        recipients = agents?.map((a: any) => ({ agentId: a.id, lineUserId: a.line_notify_token })) || [];
        break;
      case 'all_customers':
        const { data: customers } = await this.supabase
          .from('customers')
          .select('id, line_user_id')
          .eq('status', 'active');
        recipients = customers?.map((c: any) => ({ customerId: c.id, lineUserId: c.line_user_id })) || [];
        break;
      case 'all_admins':
        const { data: admins } = await this.supabase
          .from('users')
          .select('id, line_notify_token')
          .eq('role', 'admin');
        recipients = admins?.map((a: any) => ({ userId: a.id, lineUserId: a.line_notify_token })) || [];
        break;
    }

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const results = await this.send(recipient, payload, channels);
      if (results.some(r => r.success)) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * ส่งไปยัง LINE
   */
  private async sendToLine(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    // Get LINE token
    let lineToken: string | null = null;

    if (recipient.lineUserId) {
      lineToken = recipient.lineUserId;
    } else if (recipient.agentId) {
      const { data } = await this.supabase
        .from('agents')
        .select('line_notify_token')
        .eq('id', recipient.agentId)
        .single();
      lineToken = data?.line_notify_token;
    } else if (recipient.userId) {
      const { data } = await this.supabase
        .from('users')
        .select('line_notify_token')
        .eq('id', recipient.userId)
        .single();
      lineToken = data?.line_notify_token;
    }

    if (!lineToken) {
      return { success: false, channel: 'line', error: 'No LINE token found' };
    }

    const template = NOTIFICATION_TEMPLATES[payload.type];
    const message = this.formatMessage(template?.template || payload.message, payload.data);

    return sendLineNotify(lineToken, message, payload.imageUrl);
  }

  /**
   * ส่ง In-App Notification
   */
  private async sendInApp(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    try {
      const userId = recipient.userId || recipient.agentId || recipient.customerId;
      
      if (!userId) {
        return { success: false, channel: 'in_app', error: 'No user ID' };
      }

      // Insert notification
      const { data, error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data,
          image_url: payload.imageUrl,
          action_url: payload.actionUrl,
          priority: payload.priority || 'normal',
          is_read: false,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      // Publish to Redis for real-time update
      await redis.publish(`notifications:${userId}`, JSON.stringify({
        id: data.id,
        ...payload,
        timestamp: new Date().toISOString(),
      }));

      return { success: true, channel: 'in_app', messageId: data.id };
    } catch (error) {
      return {
        success: false,
        channel: 'in_app',
        error: error instanceof Error ? error.message : 'In-app notification failed',
      };
    }
  }

  /**
   * ส่ง Push Notification
   */
  private async sendPush(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    // TODO: Implement push notification via Firebase/OneSignal
    return { success: false, channel: 'push', error: 'Push not implemented' };
  }

  /**
   * ส่ง Email
   */
  private async sendEmail(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    // TODO: Implement email via SendGrid/Resend
    return { success: false, channel: 'email', error: 'Email not implemented' };
  }

  /**
   * ส่ง SMS
   */
  private async sendSMS(
    recipient: NotificationRecipient,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    // TODO: Implement SMS via Twilio
    return { success: false, channel: 'sms', error: 'SMS not implemented' };
  }

  /**
   * Format message with template
   */
  private formatMessage(template: string, data?: Record<string, any>): string {
    if (!data) return template;

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key]?.toString() || match;
    });
  }

  /**
   * Log notification
   */
  private async logNotification(
    recipient: NotificationRecipient,
    payload: NotificationPayload,
    results: NotificationResult[]
  ): Promise<void> {
    await this.supabase.from('notification_logs').insert({
      recipient: recipient,
      payload: payload,
      results: results,
      created_at: new Date().toISOString(),
    });
  }
}

// =============================================
// QUICK NOTIFICATION FUNCTIONS
// =============================================

export async function notifyBetPlaced(agentId: string, data: { number: string; amount: number; lotteryName: string }): Promise<void> {
  const hub = new NotificationHub();
  await hub.init();
  await hub.send(
    { agentId },
    {
      type: 'bet_placed',
      title: 'รับแทงสำเร็จ',
      message: `รับแทงเลข ${data.number} จำนวน ${data.amount.toLocaleString()} บาท`,
      data: { ...data, time: new Date().toLocaleString('th-TH') },
    },
    ['in_app']
  );
}

export async function notifyBigWin(customerId: string, data: { number: string; payout: number; lotteryName: string }): Promise<void> {
  const hub = new NotificationHub();
  await hub.init();
  await hub.send(
    { customerId },
    {
      type: 'bet_won',
      title: 'ยินดีด้วย! ถูกรางวัล',
      message: `เลข ${data.number} ถูกรางวัล รับ ${data.payout.toLocaleString()} บาท`,
      data,
      priority: 'high',
    },
    ['line', 'in_app']
  );
}

export async function notifyRiskAlert(data: { number: string; totalAmount: number; limit: number }): Promise<void> {
  const hub = new NotificationHub();
  await hub.init();
  await hub.broadcast(
    'all_admins',
    {
      type: 'risk_alert',
      title: 'แจ้งเตือนความเสี่ยง',
      message: `เลข ${data.number} ยอดแทงสูง ${data.totalAmount.toLocaleString()} บาท`,
      data,
      priority: 'critical',
    },
    ['line', 'in_app']
  );
}

export async function notifyResultAnnounced(lotteryId: string, results: { top3: string; bottom2: string }): Promise<void> {
  const hub = new NotificationHub();
  await hub.init();
  
  // Get lottery name
  const supabase = await createClient();
  const { data: lottery } = await supabase
    .from('lotteries')
    .select('name')
    .eq('id', lotteryId)
    .single();

  await hub.broadcast(
    'all_customers',
    {
      type: 'result_announced',
      title: `ผล ${lottery?.name || 'หวย'}`,
      message: `3 ตัวบน: ${results.top3} | 2 ตัวล่าง: ${results.bottom2}`,
      data: { ...results, lotteryName: lottery?.name },
    },
    ['line', 'in_app']
  );
}

// =============================================
// EXPORT
// =============================================

export const Notifications = {
  NotificationHub,
  sendLineNotify,
  notifyBetPlaced,
  notifyBigWin,
  notifyRiskAlert,
  notifyResultAnnounced,
  TEMPLATES: NOTIFICATION_TEMPLATES,
};
