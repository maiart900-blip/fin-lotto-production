// 2FA Guard - ระบบตรวจสอบ 2FA กลาง
import { createClient } from '@/lib/supabase/server';

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
  last_2fa_verified_at: string | null;
}

// ตรวจสอบว่า role นี้ต้องใช้ 2FA หรือไม่
export async function is2FARequiredForRole(role: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('system_2fa_requirements')
    .select('is_required')
    .eq('role', role)
    .single();
  
  return data?.is_required ?? false;
}

// ตรวจสอบสถานะ 2FA ของผู้ใช้
export async function check2FAStatus(
  userId: string,
  userType: 'agent' | 'customer',
  role: string,
  sessionVerified: boolean = false
): Promise<TwoFactorStatus> {
  const supabase = await createClient();
  
  // ดึงข้อมูล 2FA ของผู้ใช้
  const table = userType === 'agent' ? 'agents' : 'customers';
  const { data: user } = await supabase
    .from(table)
    .select('two_factor_enabled, two_factor_secret, two_factor_verified_at, last_2fa_verified_at')
    .eq('id', userId)
    .single();
  
  // ตรวจสอบว่า role นี้ต้องใช้ 2FA หรือไม่
  const required = await is2FARequiredForRole(role);
  
  const enabled = user?.two_factor_enabled ?? false;
  const hasSecret = !!user?.two_factor_secret;
  
  return {
    required,
    enabled,
    verified: sessionVerified,
    needsSetup: required && !enabled,
    needsVerify: required && enabled && !sessionVerified,
    lastVerifiedAt: user?.last_2fa_verified_at || null,
  };
}

// อัปเดตเวลายืนยัน 2FA ล่าสุด
export async function update2FALastVerified(
  userId: string,
  userType: 'agent' | 'customer'
): Promise<boolean> {
  const supabase = await createClient();
  const table = userType === 'agent' ? 'agents' : 'customers';
  
  const { error } = await supabase
    .from(table)
    .update({ last_2fa_verified_at: new Date().toISOString() })
    .eq('id', userId);
  
  return !error;
}

// เปิดใช้งาน 2FA สำหรับผู้ใช้
export async function enable2FA(
  userId: string,
  userType: 'agent' | 'customer',
  secret: string
): Promise<boolean> {
  const supabase = await createClient();
  const table = userType === 'agent' ? 'agents' : 'customers';
  
  const { error } = await supabase
    .from(table)
    .update({
      two_factor_enabled: true,
      two_factor_secret: secret,
      two_factor_verified_at: new Date().toISOString(),
      last_2fa_verified_at: new Date().toISOString(),
    })
    .eq('id', userId);
  
  return !error;
}

// ปิดใช้งาน 2FA สำหรับผู้ใช้
export async function disable2FA(
  userId: string,
  userType: 'agent' | 'customer'
): Promise<boolean> {
  const supabase = await createClient();
  const table = userType === 'agent' ? 'agents' : 'customers';
  
  const { error } = await supabase
    .from(table)
    .update({
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_verified_at: null,
      last_2fa_verified_at: null,
    })
    .eq('id', userId);
  
  return !error;
}

// ดึง secret สำหรับ verify
export async function get2FASecret(
  userId: string,
  userType: 'agent' | 'customer'
): Promise<string | null> {
  const supabase = await createClient();
  const table = userType === 'agent' ? 'agents' : 'customers';
  
  const { data } = await supabase
    .from(table)
    .select('two_factor_secret')
    .eq('id', userId)
    .single();
  
  return data?.two_factor_secret || null;
}

// ดึงรายการ 2FA requirements ทั้งหมด (สำหรับ Admin)
export async function get2FARequirements(): Promise<Array<{ role: string; is_required: boolean }>> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('system_2fa_requirements')
    .select('role, is_required')
    .order('role');
  
  return data || [];
}

// อัปเดต 2FA requirement ของ role
export async function update2FARequirement(
  role: string,
  isRequired: boolean
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('system_2fa_requirements')
    .upsert({
      role,
      is_required: isRequired,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'role' });
  
  return !error;
}
