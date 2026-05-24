import { NextRequest, NextResponse } from 'next/server';
import { ENV } from './env';

// Security Headers for Production
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// Cookie options for production
export const secureCookieOptions = {
  httpOnly: true,
  secure: ENV.IS_PRODUCTION,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

// Rate limiting store (in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = ENV.RATE_LIMIT_WINDOW_MS;
  const maxRequests = ENV.RATE_LIMIT_REQUESTS;

  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}

// CORS check
export function checkCors(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  
  if (ENV.CORS_ORIGINS.includes('*')) return true;
  return ENV.CORS_ORIGINS.includes(origin);
}

// Add security headers to response
export function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// CSRF Token generation
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate CSRF Token
export function validateCsrfToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) return false;
  return token === storedToken;
}

// Sanitize input
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < >
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Validate file upload
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number; // bytes
    allowedTypes?: string[];
  } = {}
): { valid: boolean; error?: string } {
  const { maxSize = 5 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] } = options;

  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSize / 1024 / 1024}MB limit` };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} not allowed` };
  }

  // Check for suspicious file names
  const suspiciousPatterns = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '<script'];
  if (suspiciousPatterns.some(p => file.name.toLowerCase().includes(p))) {
    return { valid: false, error: 'Suspicious file name detected' };
  }

  return { valid: true };
}
