/**
 * Production Rate Limiting System
 * ================================
 * Uses Upstash Redis for distributed rate limiting across serverless functions.
 * 
 * Features:
 * - Per-IP rate limiting (general API protection)
 * - Per-user rate limiting (authenticated endpoints)
 * - Stricter limits for sensitive endpoints (login, registration)
 * - Sliding window algorithm for smooth rate limiting
 * - Structured 429 responses with retry-after headers
 * - Audit logging for rate limit violations
 * 
 * @see https://github.com/upstash/ratelimit
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

// =====================================================
// REDIS CLIENT
// =====================================================

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      throw new Error('Redis configuration missing for rate limiting');
    }
    
    redis = new Redis({ url, token });
  }
  return redis;
}

// =====================================================
// RATE LIMIT CONFIGURATIONS
// =====================================================

export type RateLimitType = 
  | 'login'           // Strict: 5 requests per minute
  | 'register'        // Strict: 3 requests per minute
  | 'api'             // Standard: 100 requests per minute
  | 'api_write'       // Write ops: 30 requests per minute
  | 'financial'       // Very strict: 10 requests per minute
  | 'search'          // Search: 20 requests per minute
  | 'upload';         // Upload: 10 requests per minute

interface RateLimitConfig {
  requests: number;
  window: string;
  prefix: string;
}

const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  login: {
    requests: 5,
    window: '1 m',
    prefix: 'rl:login',
  },
  register: {
    requests: 3,
    window: '1 m',
    prefix: 'rl:register',
  },
  api: {
    requests: 100,
    window: '1 m',
    prefix: 'rl:api',
  },
  api_write: {
    requests: 30,
    window: '1 m',
    prefix: 'rl:write',
  },
  financial: {
    requests: 10,
    window: '1 m',
    prefix: 'rl:financial',
  },
  search: {
    requests: 20,
    window: '1 m',
    prefix: 'rl:search',
  },
  upload: {
    requests: 10,
    window: '1 m',
    prefix: 'rl:upload',
  },
};

// Cache rate limiters to avoid recreating them
const rateLimiters = new Map<RateLimitType, Ratelimit>();

function getRateLimiter(type: RateLimitType): Ratelimit {
  if (!rateLimiters.has(type)) {
    const config = RATE_LIMIT_CONFIGS[type];
    rateLimiters.set(
      type,
      new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        prefix: config.prefix,
        analytics: true,
      })
    );
  }
  return rateLimiters.get(type)!;
}

// =====================================================
// IP EXTRACTION
// =====================================================

export async function getClientIP(): Promise<string> {
  try {
    const headersList = await headers();
    
    // Check various headers in order of preference
    const forwardedFor = headersList.get('x-forwarded-for');
    if (forwardedFor) {
      // Take the first IP in the chain (original client)
      return forwardedFor.split(',')[0].trim();
    }
    
    const realIP = headersList.get('x-real-ip');
    if (realIP) {
      return realIP.trim();
    }
    
    const cfConnectingIP = headersList.get('cf-connecting-ip');
    if (cfConnectingIP) {
      return cfConnectingIP.trim();
    }
    
    // Fallback
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// =====================================================
// RATE LIMIT RESULT
// =====================================================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // Seconds until reset
}

// =====================================================
// MAIN RATE LIMIT FUNCTION
// =====================================================

/**
 * Check rate limit for an identifier
 * 
 * @param identifier - Unique identifier (IP address or user ID)
 * @param type - Type of rate limit to apply
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<RateLimitResult> {
  try {
    const limiter = getRateLimiter(type);
    const result = await limiter.limit(identifier);
    
    const config = RATE_LIMIT_CONFIGS[type];
    const resetTime = Math.ceil(result.reset / 1000); // Convert to seconds
    const now = Math.ceil(Date.now() / 1000);
    
    return {
      success: result.success,
      limit: config.requests,
      remaining: result.remaining,
      reset: resetTime,
      retryAfter: result.success ? undefined : Math.max(0, resetTime - now),
    };
  } catch (error) {
    // If rate limiting fails, allow the request but log the error
    console.error('[RateLimit] Error checking rate limit:', error);
    return {
      success: true,
      limit: RATE_LIMIT_CONFIGS[type].requests,
      remaining: RATE_LIMIT_CONFIGS[type].requests,
      reset: Math.ceil(Date.now() / 1000) + 60,
    };
  }
}

/**
 * Check rate limit by IP address
 */
export async function checkRateLimitByIP(
  type: RateLimitType = 'api'
): Promise<RateLimitResult> {
  const ip = await getClientIP();
  return checkRateLimit(`ip:${ip}`, type);
}

/**
 * Check rate limit by user ID
 */
export async function checkRateLimitByUser(
  userId: string,
  type: RateLimitType = 'api'
): Promise<RateLimitResult> {
  return checkRateLimit(`user:${userId}`, type);
}

/**
 * Check combined rate limit (both IP and user if available)
 * Returns the most restrictive result
 */
export async function checkCombinedRateLimit(
  userId: string | null,
  type: RateLimitType = 'api'
): Promise<RateLimitResult> {
  const ipResult = await checkRateLimitByIP(type);
  
  if (!ipResult.success) {
    return ipResult;
  }
  
  if (userId) {
    const userResult = await checkRateLimitByUser(userId, type);
    if (!userResult.success) {
      return userResult;
    }
    
    // Return the more restrictive result
    return ipResult.remaining < userResult.remaining ? ipResult : userResult;
  }
  
  return ipResult;
}

// =====================================================
// 429 RESPONSE BUILDER
// =====================================================

export interface RateLimitErrorResponse {
  code: 'RATE_LIMITED';
  error: string;
  message: string;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
  type: RateLimitType;
}

/**
 * Create a structured 429 Too Many Requests response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  type: RateLimitType = 'api'
): NextResponse<RateLimitErrorResponse> {
  const retryAfter = result.retryAfter || 60;
  
  const body: RateLimitErrorResponse = {
    code: 'RATE_LIMITED',
    error: 'Too Many Requests',
    message: getRateLimitMessage(type),
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter,
    type,
  };
  
  return NextResponse.json(body, {
    status: 429,
    headers: {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.reset),
      'Retry-After': String(retryAfter),
    },
  });
}

function getRateLimitMessage(type: RateLimitType): string {
  switch (type) {
    case 'login':
      return 'คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    case 'register':
      return 'คุณพยายามสมัครสมาชิกบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    case 'financial':
      return 'คุณทำรายการทางการเงินบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    case 'upload':
      return 'คุณอัปโหลดไฟล์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    default:
      return 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่';
  }
}

// =====================================================
// API ROUTE HELPERS
// =====================================================

/**
 * Rate limit guard for API routes
 * Returns null if allowed, or a NextResponse if rate limited
 */
export async function rateLimitGuard(
  type: RateLimitType = 'api',
  userId?: string | null
): Promise<NextResponse | null> {
  const result = await checkCombinedRateLimit(userId || null, type);
  
  if (!result.success) {
    return createRateLimitResponse(result, type);
  }
  
  return null;
}

/**
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.reset));
  return response;
}

// =====================================================
// AUDIT LOGGING INTEGRATION
// =====================================================

/**
 * Log rate limit violation for audit purposes
 */
export async function logRateLimitViolation(
  identifier: string,
  type: RateLimitType,
  result: RateLimitResult
): Promise<void> {
  try {
    const ip = await getClientIP();
    const timestamp = new Date().toISOString();
    
    // Store violation in Redis for analysis
    const violationKey = `rl:violation:${type}:${identifier}`;
    const violationData = JSON.stringify({
      identifier,
      type,
      ip,
      limit: result.limit,
      reset: result.reset,
      timestamp,
    });
    
    // Store violation with 24h TTL
    await getRedis().lpush(violationKey, violationData);
    await getRedis().ltrim(violationKey, 0, 99); // Keep last 100 violations
    await getRedis().expire(violationKey, 86400); // 24 hour TTL
    
    // Increment violation counter for monitoring
    const counterKey = `rl:violations:${type}:${new Date().toISOString().slice(0, 10)}`;
    await getRedis().incr(counterKey);
    await getRedis().expire(counterKey, 86400 * 7); // 7 day TTL
    
    console.warn(`[RateLimit] Violation: ${type} by ${identifier} (IP: ${ip})`);
  } catch (error) {
    console.error('[RateLimit] Failed to log violation:', error);
  }
}

// =====================================================
// MONITORING HELPERS
// =====================================================

/**
 * Get rate limit statistics for monitoring
 */
export async function getRateLimitStats(
  type: RateLimitType,
  date?: string
): Promise<{ violations: number; date: string }> {
  try {
    const dateStr = date || new Date().toISOString().slice(0, 10);
    const counterKey = `rl:violations:${type}:${dateStr}`;
    const violations = await getRedis().get<number>(counterKey) || 0;
    
    return { violations, date: dateStr };
  } catch {
    return { violations: 0, date: date || new Date().toISOString().slice(0, 10) };
  }
}

/**
 * Get recent violations for an identifier
 */
export async function getRecentViolations(
  identifier: string,
  type: RateLimitType,
  limit: number = 10
): Promise<Array<{
  identifier: string;
  type: string;
  ip: string;
  timestamp: string;
}>> {
  try {
    const violationKey = `rl:violation:${type}:${identifier}`;
    const violations = await getRedis().lrange(violationKey, 0, limit - 1);
    return violations.map(v => typeof v === 'string' ? JSON.parse(v) : v);
  } catch {
    return [];
  }
}

// =====================================================
// EXPORTS
// =====================================================

export { RATE_LIMIT_CONFIGS };
