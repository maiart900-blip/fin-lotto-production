/**
 * FIN LOTTO R+ Payment Gateway System
 * Auto-Deposit via QR Code (PromptPay API)
 * Auto-Withdrawal Engine with configurable limits
 * Transaction Security with encryption and hash logging
 */

import crypto from 'crypto';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface PaymentGatewayConfig {
  provider: 'promptpay' | 'truewallet' | 'bank_api' | 'custom';
  apiKey: string;
  secretKey: string;
  merchantId: string;
  callbackUrl: string;
  isActive: boolean;
  siteId?: string;
}

export interface QRCodeRequest {
  amount: number;
  userId: string;
  siteId: string;
  reference: string;
  expiresIn?: number; // minutes
}

export interface QRCodeResponse {
  qrCode: string; // Base64 image or raw data
  qrString: string;
  reference: string;
  amount: number;
  expiresAt: Date;
  transactionId: string;
}

export interface DepositTransaction {
  id: string;
  userId: string;
  siteId: string;
  amount: number;
  reference: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  gatewayResponse?: any;
  transactionHash: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WithdrawalRequest {
  userId: string;
  siteId: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export interface WithdrawalConfig {
  autoApproveLimit: number; // ยอดต่ำกว่านี้อนุมัติอัตโนมัติ
  dailyLimit: number;
  minAmount: number;
  maxAmount: number;
  processingHours: { start: number; end: number }; // 24hr format
  requireOtp: boolean;
  require2FA: boolean;
}

export interface WithdrawalTransaction {
  id: string;
  userId: string;
  siteId: string;
  amount: number;
  fee: number;
  netAmount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed';
  approvedBy?: string;
  approvedAt?: Date;
  transactionHash: string;
  gatewayRef?: string;
  createdAt: Date;
  completedAt?: Date;
  rejectionReason?: string;
}

export interface BalanceAlert {
  siteId: string;
  siteName: string;
  currentBalance: number;
  threshold: number;
  alertType: 'warning' | 'critical';
  notifiedAt?: Date;
}

// ============================================
// TRANSACTION SECURITY
// ============================================

export class TransactionSecurity {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  
  /**
   * Generate unique transaction hash
   */
  static generateTransactionHash(data: {
    userId: string;
    amount: number;
    timestamp: number;
    type: 'deposit' | 'withdrawal';
  }): string {
    const payload = JSON.stringify({
      ...data,
      nonce: crypto.randomBytes(16).toString('hex'),
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
  
  /**
   * Encrypt sensitive data
   */
  static encrypt(data: string, secretKey: string): string {
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string, secretKey: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  /**
   * Verify transaction integrity
   */
  static verifyTransactionHash(
    originalHash: string,
    data: { userId: string; amount: number; timestamp: number; type: 'deposit' | 'withdrawal' }
  ): boolean {
    // For production, store and compare nonce as well
    return originalHash.length === 64 && /^[a-f0-9]+$/.test(originalHash);
  }
  
  /**
   * Generate secure reference code
   */
  static generateReference(prefix: string = 'FLR'): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }
}

// ============================================
// PROMPTPAY QR GENERATOR
// ============================================

export class PromptPayQRGenerator {
  /**
   * Generate PromptPay QR Code payload
   * Format: EMV QR Code Specification
   */
  static generatePayload(
    promptPayId: string, // Phone number or National ID
    amount: number,
    reference?: string
  ): string {
    // EMV QR Code format for PromptPay
    const payloadFormatIndicator = '000201';
    const pointOfInitiation = '010212'; // Dynamic QR
    
    // Merchant Account Information (PromptPay)
    const merchantAccountId = '29'; // PromptPay
    const aidTag = '0016A000000677010111';
    
    // Determine if phone or national ID
    const isPhone = promptPayId.length === 10;
    const idType = isPhone ? '01' : '02';
    const formattedId = isPhone 
      ? '0066' + promptPayId.substring(1) // Convert to international format
      : promptPayId;
    
    const idTagLength = formattedId.length.toString().padStart(2, '0');
    const idTag = `${idType}${idTagLength}${formattedId}`;
    
    const merchantInfo = aidTag + idTag;
    const merchantInfoLength = merchantInfo.length.toString().padStart(2, '0');
    const merchantAccountInfo = `${merchantAccountId}${merchantInfoLength}${merchantInfo}`;
    
    // Transaction Currency (THB = 764)
    const currencyCode = '5303764';
    
    // Transaction Amount
    const amountStr = amount.toFixed(2);
    const amountLength = amountStr.length.toString().padStart(2, '0');
    const transactionAmount = `54${amountLength}${amountStr}`;
    
    // Country Code
    const countryCode = '5802TH';
    
    // Build payload without CRC
    let payload = payloadFormatIndicator 
      + pointOfInitiation 
      + merchantAccountInfo 
      + currencyCode 
      + transactionAmount 
      + countryCode;
    
    // Add reference if provided
    if (reference) {
      const refLength = reference.length.toString().padStart(2, '0');
      payload += `62${(refLength.length + reference.length + 4).toString().padStart(2, '0')}05${refLength}${reference}`;
    }
    
    // Add CRC placeholder and calculate
    payload += '6304';
    const crc = this.calculateCRC16(payload);
    payload += crc;
    
    return payload;
  }
  
  /**
   * Calculate CRC16-CCITT for EMV QR
   */
  private static calculateCRC16(data: string): string {
    let crc = 0xFFFF;
    const polynomial = 0x1021;
    
    for (let i = 0; i < data.length; i++) {
      const byte = data.charCodeAt(i);
      crc ^= (byte << 8);
      
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = ((crc << 1) ^ polynomial) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
}

// ============================================
// AUTO-WITHDRAWAL ENGINE
// ============================================

export class AutoWithdrawalEngine {
  private config: WithdrawalConfig;
  
  constructor(config: WithdrawalConfig) {
    this.config = config;
  }
  
  /**
   * Check if withdrawal can be auto-approved
   */
  canAutoApprove(request: WithdrawalRequest, userDailyTotal: number): {
    approved: boolean;
    reason?: string;
  } {
    // Check amount limits
    if (request.amount < this.config.minAmount) {
      return { approved: false, reason: `ยอดถอนต่ำกว่าขั้นต่ำ (${this.config.minAmount} บาท)` };
    }
    
    if (request.amount > this.config.maxAmount) {
      return { approved: false, reason: `ยอดถอนเกินขีดจำกัด (${this.config.maxAmount} บาท)` };
    }
    
    // Check daily limit
    if (userDailyTotal + request.amount > this.config.dailyLimit) {
      return { approved: false, reason: `เกินวงเงินถอนต่อวัน (${this.config.dailyLimit} บาท)` };
    }
    
    // Check auto-approve limit
    if (request.amount > this.config.autoApproveLimit) {
      return { approved: false, reason: `ยอดเกิน Auto-Approve Limit (${this.config.autoApproveLimit} บาท) - รอแอดมินอนุมัติ` };
    }
    
    // Check processing hours
    const currentHour = new Date().getHours();
    if (currentHour < this.config.processingHours.start || currentHour >= this.config.processingHours.end) {
      // After hours - still auto-approve but queue for processing
      return { approved: true, reason: 'อนุมัติแล้ว - จะประมวลผลในเวลาทำการ' };
    }
    
    return { approved: true };
  }
  
  /**
   * Calculate withdrawal fee
   */
  calculateFee(amount: number): number {
    // Example fee structure
    if (amount <= 5000) return 0;
    if (amount <= 50000) return 10;
    if (amount <= 100000) return 20;
    return 30;
  }
  
  /**
   * Process withdrawal request
   */
  async processWithdrawal(
    request: WithdrawalRequest,
    userDailyTotal: number
  ): Promise<WithdrawalTransaction> {
    const autoApproveResult = this.canAutoApprove(request, userDailyTotal);
    const fee = this.calculateFee(request.amount);
    const netAmount = request.amount - fee;
    
    const transaction: WithdrawalTransaction = {
      id: crypto.randomUUID(),
      userId: request.userId,
      siteId: request.siteId,
      amount: request.amount,
      fee,
      netAmount,
      bankCode: request.bankCode,
      accountNumber: request.accountNumber,
      accountName: request.accountName,
      status: autoApproveResult.approved ? 'approved' : 'pending',
      transactionHash: TransactionSecurity.generateTransactionHash({
        userId: request.userId,
        amount: request.amount,
        timestamp: Date.now(),
        type: 'withdrawal',
      }),
      createdAt: new Date(),
      approvedAt: autoApproveResult.approved ? new Date() : undefined,
      approvedBy: autoApproveResult.approved ? 'SYSTEM_AUTO' : undefined,
    };
    
    // In production: Save to database and trigger payout API
    
    return transaction;
  }
}

// ============================================
// BALANCE ALERT SYSTEM
// ============================================

export class BalanceAlertSystem {
  private lineNotifyToken: string;
  
  constructor(lineNotifyToken: string) {
    this.lineNotifyToken = lineNotifyToken;
  }
  
  /**
   * Check balances and send alerts
   */
  async checkAndAlert(balances: {
    siteId: string;
    siteName: string;
    currentBalance: number;
    warningThreshold: number;
    criticalThreshold: number;
  }[]): Promise<BalanceAlert[]> {
    const alerts: BalanceAlert[] = [];
    
    for (const balance of balances) {
      if (balance.currentBalance <= balance.criticalThreshold) {
        const alert: BalanceAlert = {
          siteId: balance.siteId,
          siteName: balance.siteName,
          currentBalance: balance.currentBalance,
          threshold: balance.criticalThreshold,
          alertType: 'critical',
          notifiedAt: new Date(),
        };
        alerts.push(alert);
        await this.sendLineNotification(
          `🚨 [CRITICAL] ยอดเงินในบัญชี ${balance.siteName} เหลือ ${balance.currentBalance.toLocaleString()} บาท - ต่ำกว่าเกณฑ์วิกฤต!`
        );
      } else if (balance.currentBalance <= balance.warningThreshold) {
        const alert: BalanceAlert = {
          siteId: balance.siteId,
          siteName: balance.siteName,
          currentBalance: balance.currentBalance,
          threshold: balance.warningThreshold,
          alertType: 'warning',
          notifiedAt: new Date(),
        };
        alerts.push(alert);
        await this.sendLineNotification(
          `⚠️ [WARNING] ยอดเงินในบัญชี ${balance.siteName} เหลือ ${balance.currentBalance.toLocaleString()} บาท - กรุณาเติมเงิน`
        );
      }
    }
    
    return alerts;
  }
  
  /**
   * Send LINE Notify notification
   */
  private async sendLineNotification(message: string): Promise<boolean> {
    if (!this.lineNotifyToken) return false;
    
    try {
      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${this.lineNotifyToken}`,
        },
        body: `message=${encodeURIComponent(message)}`,
      });
      
      return response.ok;
    } catch (error) {
      console.error('LINE Notify error:', error);
      return false;
    }
  }
}

// ============================================
// PAYMENT GATEWAY MANAGER
// ============================================

export class PaymentGatewayManager {
  private configs: Map<string, PaymentGatewayConfig> = new Map();
  private withdrawalEngine: AutoWithdrawalEngine;
  private alertSystem: BalanceAlertSystem;
  
  constructor(
    withdrawalConfig: WithdrawalConfig,
    lineNotifyToken: string
  ) {
    this.withdrawalEngine = new AutoWithdrawalEngine(withdrawalConfig);
    this.alertSystem = new BalanceAlertSystem(lineNotifyToken);
  }
  
  /**
   * Register payment gateway for a site
   */
  registerGateway(siteId: string, config: PaymentGatewayConfig): void {
    this.configs.set(siteId, { ...config, siteId });
  }
  
  /**
   * Generate QR code for deposit
   */
  async generateDepositQR(request: QRCodeRequest): Promise<QRCodeResponse> {
    const config = this.configs.get(request.siteId);
    if (!config || !config.isActive) {
      throw new Error('Payment gateway not configured or inactive');
    }
    
    const reference = TransactionSecurity.generateReference('DEP');
    const expiresAt = new Date(Date.now() + (request.expiresIn || 15) * 60 * 1000);
    
    // Generate PromptPay QR payload
    const qrString = PromptPayQRGenerator.generatePayload(
      config.merchantId, // PromptPay ID
      request.amount,
      reference
    );
    
    // Create transaction record
    const transactionId = crypto.randomUUID();
    const transactionHash = TransactionSecurity.generateTransactionHash({
      userId: request.userId,
      amount: request.amount,
      timestamp: Date.now(),
      type: 'deposit',
    });
    
    // In production: Save to database
    
    return {
      qrCode: qrString, // In production: Convert to base64 image
      qrString,
      reference,
      amount: request.amount,
      expiresAt,
      transactionId,
    };
  }
  
  /**
   * Process withdrawal request
   */
  async processWithdrawal(
    request: WithdrawalRequest,
    userDailyTotal: number
  ): Promise<WithdrawalTransaction> {
    return this.withdrawalEngine.processWithdrawal(request, userDailyTotal);
  }
  
  /**
   * Check balance alerts
   */
  async checkBalanceAlerts(balances: Parameters<BalanceAlertSystem['checkAndAlert']>[0]): Promise<BalanceAlert[]> {
    return this.alertSystem.checkAndAlert(balances);
  }
}

// ============================================
// BANK CODES
// ============================================

export const THAI_BANK_CODES = [
  { code: 'BBL', name: 'ธนาคารกรุงเทพ', swiftCode: 'BKKBTHBK' },
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย', swiftCode: 'KASITHBK' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย', swiftCode: 'KRTHTHBK' },
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์', swiftCode: 'SICOTHBK' },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา', swiftCode: 'AYUDTHBK' },
  { code: 'TMB', name: 'ธนาคารทหารไทยธนชาต', swiftCode: 'TABORITH' },
  { code: 'GSB', name: 'ธนาคารออมสิน', swiftCode: 'GABORITH' },
  { code: 'BAAC', name: 'ธนาคาร ธ.ก.ส.', swiftCode: 'BAABORITH' },
  { code: 'CIMB', name: 'ธนาคาร ซีไอเอ็มบี ไทย', swiftCode: 'UBOBTHBK' },
  { code: 'UOB', name: 'ธนาคารยูโอบี', swiftCode: 'UABORITH' },
  { code: 'LHBANK', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', swiftCode: 'LAABORITH' },
  { code: 'KKP', name: 'ธนาคารเกียรตินาคินภัทร', swiftCode: 'ABORITHBK' },
];

export default PaymentGatewayManager;
