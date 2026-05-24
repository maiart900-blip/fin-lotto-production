// =============================================================================
// SMS GATEWAY INTEGRATION - Production Ready
// =============================================================================
// รองรับ: ThaiBulkSMS, THSMS, Custom Provider
// Features: OTP, Withdrawal Alerts, Login Alerts, Promotions
// =============================================================================

import { createClient } from '@/lib/supabase/server';

export type SMSProvider = 'thaibulksms' | 'thsms' | 'custom';
export type SMSMessageType = 'otp' | 'withdrawal_alert' | 'login_alert' | 'promotion' | 'custom';

export interface SMSConfig {
  provider: SMSProvider;
  apiKey: string;
  apiSecret?: string;
  sender?: string;
  baseUrl?: string;
}

export interface SendSMSParams {
  phoneNumber: string;
  message: string;
  messageType: SMSMessageType;
  userId?: string;
  siteId?: string;
  metadata?: Record<string, unknown>;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  creditUsed?: number;
}

export interface SMSLog {
  id: string;
  phoneNumber: string;
  userId?: string;
  siteId?: string;
  messageType: SMSMessageType;
  messageContent: string;
  provider: SMSProvider;
  providerMessageId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: string;
  deliveredAt?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  creditUsed: number;
  createdAt: string;
}

// =============================================================================
// SMS GATEWAY SERVICE
// =============================================================================

class SMSGatewayService {
  private config: SMSConfig;
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  constructor() {
    // Load config from environment
    this.config = {
      provider: (process.env.SMS_PROVIDER as SMSProvider) || 'thaibulksms',
      apiKey: process.env.SMS_API_KEY || '',
      apiSecret: process.env.SMS_API_SECRET,
      sender: process.env.SMS_SENDER || 'FINLOTTO',
      baseUrl: process.env.SMS_BASE_URL,
    };
  }

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  // ---------------------------------------------------------------------------
  // SEND SMS
  // ---------------------------------------------------------------------------

  async sendSMS(params: SendSMSParams): Promise<SMSResult> {
    // Validate phone number
    const phone = this.normalizePhoneNumber(params.phoneNumber);
    if (!this.isValidThaiPhone(phone)) {
      return { success: false, error: 'Invalid phone number' };
    }

    // Create log entry
    const logId = await this.createSMSLog(params, phone);

    try {
      let result: SMSResult;

      switch (this.config.provider) {
        case 'thaibulksms':
          result = await this.sendViaThaiBulkSMS(phone, params.message);
          break;
        case 'thsms':
          result = await this.sendViaTHSMS(phone, params.message);
          break;
        case 'custom':
          result = await this.sendViaCustomProvider(phone, params.message);
          break;
        default:
          throw new Error(`Unknown SMS provider: ${this.config.provider}`);
      }

      // Update log
      await this.updateSMSLog(logId, {
        status: result.success ? 'sent' : 'failed',
        providerMessageId: result.messageId,
        sentAt: result.success ? new Date().toISOString() : undefined,
        errorMessage: result.error,
        creditUsed: result.creditUsed || 0,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.updateSMSLog(logId, {
        status: 'failed',
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  // ---------------------------------------------------------------------------
  // PROVIDER IMPLEMENTATIONS
  // ---------------------------------------------------------------------------

  private async sendViaThaiBulkSMS(phone: string, message: string): Promise<SMSResult> {
    const url = 'https://bulk.thaibulksms.com/sms.php';
    
    const params = new URLSearchParams({
      username: this.config.apiKey,
      password: this.config.apiSecret || '',
      msisdn: phone,
      message: message,
      sender: this.config.sender || 'FINLOTTO',
      force: 'corporate',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await response.text();
    
    // Parse ThaiBulkSMS response
    // Success format: <QUEUE>xxxxx</QUEUE>
    // Error format: <ERROR>xxx</ERROR>
    if (text.includes('<QUEUE>')) {
      const messageId = text.match(/<QUEUE>(\d+)<\/QUEUE>/)?.[1];
      return { success: true, messageId, creditUsed: 1 };
    } else {
      const errorCode = text.match(/<ERROR>(\d+)<\/ERROR>/)?.[1];
      return { success: false, error: `ThaiBulkSMS error: ${errorCode}` };
    }
  }

  private async sendViaTHSMS(phone: string, message: string): Promise<SMSResult> {
    const url = 'https://www.thsms.com/api/rest';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
        'secret-key': this.config.apiSecret || '',
      },
      body: JSON.stringify({
        method: 'send',
        sender: this.config.sender || 'FINLOTTO',
        msisdn: [phone],
        message: message,
      }),
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      return { 
        success: true, 
        messageId: data.job_id,
        creditUsed: data.credit_used || 1,
      };
    } else {
      return { success: false, error: data.message || 'THSMS error' };
    }
  }

  private async sendViaCustomProvider(phone: string, message: string): Promise<SMSResult> {
    if (!this.config.baseUrl) {
      return { success: false, error: 'Custom provider URL not configured' };
    }

    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        phone,
        message,
        sender: this.config.sender,
      }),
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      return { success: true, messageId: data.messageId };
    } else {
      return { success: false, error: data.error || 'Custom provider error' };
    }
  }

  // ---------------------------------------------------------------------------
  // OTP FUNCTIONS
  // ---------------------------------------------------------------------------

  async sendOTP(phoneNumber: string, userId?: string, siteId?: string): Promise<{ success: boolean; otp?: string; error?: string }> {
    const otp = this.generateOTP();
    const message = `รหัส OTP ของคุณคือ: ${otp} (หมดอายุใน 5 นาที) - FIN LOTTO`;

    const result = await this.sendSMS({
      phoneNumber,
      message,
      messageType: 'otp',
      userId,
      siteId,
      metadata: { otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() },
    });

    if (result.success) {
      // Store OTP in Redis/Database for verification
      await this.storeOTP(phoneNumber, otp);
      return { success: true, otp };
    }

    return { success: false, error: result.error };
  }

  async verifyOTP(phoneNumber: string, otp: string): Promise<boolean> {
    const phone = this.normalizePhoneNumber(phoneNumber);
    const supabase = await this.getSupabase();
    
    // Get stored OTP from Redis/Database
    const { data } = await supabase
      .from('otp_codes')
      .select('code, expires_at')
      .eq('phone', phone)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return false;
    if (new Date(data.expires_at) < new Date()) return false;
    if (data.code !== otp) return false;

    // Mark as used
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('phone', phone)
      .eq('code', otp);

    return true;
  }

  private async storeOTP(phone: string, otp: string): Promise<void> {
    const supabase = await this.getSupabase();
    
    await supabase.from('otp_codes').insert({
      phone: this.normalizePhoneNumber(phone),
      code: otp,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      is_used: false,
    });
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // ---------------------------------------------------------------------------
  // ALERT FUNCTIONS
  // ---------------------------------------------------------------------------

  async sendWithdrawalAlert(
    phoneNumber: string, 
    amount: number, 
    userId?: string, 
    siteId?: string
  ): Promise<SMSResult> {
    const message = `[FIN LOTTO] มีการถอนเงิน ${amount.toLocaleString()} บาท หากไม่ใช่คุณ กรุณาติดต่อแอดมินทันที`;
    
    return this.sendSMS({
      phoneNumber,
      message,
      messageType: 'withdrawal_alert',
      userId,
      siteId,
      metadata: { amount },
    });
  }

  async sendLoginAlert(
    phoneNumber: string, 
    ipAddress: string, 
    device: string,
    userId?: string
  ): Promise<SMSResult> {
    const message = `[FIN LOTTO] มีการเข้าสู่ระบบจากอุปกรณ์ใหม่ (${device}) IP: ${ipAddress} หากไม่ใช่คุณ กรุณาเปลี่ยนรหัสผ่านทันที`;
    
    return this.sendSMS({
      phoneNumber,
      message,
      messageType: 'login_alert',
      userId,
      metadata: { ipAddress, device },
    });
  }

  async sendPromotion(
    phoneNumber: string, 
    promotionMessage: string,
    userId?: string,
    siteId?: string
  ): Promise<SMSResult> {
    return this.sendSMS({
      phoneNumber,
      message: promotionMessage,
      messageType: 'promotion',
      userId,
      siteId,
    });
  }

  // ---------------------------------------------------------------------------
  // LOGGING
  // ---------------------------------------------------------------------------

  private async createSMSLog(params: SendSMSParams, normalizedPhone: string): Promise<string> {
    const supabase = await this.getSupabase();
    
    const { data, error } = await supabase
      .from('sms_logs')
      .insert({
        phone_number: normalizedPhone,
        user_id: params.userId,
        site_id: params.siteId,
        message_type: params.messageType,
        message_content: params.message,
        provider: this.config.provider,
        status: 'pending',
        retry_count: 0,
        credit_used: 0,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private async updateSMSLog(
    logId: string, 
    updates: Partial<{
      status: string;
      providerMessageId: string;
      sentAt: string;
      deliveredAt: string;
      errorCode: string;
      errorMessage: string;
      creditUsed: number;
    }>
  ): Promise<void> {
    const supabase = await this.getSupabase();
    
    const updateData: Record<string, unknown> = {};
    if (updates.status) updateData.status = updates.status;
    if (updates.providerMessageId) updateData.provider_message_id = updates.providerMessageId;
    if (updates.sentAt) updateData.sent_at = updates.sentAt;
    if (updates.deliveredAt) updateData.delivered_at = updates.deliveredAt;
    if (updates.errorCode) updateData.error_code = updates.errorCode;
    if (updates.errorMessage) updateData.error_message = updates.errorMessage;
    if (updates.creditUsed !== undefined) updateData.credit_used = updates.creditUsed;

    await supabase
      .from('sms_logs')
      .update(updateData)
      .eq('id', logId);
  }

  async getSMSLogs(params: {
    userId?: string;
    siteId?: string;
    messageType?: SMSMessageType;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: SMSLog[]; total: number }> {
    const supabase = await this.getSupabase();
    
    let query = supabase
      .from('sms_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.userId) query = query.eq('user_id', params.userId);
    if (params.siteId) query = query.eq('site_id', params.siteId);
    if (params.messageType) query = query.eq('message_type', params.messageType);
    if (params.status) query = query.eq('status', params.status);
    if (params.startDate) query = query.gte('created_at', params.startDate);
    if (params.endDate) query = query.lte('created_at', params.endDate);
    if (params.limit) query = query.limit(params.limit);
    if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      logs: data?.map(this.mapSMSLog) || [],
      total: count || 0,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digits
    let normalized = phone.replace(/\D/g, '');
    
    // Handle Thai phone numbers
    if (normalized.startsWith('0')) {
      normalized = '66' + normalized.substring(1);
    } else if (!normalized.startsWith('66')) {
      normalized = '66' + normalized;
    }
    
    return normalized;
  }

  private isValidThaiPhone(phone: string): boolean {
    // Thai phone: 66 + 9 digits (starting with 6, 8, or 9)
    return /^66[689]\d{8}$/.test(phone);
  }

  private mapSMSLog(data: Record<string, unknown>): SMSLog {
    return {
      id: data.id as string,
      phoneNumber: data.phone_number as string,
      userId: data.user_id as string | undefined,
      siteId: data.site_id as string | undefined,
      messageType: data.message_type as SMSMessageType,
      messageContent: data.message_content as string,
      provider: data.provider as SMSProvider,
      providerMessageId: data.provider_message_id as string | undefined,
      status: data.status as SMSLog['status'],
      sentAt: data.sent_at as string | undefined,
      deliveredAt: data.delivered_at as string | undefined,
      errorCode: data.error_code as string | undefined,
      errorMessage: data.error_message as string | undefined,
      retryCount: Number(data.retry_count || 0),
      creditUsed: Number(data.credit_used || 0),
      createdAt: data.created_at as string,
    };
  }
}

// Singleton instance
let smsGateway: SMSGatewayService | null = null;

export function getSMSGateway(): SMSGatewayService {
  if (!smsGateway) {
    smsGateway = new SMSGatewayService();
  }
  return smsGateway;
}

// Export shorthand functions
export const sendSMS = (params: SendSMSParams) => getSMSGateway().sendSMS(params);
export const sendOTP = (phone: string, userId?: string, siteId?: string) => getSMSGateway().sendOTP(phone, userId, siteId);
export const verifyOTP = (phone: string, otp: string) => getSMSGateway().verifyOTP(phone, otp);
export const sendWithdrawalAlert = (phone: string, amount: number, userId?: string, siteId?: string) => 
  getSMSGateway().sendWithdrawalAlert(phone, amount, userId, siteId);
export const sendLoginAlert = (phone: string, ip: string, device: string, userId?: string) =>
  getSMSGateway().sendLoginAlert(phone, ip, device, userId);
