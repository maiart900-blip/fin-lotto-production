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
  | 'system_alert'      // แจ้งเตือนระบบ
  | 'daily_closing'     // ปิดยอดรายวัน
  | 'new_member'        // สมาชิกใหม่
  | 'abnormal_bet'      // ยอดแทงผิดปกติ
  | 'system_error'      // ระบบ Error
  | 'big_winner';       // ถูกรางวัลใหญ่

// Alert Icons
const ALERT_ICONS: Record<AlertType, string> = {
  risk_warning: '⚠️',
  risk_critical: '🚨',
  deposit_pending: '💰',
  withdraw_pending: '💸',
  agent_offline: '📡',
  emergency: '🆘',
  system_alert: '🔔',
  daily_closing: '📊',
  new_member: '👤',
  abnormal_bet: '⚠️',
  system_error: '❌',
  big_winner: '🎉',
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

/**
 * Daily Closing Alert
 * ส่งสรุปยอดรายวันให้แอดมิน
 */
export async function sendDailyClosingAlert(
  date: string,
  summary: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalBets: number;
    totalPayouts: number;
    netProfit: number;
    newCustomers: number;
  }
): Promise<void> {
  const profitIcon = summary.netProfit >= 0 ? '📈' : '📉';
  const profitText = summary.netProfit >= 0 ? 'กำไร' : 'ขาดทุน';
  
  await sendLineAlert('daily_closing', `สรุปยอดประจำวัน ${date}`, {
    'ยอดฝาก': `${summary.totalDeposits.toLocaleString()} บาท`,
    'ยอดถอน': `${summary.totalWithdrawals.toLocaleString()} บาท`,
    'ยอดแทง': `${summary.totalBets.toLocaleString()} บาท`,
    'ยอดจ่าย': `${summary.totalPayouts.toLocaleString()} บาท`,
    [`${profitIcon} ${profitText}`]: `${Math.abs(summary.netProfit).toLocaleString()} บาท`,
    'สมาชิกใหม่': `${summary.newCustomers} คน`,
  });
}

/**
 * New Member Alert
 * แจ้งเตือนสมาชิกใหม่
 */
export async function sendNewMemberAlert(
  memberName: string,
  phone: string,
  agentName: string
): Promise<void> {
  await sendLineAlert('new_member', 'สมาชิกสมัครใหม่', {
    'ชื่อ': memberName,
    'เบอร์โทร': phone,
    'ภายใต้สาย': agentName,
  });
}

/**
 * Abnormal Bet Alert
 * แจ้งเตือนยอดแทงผิดปกติ
 */
export async function sendAbnormalBetAlert(
  customerName: string,
  totalAmount: number,
  betCount: number,
  averageAmount: number
): Promise<void> {
  await sendLineAlert('abnormal_bet', 'ตรวจพบยอดแทงผิดปกติ!', {
    'ลูกค้า': customerName,
    'ยอดรวม': `${totalAmount.toLocaleString()} บาท`,
    'จำนวนรายการ': `${betCount} รายการ`,
    'เฉลี่ยต่อรายการ': `${averageAmount.toLocaleString()} บาท`,
    'ความเสี่ยง': totalAmount > 100000 ? 'สูงมาก' : 'สูง',
  });
}

/**
 * System Error Alert
 * แจ้งเตือนระบบ Error
 */
export async function sendSystemErrorAlert(
  errorType: string,
  errorMessage: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
): Promise<void> {
  const severityIcon = {
    low: '🟡',
    medium: '🟠',
    high: '🔴',
    critical: '⛔',
  };
  
  await sendLineAlert('system_error', `${severityIcon[severity]} ระบบ Error: ${errorType}`, {
    'ข้อความ': errorMessage,
    'ระดับความรุนแรง': severity.toUpperCase(),
  });
}

/**
 * Daily Summary Report
 * ส่งรายงานสรุปเมื่อสิ้นวัน (01:00 น.)
 */
export async function sendDailySummaryReport(
  date: string,
  report: {
    deposits: { count: number; total: number };
    withdrawals: { count: number; total: number };
    bets: { count: number; total: number };
    wins: { count: number; total: number };
    newMembers: number;
    activeMembers: number;
    netProfit: number;
    topAgent?: { name: string; sales: number };
    topNumber?: { number: string; amount: number };
  }
): Promise<void> {
  const profitStatus = report.netProfit >= 0 ? '📈 กำไร' : '📉 ขาดทุน';
  
  let message = `\n📊 รายงานสรุปประจำวัน\n📅 ${date}\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `💰 ฝากเงิน: ${report.deposits.total.toLocaleString()} (${report.deposits.count} รายการ)\n`;
  message += `💸 ถอนเงิน: ${report.withdrawals.total.toLocaleString()} (${report.withdrawals.count} รายการ)\n`;
  message += `🎯 ยอดแทง: ${report.bets.total.toLocaleString()} (${report.bets.count} โพย)\n`;
  message += `🎉 ยอดจ่าย: ${report.wins.total.toLocaleString()} (${report.wins.count} รายการ)\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `${profitStatus}: ${Math.abs(report.netProfit).toLocaleString()} บาท\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `👤 สมาชิกใหม่: ${report.newMembers} คน\n`;
  message += `🟢 ใช้งานวันนี้: ${report.activeMembers} คน\n`;
  
  if (report.topAgent) {
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `🏆 ยอดขายสูงสุด: ${report.topAgent.name}\n`;
    message += `   ยอดขาย: ${report.topAgent.sales.toLocaleString()} บาท\n`;
  }
  
  if (report.topNumber) {
    message += `📌 เลขยอดแทงสูงสุด: ${report.topNumber.number}\n`;
    message += `   ยอดรวม: ${report.topNumber.amount.toLocaleString()} บาท\n`;
  }
  
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `🕐 ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;

  await sendLineNotify(message);
}
