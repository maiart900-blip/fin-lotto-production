// Environment Variables Configuration
// All required ENV variables for production

export const ENV = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || process.env.SUPABASE_URL,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || 'fin-lotto-jwt-secret-change-in-production',
  AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,

  // Storage
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,

  // Email (SMTP)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@finlotto.com',

  // SMS (optional)
  SMS_PROVIDER: process.env.SMS_PROVIDER, // 'twilio' | 'thaibulksms' | etc
  SMS_API_KEY: process.env.SMS_API_KEY,
  SMS_API_SECRET: process.env.SMS_API_SECRET,

  // URLs
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000',
  ADMIN_URL: process.env.ADMIN_URL || '/admin',

  // Security
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['*'],
  RATE_LIMIT_REQUESTS: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),

  // Feature Flags
  ENABLE_2FA: process.env.ENABLE_2FA === 'true',
  ENABLE_SMS_OTP: process.env.ENABLE_SMS_OTP === 'true',
  ENABLE_EMAIL_OTP: process.env.ENABLE_EMAIL_OTP !== 'false', // default true
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',

  // Node Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};

// Validate required ENV variables
export function validateEnv(): { valid: boolean; missing: string[] } {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}

// Get ENV status for health check
export function getEnvStatus(): Record<string, boolean> {
  return {
    database: !!ENV.SUPABASE_URL && !!ENV.SUPABASE_ANON_KEY,
    auth: !!ENV.JWT_SECRET,
    storage: !!ENV.BLOB_READ_WRITE_TOKEN,
    email: !!ENV.SMTP_HOST && !!ENV.SMTP_USER,
    sms: !!ENV.SMS_API_KEY,
  };
}
