/**
 * LINE Notification Multi-Tenant System
 * 
 * Integrates LINE Notification into Sub-Web Multi-Tenant architecture:
 * 1. Mother Web (Super Admin) routes system errors/risk alerts to main LINE_GROUP_ID
 * 2. Each Sub-Web tenant can configure their own LINE Token for their notifications
 * 
 * Environment Variables (Mother Web):
 * - LINE_CHANNEL_ACCESS_TOKEN: Mother Web's LINE Channel Access Token
 * - LINE_GROUP_ID: Mother Web's main LINE group for system alerts
 * 
 * Tenant Configuration (stored in tenants table):
 * - line_channel_token: Tenant's own LINE Channel Access Token
 * - line_group_id: Tenant's LINE group for deposit/withdraw/bet notifications
 * - line_notification_enabled: Toggle notifications on/off
 */

import { createClient } from '@/lib/supabase/server';
import { sendLineNotify, sendLineAlert, AlertType, sendSystemErrorAlert } from './line-notify';

// =============================================
// TYPES
// =============================================

export type TenantNotificationType =
  | 'deposit_received'    // ลูกค้าฝากเงิน
  | 'deposit_approved'    // อนุมัติฝากเงิน
  | 'withdraw_requested'  // ลูกค้าขอถอน
  | 'withdraw_completed'  // ถอนเงินสำเร็จ
  | 'bet_placed'          // รับแทงหวย
  | 'bet_won'             // ถูกรางวัล
  | 'new_customer'        // ลูกค้าใหม่
  | 'daily_summary';      // สรุปยอดรายวัน

export type MotherWebAlertType =
  | 'system_error'        // ระบบ Error
  | 'risk_critical'       // ความเสี่ยงสูง
  | 'risk_warning'        // แจ้งเตือนความเสี่ยง
  | 'tenant_offline'      // Sub-Web ไม่ตอบสนอง
  | 'security_alert'      // แจ้งเตือนความปลอดภัย
  | 'daily_aggregation';  // สรุปยอดรวมทุก Sub-Web

export interface TenantLineConfig {
  tenant_id: string;
  tenant_name: string;
  line_channel_token: string | null;
  line_group_id: string | null;
  line_notification_enabled: boolean;
}

export interface TenantNotificationPayload {
  type: TenantNotificationType;
  title?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface MotherWebAlertPayload {
  type: MotherWebAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  affectedTenants?: string[]; // List of tenant names affected
}

// =============================================
// TENANT LINE CONFIG MANAGEMENT
// =============================================

/**
 * Get tenant's LINE configuration
 */
export async function getTenantLineConfig(tenantId: string): Promise<TenantLineConfig | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, line_channel_token, line_group_id, line_notification_enabled')
    .eq('id', tenantId)
    .single();
  
  if (error || !data) {
    console.error('[LINE Multi-Tenant] Failed to get tenant config:', error);
    return null;
  }
  
  return {
    tenant_id: data.id,
    tenant_name: data.name,
    line_channel_token: data.line_channel_token,
    line_group_id: data.line_group_id,
    line_notification_enabled: data.line_notification_enabled ?? true,
  };
}

/**
 * Update tenant's LINE configuration
 * Called from tenant's background configuration UI
 */
export async function updateTenantLineConfig(
  tenantId: string,
  config: {
    line_channel_token?: string;
    line_group_id?: string;
    line_notification_enabled?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('tenants')
    .update({
      line_channel_token: config.line_channel_token,
      line_group_id: config.line_group_id,
      line_notification_enabled: config.line_notification_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);
  
  if (error) {
    console.error('[LINE Multi-Tenant] Failed to update tenant config:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Test tenant's LINE connection
 */
export async function testTenantLineConnection(tenantId: string): Promise<{ success: boolean; error?: string }> {
  const config = await getTenantLineConfig(tenantId);
  
  if (!config) {
    return { success: false, error: 'ไม่พบข้อมูล Tenant' };
  }
  
  if (!config.line_channel_token || !config.line_group_id) {
    return { success: false, error: 'ยังไม่ได้ตั้งค่า LINE Token หรือ Group ID' };
  }
  
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const testMessage = `🔔 ทดสอบการเชื่อมต่อ LINE\n━━━━━━━━━━━━━━━━\nเว็บ: ${config.tenant_name}\nระบบทำงานปกติ\n🕐 ${timestamp}`;
  
  return sendLineNotify(testMessage, {
    channelAccessToken: config.line_channel_token,
    groupId: config.line_group_id,
  });
}

// =============================================
// TENANT NOTIFICATION FUNCTIONS
// =============================================

/**
 * Send notification to a specific tenant's LINE group
 * Uses tenant's own LINE Token and Group ID
 */
export async function sendTenantNotification(
  tenantId: string,
  payload: TenantNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  const config = await getTenantLineConfig(tenantId);
  
  if (!config) {
    return { success: false, error: 'ไม่พบข้อมูล Tenant' };
  }
  
  // Check if notifications are enabled
  if (!config.line_notification_enabled) {
    console.log(`[LINE Multi-Tenant] Notifications disabled for tenant ${config.tenant_name}`);
    return { success: true }; // Silent success - notifications disabled
  }
  
  // Check if LINE is configured
  if (!config.line_channel_token || !config.line_group_id) {
    // Fallback: Use mother web's LINE if tenant not configured
    console.log(`[LINE Multi-Tenant] Tenant ${config.tenant_name} not configured, using mother web`);
    
    // Only send critical notifications to mother web
    if (['bet_won', 'withdraw_requested'].includes(payload.type)) {
      const fallbackMessage = `[${config.tenant_name}] ${payload.message}`;
      return sendLineNotify(fallbackMessage);
    }
    
    return { success: true }; // Silent success - no config
  }
  
  // Format message with tenant branding
  const icon = TENANT_NOTIFICATION_ICONS[payload.type];
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  
  let message = `${icon} ${payload.title || TENANT_NOTIFICATION_TITLES[payload.type]}\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += payload.message;
  
  if (payload.data) {
    message += '\n---';
    for (const [key, value] of Object.entries(payload.data)) {
      message += `\n${key}: ${value}`;
    }
  }
  
  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `🕐 ${timestamp}`;
  
  return sendLineNotify(message, {
    channelAccessToken: config.line_channel_token,
    groupId: config.line_group_id,
  });
}

const TENANT_NOTIFICATION_ICONS: Record<TenantNotificationType, string> = {
  deposit_received: '💰',
  deposit_approved: '✅',
  withdraw_requested: '📤',
  withdraw_completed: '✅',
  bet_placed: '📝',
  bet_won: '🎉',
  new_customer: '👤',
  daily_summary: '📊',
};

const TENANT_NOTIFICATION_TITLES: Record<TenantNotificationType, string> = {
  deposit_received: 'มีรายการฝากเงิน',
  deposit_approved: 'เติมเครดิตสำเร็จ',
  withdraw_requested: 'คำขอถอนเงิน',
  withdraw_completed: 'ถอนเงินสำเร็จ',
  bet_placed: 'รับแทงสำเร็จ',
  bet_won: 'ถูกรางวัล!',
  new_customer: 'สมาชิกใหม่',
  daily_summary: 'สรุปยอดรายวัน',
};

// =============================================
// QUICK TENANT NOTIFICATION FUNCTIONS
// =============================================

/**
 * Notify tenant about deposit received
 */
export async function notifyTenantDeposit(
  tenantId: string,
  data: { customerName: string; amount: number; bankName?: string; slipRef?: string }
): Promise<void> {
  await sendTenantNotification(tenantId, {
    type: 'deposit_received',
    message: `ลูกค้า: ${data.customerName}\nจำนวน: ${data.amount.toLocaleString()} บาท`,
    data: {
      ...(data.bankName && { 'ธนาคาร': data.bankName }),
      ...(data.slipRef && { 'อ้างอิง': data.slipRef }),
    },
  });
}

/**
 * Notify tenant about withdrawal request
 */
export async function notifyTenantWithdrawal(
  tenantId: string,
  data: { customerName: string; amount: number; bankName: string; accountNo: string }
): Promise<void> {
  await sendTenantNotification(tenantId, {
    type: 'withdraw_requested',
    message: `ลูกค้า: ${data.customerName}\nจำนวน: ${data.amount.toLocaleString()} บาท`,
    data: {
      'ธนาคาร': data.bankName,
      'เลขบัญชี': `***${data.accountNo.slice(-4)}`,
    },
  });
}

/**
 * Notify tenant about bet placed (manual keying)
 */
export async function notifyTenantBetPlaced(
  tenantId: string,
  data: { customerName: string; lotteryName: string; totalAmount: number; betCount: number }
): Promise<void> {
  await sendTenantNotification(tenantId, {
    type: 'bet_placed',
    message: `ลูกค้า: ${data.customerName}\nหวย: ${data.lotteryName}`,
    data: {
      'จำนวนรายการ': `${data.betCount} รายการ`,
      'ยอดรวม': `${data.totalAmount.toLocaleString()} บาท`,
    },
  });
}

/**
 * Notify tenant about big winner
 */
export async function notifyTenantBigWin(
  tenantId: string,
  data: { customerName: string; number: string; betType: string; payout: number; lotteryName: string }
): Promise<void> {
  await sendTenantNotification(tenantId, {
    type: 'bet_won',
    title: '🎉 ถูกรางวัลใหญ่!',
    message: `ลูกค้า: ${data.customerName}\nเลข: ${data.number} (${data.betType})`,
    data: {
      'หวย': data.lotteryName,
      'ยอดรับ': `${data.payout.toLocaleString()} บาท`,
    },
  });
}

/**
 * Notify tenant about new customer registration
 */
export async function notifyTenantNewCustomer(
  tenantId: string,
  data: { customerName: string; phone: string; referredBy?: string }
): Promise<void> {
  await sendTenantNotification(tenantId, {
    type: 'new_customer',
    message: `ชื่อ: ${data.customerName}\nเบอร์โทร: ${data.phone}`,
    data: data.referredBy ? { 'แนะนำโดย': data.referredBy } : undefined,
  });
}

/**
 * Send tenant's daily summary
 */
export async function notifyTenantDailySummary(
  tenantId: string,
  data: {
    date: string;
    totalDeposits: number;
    totalWithdrawals: number;
    totalBets: number;
    totalPayouts: number;
    netProfit: number;
    newCustomers: number;
  }
): Promise<void> {
  const profitIcon = data.netProfit >= 0 ? '📈' : '📉';
  const profitText = data.netProfit >= 0 ? 'กำไร' : 'ขาดทุน';
  
  await sendTenantNotification(tenantId, {
    type: 'daily_summary',
    title: `📊 สรุปยอดประจำวัน ${data.date}`,
    message: `ยอดฝาก: ${data.totalDeposits.toLocaleString()} บาท\nยอดถอน: ${data.totalWithdrawals.toLocaleString()} บาท`,
    data: {
      'ยอดแทง': `${data.totalBets.toLocaleString()} บาท`,
      'ยอดจ่าย': `${data.totalPayouts.toLocaleString()} บาท`,
      [`${profitIcon} ${profitText}`]: `${Math.abs(data.netProfit).toLocaleString()} บาท`,
      'สมาชิกใหม่': `${data.newCustomers} คน`,
    },
  });
}

// =============================================
// MOTHER WEB ALERT FUNCTIONS
// =============================================

/**
 * Send alert to Mother Web's main LINE group
 * For system errors and major risk alerts
 */
export async function sendMotherWebAlert(
  payload: MotherWebAlertPayload
): Promise<{ success: boolean; error?: string }> {
  const severityIcons: Record<string, string> = {
    low: '🟡',
    medium: '🟠',
    high: '🔴',
    critical: '⛔',
  };
  
  const typeIcons: Record<MotherWebAlertType, string> = {
    system_error: '❌',
    risk_critical: '🚨',
    risk_warning: '⚠️',
    tenant_offline: '📡',
    security_alert: '🔒',
    daily_aggregation: '📊',
  };
  
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  
  let message = `${typeIcons[payload.type]} ${severityIcons[payload.severity]} ${payload.title}\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `ระดับ: ${payload.severity.toUpperCase()}\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += payload.message;
  
  if (payload.data) {
    message += '\n---';
    for (const [key, value] of Object.entries(payload.data)) {
      message += `\n${key}: ${value}`;
    }
  }
  
  if (payload.affectedTenants && payload.affectedTenants.length > 0) {
    message += `\n---\n🏢 เว็บที่เกี่ยวข้อง: ${payload.affectedTenants.join(', ')}`;
  }
  
  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `🕐 ${timestamp}`;
  
  // Send to Mother Web's main LINE group (uses ENV variables)
  return sendLineNotify(message);
}

// =============================================
// QUICK MOTHER WEB ALERT FUNCTIONS
// =============================================

/**
 * Alert Mother Web about system error
 */
export async function alertMotherWebSystemError(
  errorType: string,
  errorMessage: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  affectedTenants?: string[]
): Promise<void> {
  await sendMotherWebAlert({
    type: 'system_error',
    severity,
    title: `ระบบ Error: ${errorType}`,
    message: errorMessage,
    affectedTenants,
  });
}

/**
 * Alert Mother Web about critical risk
 */
export async function alertMotherWebRiskCritical(
  data: {
    number: string;
    lotteryName: string;
    totalExposure: number;
    limit: number;
    topTenants: { name: string; amount: number }[];
  }
): Promise<void> {
  const topTenantsText = data.topTenants
    .map(t => `${t.name}: ${t.amount.toLocaleString()}`)
    .join('\n');
  
  await sendMotherWebAlert({
    type: 'risk_critical',
    severity: 'critical',
    title: `เลข ${data.number} เกินวงเงิน!`,
    message: `หวย: ${data.lotteryName}\nยอดรวมทุกเว็บ: ${data.totalExposure.toLocaleString()} บาท\nวงเงินกลาง: ${data.limit.toLocaleString()} บาท`,
    data: {
      'ยอดตามเว็บ': `\n${topTenantsText}`,
    },
  });
}

/**
 * Alert Mother Web about tenant offline
 */
export async function alertMotherWebTenantOffline(
  tenantName: string,
  lastSeen: string,
  errorCount: number
): Promise<void> {
  await sendMotherWebAlert({
    type: 'tenant_offline',
    severity: errorCount > 10 ? 'high' : 'medium',
    title: `เว็บลูก "${tenantName}" ไม่ตอบสนอง`,
    message: `เห็นล่าสุด: ${lastSeen}`,
    data: {
      'จำนวน Error': `${errorCount} ครั้ง`,
    },
    affectedTenants: [tenantName],
  });
}

/**
 * Alert Mother Web about security breach
 */
export async function alertMotherWebSecurityAlert(
  alertType: string,
  description: string,
  affectedTenants?: string[]
): Promise<void> {
  await sendMotherWebAlert({
    type: 'security_alert',
    severity: 'critical',
    title: `แจ้งเตือนความปลอดภัย: ${alertType}`,
    message: description,
    affectedTenants,
  });
}

/**
 * Send daily aggregation report to Mother Web
 */
export async function sendMotherWebDailyAggregation(
  data: {
    date: string;
    totalTenants: number;
    activeTenants: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalBets: number;
    totalPayouts: number;
    netProfit: number;
    topTenant: { name: string; profit: number };
    riskAlerts: number;
  }
): Promise<void> {
  const profitIcon = data.netProfit >= 0 ? '📈' : '📉';
  const profitText = data.netProfit >= 0 ? 'กำไรรวม' : 'ขาดทุนรวม';
  
  await sendMotherWebAlert({
    type: 'daily_aggregation',
    severity: 'low',
    title: `สรุปยอดรวมทุกเว็บ ${data.date}`,
    message: `เว็บออนไลน์: ${data.activeTenants}/${data.totalTenants} เว็บ`,
    data: {
      'ยอดฝากรวม': `${data.totalDeposits.toLocaleString()} บาท`,
      'ยอดถอนรวม': `${data.totalWithdrawals.toLocaleString()} บาท`,
      'ยอดแทงรวม': `${data.totalBets.toLocaleString()} บาท`,
      'ยอดจ่ายรวม': `${data.totalPayouts.toLocaleString()} บาท`,
      [`${profitIcon} ${profitText}`]: `${Math.abs(data.netProfit).toLocaleString()} บาท`,
      '🏆 เว็บกำไรสูงสุด': `${data.topTenant.name} (${data.topTenant.profit.toLocaleString()} บาท)`,
      '⚠️ แจ้งเตือนความเสี่ยง': `${data.riskAlerts} ครั้ง`,
    },
  });
}

// =============================================
// EXPORT
// =============================================

export const LineMultiTenant = {
  // Config
  getTenantLineConfig,
  updateTenantLineConfig,
  testTenantLineConnection,
  // Tenant notifications
  sendTenantNotification,
  notifyTenantDeposit,
  notifyTenantWithdrawal,
  notifyTenantBetPlaced,
  notifyTenantBigWin,
  notifyTenantNewCustomer,
  notifyTenantDailySummary,
  // Mother Web alerts
  sendMotherWebAlert,
  alertMotherWebSystemError,
  alertMotherWebRiskCritical,
  alertMotherWebTenantOffline,
  alertMotherWebSecurityAlert,
  sendMotherWebDailyAggregation,
};
