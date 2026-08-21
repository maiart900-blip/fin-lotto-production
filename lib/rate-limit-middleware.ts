/**
 * API Rate Limit Middleware
 * =========================
 * Reusable rate limiting middleware for API routes.
 * Integrates with the main rate-limit.ts system.
 */

import { NextResponse } from 'next/server';
import {
  checkCombinedRateLimit,
  createRateLimitResponse,
  logRateLimitViolation,
  addRateLimitHeaders,
  type RateLimitType,
  type RateLimitResult,
} from './rate-limit';
import { getAuthenticatedUser, type AuthenticatedUser } from './api-auth';
/**
 * Compatibility helper for this middleware.
 * api-auth.getAuthenticatedUser() returns AuthResult, while this module
 * needs the actual AuthenticatedUser object.
 */
async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const result = await getAuthenticatedUser();

  if (!result.authenticated || !result.user) {
    return null;
  }

  return result.user;
}

// =====================================================
// TYPES
// =====================================================

export interface RateLimitMiddlewareResult {
  success: boolean;
  response?: NextResponse;
  rateLimitResult: RateLimitResult;
  user?: AuthenticatedUser;
}

// =====================================================
// MIDDLEWARE FUNCTIONS
// =====================================================

/**
 * Apply rate limiting to an API route
 * 
 * @param type - Type of rate limit to apply
 * @param requireAuth - Whether to also check user-based rate limit
 * @returns Middleware result with response if rate limited
 * 
 * @example
 * ```ts
 * export async function GET() {
 *   const rateLimit = await applyRateLimit('api');
 *   if (!rateLimit.success) return rateLimit.response;
 *   
 *   // Continue with request...
 * }
 * ```
 */
export async function applyRateLimit(
  type: RateLimitType = 'api',
  requireAuth: boolean = false
): Promise<RateLimitMiddlewareResult> {
  try {
    // Get user if available
    let userId: string | null = null;
    let user: AuthenticatedUser | undefined;
    
    if (requireAuth) {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        userId = currentUser.id;
        user = currentUser;
      }
    }
    
    // Check rate limit
    const rateLimitResult = await checkCombinedRateLimit(userId, type);
    
    if (!rateLimitResult.success) {
      // Log violation
      const identifier = userId ? `user:${userId}` : 'ip';
      await logRateLimitViolation(identifier, type, rateLimitResult);
      
      return {
        success: false,
        response: createRateLimitResponse(rateLimitResult, type),
        rateLimitResult,
        user,
      };
    }
    
    return {
      success: true,
      rateLimitResult,
      user,
    };
  } catch (error) {
    // Fail open - allow request if rate limiting fails
    console.error('[RateLimitMiddleware] Error:', error);
    return {
      success: true,
      rateLimitResult: {
        success: true,
        limit: 100,
        remaining: 100,
        reset: Math.ceil(Date.now() / 1000) + 60,
      },
    };
  }
}

/**
 * Wrap response with rate limit headers
 */
export function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  return addRateLimitHeaders(response, result);
}

// =====================================================
// ROUTE-SPECIFIC HELPERS
// =====================================================

/**
 * Apply rate limiting for write operations (POST, PUT, DELETE)
 */
export async function applyWriteRateLimit(
  requireAuth: boolean = true
): Promise<RateLimitMiddlewareResult> {
  return applyRateLimit('api_write', requireAuth);
}

/**
 * Apply rate limiting for financial operations
 */
export async function applyFinancialRateLimit(): Promise<RateLimitMiddlewareResult> {
  return applyRateLimit('financial', true);
}

/**
 * Apply rate limiting for search operations
 */
export async function applySearchRateLimit(): Promise<RateLimitMiddlewareResult> {
  return applyRateLimit('search', false);
}

/**
 * Apply rate limiting for file uploads
 */
export async function applyUploadRateLimit(): Promise<RateLimitMiddlewareResult> {
  return applyRateLimit('upload', true);
}

// =====================================================
// DECORATOR-STYLE WRAPPER
// =====================================================

/**
 * Higher-order function to wrap API handlers with rate limiting
 * 
 * @example
 * ```ts
 * export const GET = withRateLimit('api', async (request) => {
 *   // Handler code...
 *   return NextResponse.json({ data: ... });
 * });
 * ```
 */
export function withRateLimit<T extends Request>(
  type: RateLimitType,
  handler: (request: T, rateLimit: RateLimitMiddlewareResult) => Promise<NextResponse>
): (request: T) => Promise<NextResponse> {
  return async (request: T): Promise<NextResponse> => {
    const rateLimit = await applyRateLimit(type);
    
    if (!rateLimit.success && rateLimit.response) {
      return rateLimit.response;
    }
    
    const response = await handler(request, rateLimit);
    return withRateLimitHeaders(response, rateLimit.rateLimitResult);
  };
}

/**
 * Higher-order function for write operations
 */
export function withWriteRateLimit<T extends Request>(
  handler: (request: T, rateLimit: RateLimitMiddlewareResult) => Promise<NextResponse>
): (request: T) => Promise<NextResponse> {
  return withRateLimit('api_write', handler);
}

/**
 * Higher-order function for financial operations
 */
export function withFinancialRateLimit<T extends Request>(
  handler: (request: T, rateLimit: RateLimitMiddlewareResult) => Promise<NextResponse>
): (request: T) => Promise<NextResponse> {
  return withRateLimit('financial', handler);
}


