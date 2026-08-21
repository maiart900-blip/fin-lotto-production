/**
 * Enterprise 2FA (Two-Factor Authentication) System
 * Supports TOTP, SMS, Email, and Backup Codes
 */

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export type TwoFactorMethod = 'totp' | 'sms' | 'email' | 'backup_codes';

export interface TwoFactorSetup {
  method: TwoFactorMethod;
  secret?: string;
  qr_code_url?: string;
  backup_codes?: string[];
  recovery_email?: string;
  recovery_phone?: string;
}

export interface TwoFactorStatus {
  is_enabled: boolean;
  is_verified: boolean;
  method: TwoFactorMethod | null;
  last_used_at: string | null;
  has_backup_codes: boolean;
  recovery_email?: string;
  recovery_phone?: string;
}

// Encryption helpers
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY;
  if (!key) {
    // Generate a deterministic key from SUPABASE_URL for development
    const fallback = process.env.NEXT_PUBLIC_SUPABASE_URL || 'fallback-key';
    return crypto.createHash('sha256').update(fallback).digest();
  }
  return crypto.createHash('sha256').update(key).digest();
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

function toBase32(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let output = '';

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += alphabet[parseInt(chunk, 2)];
  }

  return output;
}
/**
 * Generate TOTP secret for user
 */
export function generateTOTPSecret(): { secret: string; otpauth_url: string } {
  const secret = toBase32(crypto.randomBytes(20)).substring(0, 32);
  const issuer = encodeURIComponent('FIN Platform');
  const otpauth_url = `otpauth://totp/${issuer}:user?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
  
  return { secret, otpauth_url };
}

/**
 * Verify TOTP code
 */
export function verifyTOTP(secret: string, code: string, window: number = 1): boolean {
  const now = Math.floor(Date.now() / 1000 / 30);
  
  for (let i = -window; i <= window; i++) {
    const expectedCode = generateTOTPCode(secret, now + i);
    if (expectedCode === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate TOTP code for a given time
 */
function generateTOTPCode(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));
  
  // Base32 decode the secret
  const secretBuffer = base32Decode(secret);
  
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(buffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

/**
 * Base32 decode helper
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const padding = encoded.indexOf('=');
  const cleanEncoded = padding >= 0 ? encoded.substring(0, padding) : encoded;
  
  let bits = '';
  for (const char of cleanEncoded.toUpperCase()) {
    const val = alphabet.indexOf(char);
    if (val >= 0) {
      bits += val.toString(2).padStart(5, '0');
    }
  }
  
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  
  return Buffer.from(bytes);
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4)}`);
  }
  return codes;
}

/**
 * Hash backup code for storage
 */
function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
}

/**
 * Initialize 2FA setup for user
 */
export async function initializeTwoFactor(
  userId: string,
  userType: string,
  method: TwoFactorMethod,
  tenantId?: string
): Promise<{ success: boolean; setup?: TwoFactorSetup; error?: string }> {
  const supabase = await createClient();
  
  let setup: TwoFactorSetup = { method };
  let secretEncrypted: string | null = null;
  let backupCodesEncrypted: string | null = null;
  
  if (method === 'totp') {
    const { secret, otpauth_url } = generateTOTPSecret();
    setup.secret = secret;
    setup.qr_code_url = otpauth_url;
    secretEncrypted = encrypt(secret);
    
    // Generate backup codes
    const backupCodes = generateBackupCodes();
    setup.backup_codes = backupCodes;
    backupCodesEncrypted = encrypt(JSON.stringify(backupCodes));
  }
  
  // Insert or update 2FA record
  const { data, error } = await supabase
    .from('user_2fa')
    .upsert({
      user_id: userId,
      user_type: userType,
      tenant_id: tenantId,
      method,
      secret_encrypted: secretEncrypted,
      backup_codes_encrypted: backupCodesEncrypted,
      is_enabled: false,
      is_verified: false,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,user_type,tenant_id'
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Store backup codes as hashes
  if (setup.backup_codes && data) {
    await supabase.from('totp_recovery_codes').delete().eq('user_2fa_id', data.id);
    
    const codeRecords = setup.backup_codes.map(code => ({
      user_2fa_id: data.id,
      code_hash: hashBackupCode(code),
      is_used: false
    }));
    
    await supabase.from('totp_recovery_codes').insert(codeRecords);
  }
  
  return { success: true, setup };
}

/**
 * Verify and enable 2FA
 */
export async function verifyAndEnableTwoFactor(
  userId: string,
  userType: string,
  code: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Get 2FA record
  const { data: twoFa, error } = await supabase
    .from('user_2fa')
    .select('*')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .eq('is_enabled', false)
    .single();
  
  if (error || !twoFa) {
    return { success: false, error: '2FA setup not found' };
  }
  
  // Verify based on method
  let isValid = false;
  
  if (twoFa.method === 'totp' && twoFa.secret_encrypted) {
    const secret = decrypt(twoFa.secret_encrypted);
    isValid = verifyTOTP(secret, code);
  }
  
  if (!isValid) {
    return { success: false, error: 'Invalid verification code' };
  }
  
  // Enable 2FA
  await supabase
    .from('user_2fa')
    .update({
      is_enabled: true,
      is_verified: true,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', twoFa.id);
  
  // Log the action
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: userId,
    actor_type: userType,
    action: '2fa_enabled',
    resource_type: 'user_2fa',
    resource_id: userId,
    details: { method: twoFa.method }
  });
  
  return { success: true };
}

/**
 * Verify 2FA code during login
 */
export async function verifyTwoFactorCode(
  userId: string,
  userType: string,
  code: string,
  tenantId?: string,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Get 2FA record
  const { data: twoFa, error } = await supabase
    .from('user_2fa')
    .select('*')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .eq('is_enabled', true)
    .single();
  
  if (error || !twoFa) {
    return { success: false, error: '2FA not enabled' };
  }
  
  let isValid = false;
  let usedBackupCode = false;
  
  // Try TOTP first
  if (twoFa.method === 'totp' && twoFa.secret_encrypted) {
    const secret = decrypt(twoFa.secret_encrypted);
    isValid = verifyTOTP(secret, code);
  }
  
  // Try backup code if TOTP fails
  if (!isValid) {
    const codeHash = hashBackupCode(code);
    
    const { data: backupCode } = await supabase
      .from('totp_recovery_codes')
      .select('id')
      .eq('user_2fa_id', twoFa.id)
      .eq('code_hash', codeHash)
      .eq('is_used', false)
      .single();
    
    if (backupCode) {
      isValid = true;
      usedBackupCode = true;
      
      // Mark backup code as used
      await supabase
        .from('totp_recovery_codes')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', backupCode.id);
    }
  }
  
  // Log attempt
  await supabase.from('login_attempts').insert({
    user_id: userId,
    user_type: userType,
    tenant_id: tenantId,
    ip_address: ipAddress || 'unknown',
    attempt_type: '2fa',
    is_successful: isValid,
    failure_reason: isValid ? null : 'Invalid 2FA code'
  });
  
  if (!isValid) {
    return { success: false, error: 'Invalid verification code' };
  }
  
  // Update last used
  await supabase
    .from('user_2fa')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', twoFa.id);
  
  // Update session 2FA status
  await supabase
    .from('active_sessions')
    .update({ is_2fa_verified: true })
    .eq('user_id', userId)
    .eq('user_type', userType)
    .gt('expires_at', new Date().toISOString());
  
  if (usedBackupCode) {
    // Notify user that backup code was used
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: userId,
      actor_type: userType,
      action: 'backup_code_used',
      resource_type: 'user_2fa',
      resource_id: userId,
      details: { ip_address: ipAddress }
    });
  }
  
  return { success: true };
}

/**
 * Get 2FA status for user
 */
export async function getTwoFactorStatus(
  userId: string,
  userType: string,
  tenantId?: string
): Promise<TwoFactorStatus> {
  const supabase = await createClient();
  
  const { data: twoFa } = await supabase
    .from('user_2fa')
    .select('*')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .single();
  
  if (!twoFa) {
    return {
      is_enabled: false,
      is_verified: false,
      method: null,
      last_used_at: null,
      has_backup_codes: false
    };
  }
  
  // Check backup codes count
  const { count } = await supabase
    .from('totp_recovery_codes')
    .select('*', { count: 'exact', head: true })
    .eq('user_2fa_id', twoFa.id)
    .eq('is_used', false);
  
  return {
    is_enabled: twoFa.is_enabled,
    is_verified: twoFa.is_verified,
    method: twoFa.method,
    last_used_at: twoFa.last_used_at,
    has_backup_codes: (count || 0) > 0,
    recovery_email: twoFa.recovery_email,
    recovery_phone: twoFa.recovery_phone
  };
}

/**
 * Disable 2FA for user
 */
export async function disableTwoFactor(
  userId: string,
  userType: string,
  disabledBy: string,
  reason: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('user_2fa')
    .update({
      is_enabled: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('user_type', userType);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Log the action
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: disabledBy,
    actor_type: 'admin',
    action: '2fa_disabled',
    resource_type: 'user_2fa',
    resource_id: userId,
    details: { reason, user_type: userType }
  });
  
  return { success: true };
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(
  userId: string,
  userType: string,
  tenantId?: string
): Promise<{ success: boolean; backup_codes?: string[]; error?: string }> {
  const supabase = await createClient();
  
  const { data: twoFa } = await supabase
    .from('user_2fa')
    .select('id')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .eq('is_enabled', true)
    .single();
  
  if (!twoFa) {
    return { success: false, error: '2FA not enabled' };
  }
  
  // Generate new backup codes
  const backupCodes = generateBackupCodes();
  
  // Delete old codes
  await supabase.from('totp_recovery_codes').delete().eq('user_2fa_id', twoFa.id);
  
  // Insert new codes
  const codeRecords = backupCodes.map(code => ({
    user_2fa_id: twoFa.id,
    code_hash: hashBackupCode(code),
    is_used: false
  }));
  
  await supabase.from('totp_recovery_codes').insert(codeRecords);
  
  // Update encrypted backup codes
  await supabase
    .from('user_2fa')
    .update({
      backup_codes_encrypted: encrypt(JSON.stringify(backupCodes)),
      updated_at: new Date().toISOString()
    })
    .eq('id', twoFa.id);
  
  // Log the action
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: userId,
    actor_type: userType,
    action: 'backup_codes_regenerated',
    resource_type: 'user_2fa',
    resource_id: userId
  });
  
  return { success: true, backup_codes: backupCodes };
}

/**
 * Check if 2FA is required for user
 */
export async function isTwoFactorRequired(
  userId: string,
  userType: string,
  tenantId?: string
): Promise<boolean> {
  const supabase = await createClient();
  
  // Get 2FA policy
  const { data: policy } = await supabase
    .from('security_policies')
    .select('config')
    .eq('policy_type', '2fa')
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : 'tenant_id.is.null')
    .order('tenant_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  
  if (!policy) return false;
  
  const config = policy.config as {
    required_for_admin?: boolean;
    required_for_staff?: boolean;
    required_for_customer?: boolean;
    required_for_agent?: boolean;
  };
  
  switch (userType) {
    case 'admin':
      return config.required_for_admin ?? true;
    case 'staff':
      return config.required_for_staff ?? true;
    case 'customer':
      return config.required_for_customer ?? false;
    case 'agent':
      return config.required_for_agent ?? false;
    default:
      return false;
  }
}

