import { createClient } from '@/lib/supabase/server';

// Dangerous patterns to detect
const SQL_INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
  /exec(\s|\+)+(s|x)p\w+/i,
  /UNION(\s+)ALL(\s+)SELECT/i,
  /SELECT.*FROM.*WHERE/i,
  /INSERT(\s+)INTO/i,
  /DELETE(\s+)FROM/i,
  /DROP(\s+)TABLE/i,
  /UPDATE(\s+)\w+(\s+)SET/i,
];

const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<img[^>]*onerror/gi,
  /eval\s*\(/gi,
  /document\.(cookie|location|write)/gi,
  /window\.(location|open)/gi,
];

const ALLOWED_FILE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

const DANGEROUS_EXTENSIONS = [
  '.exe', '.php', '.js', '.html', '.htm', '.sh', '.bat', '.cmd',
  '.ps1', '.vbs', '.jar', '.py', '.rb', '.pl', '.cgi', '.asp', '.aspx',
];

// Check for SQL injection
export function detectSQLInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

// Check for XSS
export function detectXSS(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

// Sanitize input
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Validate file upload
export function validateFileUpload(file: {
  name: string;
  type: string;
  size: number;
}): { valid: boolean; error?: string; threatType?: string } {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { valid: false, error: 'ชนิดไฟล์ไม่อนุญาต', threatType: 'invalid_type' };
  }

  // Check extension
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return { valid: false, error: 'นามสกุลไฟล์อันตราย', threatType: 'dangerous_extension' };
  }

  // Check size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)', threatType: 'size_exceeded' };
  }

  // Check for double extensions
  if ((file.name.match(/\./g) || []).length > 1) {
    const parts = file.name.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      if (DANGEROUS_EXTENSIONS.includes('.' + parts[i])) {
        return { valid: false, error: 'ชื่อไฟล์ต้องสงสัย', threatType: 'suspicious_name' };
      }
    }
  }

  return { valid: true };
}

// Log security event
export async function logSecurityEvent(event: {
  user_id?: string;
  customer_id?: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ip_address?: string;
  user_agent?: string;
  request_path?: string;
  request_method?: string;
  request_body?: object;
}) {
  try {
    const supabase = await createClient();
    await supabase.from('security_events').insert(event);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Check if IP is blocked
export async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('blocked_ips')
      .select('*')
      .eq('ip_address', ip)
      .single();

    if (!data) return false;

    // Check if block has expired
    if (data.blocked_until && new Date(data.blocked_until) < new Date()) {
      // Remove expired block
      await supabase.from('blocked_ips').delete().eq('ip_address', ip);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Block IP
export async function blockIP(ip: string, reason: string, durationMinutes: number = 30, blockedBy?: string) {
  try {
    const supabase = await createClient();
    const blockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    await supabase.from('blocked_ips').upsert({
      ip_address: ip,
      reason,
      blocked_by: blockedBy,
      blocked_until: blockedUntil.toISOString(),
      is_permanent: false,
    }, { onConflict: 'ip_address' });

    // Log event
    await logSecurityEvent({
      event_type: 'ip_blocked',
      severity: 'high',
      description: `IP ${ip} blocked: ${reason}`,
      ip_address: ip,
    });
  } catch (error) {
    console.error('Failed to block IP:', error);
  }
}

// Check if account is locked
export async function isAccountLocked(userId?: string, customerId?: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    let query = supabase.from('locked_accounts').select('*');

    if (userId) query = query.eq('user_id', userId);
    if (customerId) query = query.eq('customer_id', customerId);

    const { data } = await query.single();

    if (!data) return false;

    // Check if lock has expired
    if (data.locked_until && new Date(data.locked_until) < new Date()) {
      // Remove expired lock
      await supabase.from('locked_accounts').delete().eq('id', data.id);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Lock account
export async function lockAccount(
  userId: string | null,
  customerId: string | null,
  reason: string,
  durationMinutes: number = 60
) {
  try {
    const supabase = await createClient();
    const lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    await supabase.from('locked_accounts').insert({
      user_id: userId,
      customer_id: customerId,
      reason,
      locked_until: lockedUntil.toISOString(),
    });

    // Log event
    await logSecurityEvent({
      user_id: userId || undefined,
      customer_id: customerId || undefined,
      event_type: 'account_locked',
      severity: 'high',
      description: `Account locked: ${reason}`,
    });
  } catch (error) {
    console.error('Failed to lock account:', error);
  }
}

// Check Safe Mode
export async function isSafeModeEnabled(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'safe_mode')
      .single();

    return data?.value === 'true';
  } catch {
    return false;
  }
}

// Toggle Safe Mode
export async function toggleSafeMode(enable: boolean, reason: string, userId?: string) {
  try {
    const supabase = await createClient();

    // Update setting
    await supabase
      .from('system_settings')
      .update({ value: enable ? 'true' : 'false', updated_by: userId })
      .eq('key', 'safe_mode');

    // Log
    await supabase.from('safe_mode_logs').insert({
      is_enabled: enable,
      reason,
      enabled_by: enable ? userId : null,
      disabled_by: enable ? null : userId,
    });

    // Log security event
    await logSecurityEvent({
      user_id: userId,
      event_type: enable ? 'safe_mode_enabled' : 'safe_mode_disabled',
      severity: enable ? 'critical' : 'medium',
      description: reason,
    });
  } catch (error) {
    console.error('Failed to toggle safe mode:', error);
  }
}

// Detect suspicious request
export function detectSuspiciousRequest(req: {
  path: string;
  method: string;
  body?: string | object;
  headers?: Record<string, string>;
}): { suspicious: boolean; reason?: string; severity?: 'low' | 'medium' | 'high' | 'critical' } {
  const bodyStr = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body || '';

  // Check SQL injection
  if (detectSQLInjection(bodyStr) || detectSQLInjection(req.path)) {
    return { suspicious: true, reason: 'SQL Injection attempt', severity: 'critical' };
  }

  // Check XSS
  if (detectXSS(bodyStr) || detectXSS(req.path)) {
    return { suspicious: true, reason: 'XSS attempt', severity: 'high' };
  }

  // Check for admin path access patterns
  if (req.path.includes('/api/admin') || req.path.includes('/api/users')) {
    // This would need actual auth check
    return { suspicious: false };
  }

  // Check for credit manipulation attempts
  if (req.path.includes('/credit') && req.method !== 'GET') {
    // Flag for review
    return { suspicious: true, reason: 'Credit modification attempt', severity: 'medium' };
  }

  return { suspicious: false };
}

// Record failed login
export async function recordFailedLogin(
  userId: string | null,
  customerId: string | null,
  ip: string,
  maxAttempts: number = 5
): Promise<{ locked: boolean }> {
  try {
    const supabase = await createClient();

    // Get current failed attempts
    const { data: existing } = await supabase
      .from('locked_accounts')
      .select('*')
      .or(`user_id.eq.${userId || 'null'},customer_id.eq.${customerId || 'null'}`)
      .single();

    const attempts = (existing?.failed_attempts || 0) + 1;

    if (attempts >= maxAttempts) {
      await lockAccount(userId, customerId, `Too many failed login attempts (${attempts})`, 60);
      return { locked: true };
    }

    // Update or insert
    if (existing) {
      await supabase
        .from('locked_accounts')
        .update({ failed_attempts: attempts })
        .eq('id', existing.id);
    }

    return { locked: false };
  } catch {
    return { locked: false };
  }
}

// Get system setting
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();
    return data?.value || null;
  } catch {
    return null;
  }
}

// Generate secure filename
export function generateSecureFilename(originalName: string): string {
  const ext = originalName.substring(originalName.lastIndexOf('.'));
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${random}${ext}`;
}
