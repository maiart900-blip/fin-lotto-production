// 2FA Guard - ระบบตรวจสอบ 2FA กลาง
import { createClient } from '@/lib/supabase/server';
import { generateSecret as otpGenerateSecret, generateURI, verify as otpVerify } from 'otplib/functional';

export interface TwoFactorStatus {
  required: boolean;        // ต้องใช้ 2FA หรือไม่ (ตาม role)
  enabled: boolean;         // เปิดใช้ 2FA แล้วหรือยัง
  verified: boolean;        // ยืนยัน 2FA ใน session นี้แล้วหรือยัง
  needsSetup: boolean;      // ต้อง setup 2FA ก่อน
  needsVerify: boolean;     // ต้องยืนยัน 2FA ก่อนเข้าระบบ
  lastVerifiedAt: string | null;
}

export interface User2FAInfo {
  id: string;
  role: string;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  two_factor_verified_at: string | null;
}

// Roles that require 2FA (hardcoded for security)
const ROLES_REQUIRING_2FA = ['super_admin', 'admin', 'agent'];

// ตรวจสอบว่า role นี้ต้องใช้ 2FA หรือไม่
export function is2FARequiredForRole(role: string): boolean {
  return ROLES_REQUIRING_2FA.includes(role);
}

// ตรวจสอบสถานะ 2FA ของผู้ใช้ (users table)
export async function check2FAStatus(
  userId: string,
  role: string,
  sessionVerified: boolean = false
): Promise<TwoFactorStatus> {
  const supabase = await createClient();
  
  // ดึงข้อมูล 2FA ของผู้ใช้จาก users table
  const { data: user } = await supabase
    .from('users')
    .select('two_factor_enabled, two_factor_secret, two_factor_verified_at')
    .eq('id', userId)
    .single();
  
  const required = is2FARequiredForRole(role);
  const enabled = user?.two_factor_enabled ?? false;
  const hasSecret = !!user?.two_factor_secret;
  
  return {
    required,
    enabled,
    verified: sessionVerified,
    needsSetup: required && (!enabled || !hasSecret),
    needsVerify: required && enabled && hasSecret && !sessionVerified,
    lastVerifiedAt: user?.two_factor_verified_at || null,
  };
}

// Generate new 2FA secret
export function generate2FASecret(username: string): { secret: string; otpauthUrl: string } {
  const secret = otpGenerateSecret();
  const otpauthUrl = generateURI({ 
    secret, 
    issuer: 'FinLotto', 
    label: username,
    strategy: 'totp'
  });
  
  return { secret, otpauthUrl };
}

// Verify TOTP code
export function verify2FACode(secret: string, code: string): boolean {
  try {
    return otpVerify({ token: code, secret, strategy: 'totp' });
  } catch {
    return false;
  }
}

// Generate backup codes
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    codes.push(code);
  }
  return codes;
}

// อัปเดตเวลายืนยัน 2FA ล่าสุด
export async function update2FALastVerified(userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('users')
    .update({ two_factor_verified_at: new Date().toISOString() })
    .eq('id', userId);
  
  return !error;
}

// เปิดใช้งาน 2FA สำหรับผู้ใช้
export async function enable2FA(
  userId: string,
  secret: string,
  backupCodes: string[]
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('users')
    .update({
      two_factor_enabled: true,
      two_factor_secret: secret,
      two_factor_backup_codes: backupCodes,
      two_factor_verified_at: new Date().toISOString(),
    })
    .eq('id', userId);
  
  return !error;
}

// ปิดใช้งาน 2FA สำหรับผู้ใช้
export async function disable2FA(userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('users')
    .update({
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: null,
      two_factor_verified_at: null,
    })
    .eq('id', userId);
  
  return !error;
}

// ดึง secret สำหรับ verify
export async function get2FASecret(userId: string): Promise<string | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('users')
    .select('two_factor_secret')
    .eq('id', userId)
    .single();
  
  return data?.two_factor_secret || null;
}

// Verify 2FA and update session
export async function verifyAndUpdate2FA(userId: string, code: string): Promise<boolean> {
  const secret = await get2FASecret(userId);
  if (!secret) return false;
  
  const isValid = verify2FACode(secret, code);
  if (isValid) {
    await update2FALastVerified(userId);
  }
  
  return isValid;
}

// Use backup code (one-time use)
export async function useBackupCode(userId: string, code: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: user } = await supabase
    .from('users')
    .select('two_factor_backup_codes')
    .eq('id', userId)
    .single();
  
  const backupCodes = user?.two_factor_backup_codes || [];
  const codeIndex = backupCodes.indexOf(code.toUpperCase());
  
  if (codeIndex === -1) return false;
  
  // Remove used code
  backupCodes.splice(codeIndex, 1);
  
  const { error } = await supabase
    .from('users')
    .update({ 
      two_factor_backup_codes: backupCodes,
      two_factor_verified_at: new Date().toISOString(),
    })
    .eq('id', userId);
  
  return !error;
}
