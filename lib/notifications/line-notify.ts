/**
 * LINE Notify Integration
 * ส่งแจ้งเตือนไปยัง LINE ของแอดมินเว็บแม่
 */

// LINE Notify API URL
const LINE_NOTIFY_API = 'https://notify-api.line.me/api/notify';

// Alert Types
export type AlertType = 
  | 'risk_warning'      // เลขใกล้เต็มโควตา
  | 'risk_critical'     // เลขเกือบเต็ม/เต็มแล้ว
  | 'deposit_pending'   // มีฝากเงินรอตรวจสอบ
  | 'withdraw_pending'  // มีถอนเงินรอดำเนินการ
  | 'agent_offline'     // Agent ขาดการเชื่อมต่อ
  | 'emergency'         // เหตุฉุกเฉิน
  | 'system_alert';     // แจ้งเตือนระบบ

// Alert Icons
const ALERT_ICONS: Record<AlertType, string> = {
  risk_warning: '⚠️',
  risk_critical: '🚨',
  deposit_pending: '💰',
  withdraw_pending: '💸',
  agent_offline: '📡',
  emergency: '🆘',
  system_alert: '🔔',
};

interface LineNotifyOptions {
  token?: string;
  stickerPackageId?: number;
  stickerId?: number;
  imageUrl?: string;
  notificationDisabled?: boolean;
}

/**
 * Send LINE Notify Message
 */
export async function sendLineNotify(
  message: string,
  options: LineNotifyOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const token = options.token || process.env.LINE_NOTIFY_TOKEN;
  
  if (!token) {
    console.warn('[LINE Notify] Token not configured');
    return { success: false, error: 'LINE_NOTIFY_TOKEN not configured' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('message', message);
    
    if (options.stickerPackageId && options.stickerId) {
      formData.append('stickerPackageId', options.stickerPackageId.toString());
      formData.append('stickerId', options.stickerId.toString());
    }
    
    if (options.imageUrl) {
      formData.append('imageThumbnail', options.imageUrl);
      formData.append('imageFullsize', options.imageUrl);
    }
    
    if (options.notificationDisabled) {
      formData.append('notificationDisabled', 'true');
    }

    const response = await fetch(LINE_NOTIFY_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[LINE Notify] Error:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('[LINE Notify] Exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send Alert with Type-specific Formatting
 */
export async function sendLineAlert(
  type: AlertType,
  message: string,
  details?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const icon = ALERT_ICONS[type];
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  
  let formattedMessage = `\n${icon} ${message}`;
  
  if (details) {
    formattedMessage += '\n---';
    for (const [key, value] of Object.entries(details)) {
      formattedMessage += `\n${key}: ${value}`;
    }
  }
  
  formattedMessage += `\n---\n🕐 ${timestamp}`;
  
  return sendLineNotify(formattedMessage);
}

/**
 * Risk Warning Alert
 * ส่งเตือนเมื่อเลขใกล้เต็มโควตา
 */
export async function sendRiskWarning(
  number: string,
  marketName: string,
  currentVolume: number,
  limit: number,
  usagePercent: number
): Promise<void> {
  const isCritical = usagePercent >= 95;
  
  await sendLineAlert(
    isCritical ? 'risk_critical' : 'risk_warning',
    isCritical 
      ? `เลข ${number} เกือบเต็มแล้ว!`
      : `เลข ${number} ใกล้เต็มโควตา!`,
    {
      'ตลาด': marketName,
      'เลข': number,
      'ยอดปัจจุบัน': `${currentVolume.toLocaleString()} บาท`,
      'วงเงิน': `${limit.toLocaleString()} บาท`,
      'ใช้ไป': `${usagePercent.toFixed(1)}%`,
    }
  );
}

/**
 * Deposit Alert
 */
export async function sendDepositAlert(
  customerName: string,
  amount: number,
  agentName: string
): Promise<void> {
  await sendLineAlert('deposit_pending', 'มีรายการฝากเงินรอตรวจสอบ', {
    'ลูกค้า': customerName,
    'จำนวน': `${amount.toLocaleString()} บาท`,
    'สาย': agentName,
  });
}

/**
 * Withdrawal Alert
 */
export async function sendWithdrawalAlert(
  customerName: string,
  amount: number,
  agentName: string
): Promise<void> {
  await sendLineAlert('withdraw_pending', 'มีรายการถอนเงินรอดำเนินการ', {
    'ลูกค้า': customerName,
    'จำนวน': `${amount.toLocaleString()} บาท`,
    'สาย': agentName,
  });
}

/**
 * Agent Offline Alert
 */
export async function sendAgentOfflineAlert(
  agentCode: string,
  agentName: string,
  lastSeen: string
): Promise<void> {
  await sendLineAlert('agent_offline', `${agentName} ขาดการเชื่อมต่อ`, {
    'รหัส': agentCode,
    'ชื่อ': agentName,
    'เห็นล่าสุด': lastSeen,
  });
}

/**
 * Emergency Alert
 */
export async function sendEmergencyAlert(
  title: string,
  description: string
): Promise<void> {
  await sendLineAlert('emergency', title, {
    'รายละเอียด': description,
  });
}

/**
 * Big Winner Alert
 */
export async function sendBigWinnerAlert(
  customerName: string,
  number: string,
  betType: string,
  amount: number,
  agentName: string
): Promise<void> {
  await sendLineNotify(
    `\n🎉 ถูกรางวัล!\n---\nลูกค้า: ${customerName}\nเลข: ${number}\nประเภท: ${betType}\nจำนวน: ${amount.toLocaleString()} บาท\nสาย: ${agentName}\n---\n🕐 ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
  );
}

// Export shorthand function for quick alerts
export { sendLineNotify as sendLineAlert_Simple };
