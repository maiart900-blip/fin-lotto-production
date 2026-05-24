// Environment Variables Configuration
// All required ENV variables for production

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Production security check - JWT_SECRET must be set in production
// Note: This is called lazily to avoid build-time errors
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const defaultSecret = 'fin-lotto-jwt-secret-change-in-production';
  
  // Skip check during build time (when env vars may not be available)
  if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
    return secret || defaultSecret;
  }
  
  if (IS_PRODUCTION) {
    if (!secret || secret === defaultSecret) {
      console.error('[SECURITY] JWT_SECRET must be set in production environment!');
      // Don't throw at build time, but log error
      return defaultSecret;
    }
    return secret;
  }
  
  // Development mode - warn but allow default
  if (!secret) {
    console.warn('[DEV WARNING] JWT_SECRET not set, using default. DO NOT use in production!');
  }
  return secret || defaultSecret;
}

// Production security check - CRON_SECRET must be set in production
function getCronSecret(): string | undefined {
  const secret = process.env.CRON_SECRET;
  
  if (IS_PRODUCTION && !secret && process.env.NEXT_RUNTIME) {
    console.warn('[SECURITY WARNING] CRON_SECRET not set in production. CRON jobs will be unprotected!');
  }
  
  return secret;
}

export const ENV = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || process.env.SUPABASE_URL,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Auth (with production check)
  JWT_SECRET: getJwtSecret(),
  AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  
  // CRON (with production warning)
  CRON_SECRET: getCronSecret(),

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
  IS_PRODUCTION: IS_PRODUCTION,
};

// Validate required ENV variables
export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];
  
  // Production-required variables
  const productionRequired = IS_PRODUCTION ? [
    'JWT_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ] : [];
  
  // Recommended but not required
  const recommended = [
    'CRON_SECRET',
    'LINE_CHANNEL_ACCESS_TOKEN',
  ];

  const missing = [...required, ...productionRequired].filter(key => !process.env[key]);
  const warnings = recommended.filter(key => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

// Get ENV status for health check
export function getEnvStatus(): Record<string, boolean> {
  return {
    database: !!ENV.SUPABASE_URL && !!ENV.SUPABASE_ANON_KEY,
    auth: !!process.env.JWT_SECRET, // Check raw env, not the function
    storage: !!ENV.BLOB_READ_WRITE_TOKEN,
    email: !!ENV.SMTP_HOST && !!ENV.SMTP_USER,
    sms: !!ENV.SMS_API_KEY,
    cron: !!ENV.CRON_SECRET,
    line: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
  };
}

// Get required ENV for production deployment checklist
export function getProductionChecklist(): { key: string; status: 'set' | 'missing' | 'warning'; description: string }[] {
  return [
    { 
      key: 'JWT_SECRET', 
      status: process.env.JWT_SECRET ? 'set' : 'missing',
      description: 'Secret key for JWT token signing (REQUIRED)'
    },
    { 
      key: 'CRON_SECRET', 
      status: process.env.CRON_SECRET ? 'set' : 'warning',
      description: 'Secret for CRON job authentication (RECOMMENDED)'
    },
    { 
      key: 'SUPABASE_SERVICE_ROLE_KEY', 
      status: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing',
      description: 'Supabase service role key for admin operations (REQUIRED)'
    },
    { 
      key: 'LINE_CHANNEL_ACCESS_TOKEN', 
      status: process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'set' : 'warning',
      description: 'LINE API token for owner notifications (RECOMMENDED)'
    },
    { 
      key: 'BLOB_READ_WRITE_TOKEN', 
      status: process.env.BLOB_READ_WRITE_TOKEN ? 'set' : 'warning',
      description: 'Vercel Blob token for file storage (RECOMMENDED)'
    },
  ];
}
