/**
 * API Security Hardening Module
 * ==============================
 * Centralized security utilities for protecting API routes against:
 * - SQL Injection (via Zod validation)
 * - Brute Force (via rate limiting)
 * - DDoS (via IP-based rate limiting)
 * - IDOR (via ownership validation)
 * - XSS (via input sanitization)
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { 
  checkRateLimitByIP, 
  createRateLimitResponse, 
  logRateLimitViolation,
  type RateLimitType 
} from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, type AuthenticatedUser } from '@/lib/api-auth';

// =====================================================
// INPUT VALIDATION SCHEMAS (Anti-SQL Injection)
// =====================================================

/**
 * Strict UUID validation - prevents SQL injection via ID parameters
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Lottery number validation (2-3 digits only)
 */
export const lotteryNumberSchema = z.string()
  .min(1, 'Number required')
  .max(6, 'Number too long')
  .regex(/^\d{1,6}$/, 'Must be digits only');

/**
 * Bet type validation - strict enum
 */
export const betTypeSchema = z.enum([
  '2top', '2bot', '2flip', '2_top', '2_bot', '2_flip',
  '3top', '3tod', '3flip', '3_top', '3_tod', '3_flip',
  '1top', '1bot', '1_top', '1_bot',
  'run_top', 'run_bot'
], { errorMap: () => ({ message: 'Invalid bet type' }) });

/**
 * Amount validation - positive number, max 2 decimals
 */
export const amountSchema = z.number()
  .positive('Amount must be positive')
  .max(10000000, 'Amount too large')
  .multipleOf(0.01, 'Amount can have at most 2 decimal places');

/**
 * Safe text input - strips dangerous characters
 */
export const safeTextSchema = z.string()
  .max(500, 'Text too long')
  .transform(text => text.replace(/[<>{}]/g, '').trim());

/**
 * Phone number validation (Thai format)
 */
export const thaiPhoneSchema = z.string()
  .regex(/^0[689]\d{8}$/, 'Invalid Thai phone number');

/**
 * Username validation - alphanumeric only
 */
export const usernameSchema = z.string()
  .min(3, 'Username too short')
  .max(50, 'Username too long')
  .regex(/^[a-zA-Z0-9_@.]+$/, 'Invalid characters in username');

/**
 * Password validation - basic security requirements
 */
export const passwordSchema = z.string()
  .min(6, 'Password too short')
  .max(100, 'Password too long');

/**
 * OTP code validation (6 digits)
 */
export const otpCodeSchema = z.string()
  .length(6, 'OTP must be 6 digits')
  .regex(/^\d{6}$/, 'OTP must be digits only');

/**
 * Backup code validation (8-10 alphanumeric)
 */
export const backupCodeSchema = z.string()
  .min(8, 'Backup code too short')
  .max(10, 'Backup code too long')
  .regex(/^[A-Z0-9]+$/, 'Invalid backup code format');

// =====================================================
// BET ENTRY VALIDATION SCHEMA
// =====================================================

export const betEntrySchema = z.object({
  number: lotteryNumberSchema,
  bet_type: betTypeSchema.optional(),
  betType: betTypeSchema.optional(),
  amount: z.number().positive().max(1000000).optional(),
  amount_top: z.number().nonnegative().max(1000000).optional(),
  amount_bottom: z.number().nonnegative().max(1000000).optional(),
  amount_tod: z.number().nonnegative().max(1000000).optional(),
  is_reverse: z.boolean().optional(),
  original_number: lotteryNumberSchema.optional(),
});

export const customerBuySchema = z.object({
  lottery_id: uuidSchema,
  entries: z.array(betEntrySchema).min(1, 'At least one entry required').max(1000, 'Too many entries'),
  items: z.array(betEntrySchema).optional(),
});

export const adminBetSchema = z.object({
  lottery_id: uuidSchema,
  items: z.array(betEntrySchema).min(1).max(1000),
  customer_name: safeTextSchema.optional(),
  tenant_id: uuidSchema.optional().nullable(),
  target_customer_id: uuidSchema.optional(),
  source_type: z.enum(['manual_key', 'auto']).optional(),
  agent_id: uuidSchema.optional(),
  idempotency_key: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const twoFAVerifySchema = z.object({
  code: z.union([otpCodeSchema, backupCodeSchema]),
  isBackupCode: z.boolean().optional(),
});

// =====================================================
// RATE LIMITING GUARD
// =====================================================

/**
 * Apply rate limiting to an API route
 * Returns null if allowed, NextResponse if rate limited
 */
export async function applyRateLimit(
  type: RateLimitType,
  identifier?: string
): Promise<NextResponse | null> {
  try {
    const result = await checkRateLimitByIP(type);
    
    if (!result.success) {
      await logRateLimitViolation(identifier || 'unknown', type, result);
      return createRateLimitResponse(result, type);
    }
    
    return null;
  } catch (error) {
    // Fail open - log error but don't block request
    console.error('[Security] Rate limit check failed:', error);
    return null;
  }
}

// =====================================================
// IDOR PROTECTION (Insecure Direct Object Reference)
// =====================================================

/**
 * Verify that the authenticated user has access to the target resource
 * Prevents users from accessing/modifying data belonging to other users/tenants
 */
export async function verifyResourceOwnership(
  user: AuthenticatedUser,
  resourceType: 'customer' | 'entry' | 'bet' | 'agent',
  resourceId: string
): Promise<{ allowed: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Super admins can access everything
  if (user.role === 'super_admin') {
    return { allowed: true };
  }
  
  try {
    switch (resourceType) {
      case 'customer': {
        // Check if user owns this customer or is their parent agent
        const { data: customer } = await supabase
          .from('customers')
          .select('id, parent_agent_id, tenant_id')
          .eq('id', resourceId)
          .single();
        
        if (!customer) {
          return { allowed: false, error: 'Customer not found' };
        }
        
        // User is the customer themselves
        if (user.id === resourceId) return { allowed: true };
        
        // Admin can access all customers in their scope
        if (user.role === 'admin') return { allowed: true };
        
        // Agent can access their downline customers
        if (user.role === 'agent' && customer.parent_agent_id === user.id) {
          return { allowed: true };
        }
        
        return { allowed: false, error: 'Access denied to this customer' };
      }
      
      case 'entry': {
        // Check if user owns this entry or is an authorized admin
        const { data: entry } = await supabase
          .from('entries')
          .select('id, customer_id, created_by, tenant_id')
          .eq('id', resourceId)
          .single();
        
        if (!entry) {
          return { allowed: false, error: 'Entry not found' };
        }
        
        // User created this entry
        if (entry.created_by === user.id) return { allowed: true };
        
        // User is the customer of this entry
        if (entry.customer_id === user.id) return { allowed: true };
        
        // Admin can access entries
        if (user.role === 'admin') return { allowed: true };
        
        return { allowed: false, error: 'Access denied to this entry' };
      }
      
      case 'bet': {
        // Check bet ownership
        const { data: bet } = await supabase
          .from('bets')
          .select('id, customer_id, created_by, keyed_by, tenant_id')
          .eq('id', resourceId)
          .single();
        
        if (!bet) {
          return { allowed: false, error: 'Bet not found' };
        }
        
        // User is the customer, creator, or keyer of this bet
        if (bet.customer_id === user.id || bet.created_by === user.id || bet.keyed_by === user.id) {
          return { allowed: true };
        }
        
        // Admin can access bets
        if (user.role === 'admin') return { allowed: true };
        
        return { allowed: false, error: 'Access denied to this bet' };
      }
      
      case 'agent': {
        // Check if user is this agent or their parent
        const { data: agent } = await supabase
          .from('agents')
          .select('id, parent_id, owner_id')
          .eq('id', resourceId)
          .single();
        
        if (!agent) {
          return { allowed: false, error: 'Agent not found' };
        }
        
        // User is this agent
        if (user.id === resourceId) return { allowed: true };
        
        // User is the parent or owner
        if (agent.parent_id === user.id || agent.owner_id === user.id) {
          return { allowed: true };
        }
        
        // Admin can access agents
        if (user.role === 'admin') return { allowed: true };
        
        return { allowed: false, error: 'Access denied to this agent' };
      }
      
      default:
        return { allowed: false, error: 'Unknown resource type' };
    }
  } catch (error) {
    console.error('[Security] IDOR check error:', error);
    return { allowed: false, error: 'Access verification failed' };
  }
}

/**
 * Verify customer can only access their own data
 */
export async function verifyCustomerAccess(
  requestCustomerId: string,
  sessionCustomerId: string,
  user?: AuthenticatedUser | null
): Promise<{ allowed: boolean; error?: string }> {
  // Exact match - customer accessing own data
  if (requestCustomerId === sessionCustomerId) {
    return { allowed: true };
  }
  
  // Admin override
  if (user && (user.role === 'super_admin' || user.role === 'admin')) {
    return { allowed: true };
  }
  
  return { 
    allowed: false, 
    error: 'IDOR_VIOLATION: Cannot access other customer data' 
  };
}

// =====================================================
// INPUT SANITIZATION
// =====================================================

/**
 * Sanitize text input to prevent XSS
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

/**
 * Validate request body with Zod schema
 * Returns validated data or NextResponse error
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      
      console.warn('[Security] Validation failed:', errors);
      
      return {
        success: false,
        response: NextResponse.json(
          { 
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errors,
          },
          { status: 400 }
        ),
      };
    }
    
    // Sanitize the validated data
    const sanitizedData = sanitizeObject(result.data as Record<string, unknown>);
    
    return { success: true, data: sanitizedData as T };
  } catch (error) {
    console.error('[Security] Request parsing error:', error);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid request body', code: 'PARSE_ERROR' },
        { status: 400 }
      ),
    };
  }
}

// =====================================================
// COMBINED SECURITY GUARD
// =====================================================

export interface SecurityCheckResult {
  passed: boolean;
  user?: AuthenticatedUser;
  response?: NextResponse;
}

/**
 * Combined security check for sensitive API routes
 * Checks: Rate limiting, Authentication, 2FA status
 */
export async function securityGuard(
  request: NextRequest,
  options: {
    rateLimit?: RateLimitType;
    requireAuth?: boolean;
    require2FA?: boolean;
    allowedRoles?: string[];
  } = {}
): Promise<SecurityCheckResult> {
  const {
    rateLimit = 'api',
    requireAuth = true,
    require2FA = false,
    allowedRoles,
  } = options;
  
  // 1. Rate limiting
  const rateLimitResponse = await applyRateLimit(rateLimit);
  if (rateLimitResponse) {
    return { passed: false, response: rateLimitResponse };
  }
  
  // 2. Authentication
  if (requireAuth) {
    const authResult = await getAuthenticatedUser();
    
    if (!authResult.authenticated || !authResult.user) {
      return {
        passed: false,
        response: NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401 }
        ),
      };
    }
    
    // 3. Role check
    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(authResult.user.role) && authResult.user.role !== 'super_admin') {
        return {
          passed: false,
          response: NextResponse.json(
            { error: 'Forbidden', code: 'FORBIDDEN', required_roles: allowedRoles },
            { status: 403 }
          ),
        };
      }
    }
    
    // 4. 2FA check (for sensitive operations)
    if (require2FA) {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const session = cookieStore.get('session')?.value;
      
      if (session) {
        try {
          const sessionData = JSON.parse(decodeURIComponent(session));
          if (!sessionData.twoFactorVerified) {
            return {
              passed: false,
              response: NextResponse.json(
                { error: '2FA verification required', code: '2FA_REQUIRED' },
                { status: 403 }
              ),
            };
          }
        } catch {
          // Invalid session format
        }
      }
    }
    
    return { passed: true, user: authResult.user };
  }
  
  return { passed: true };
}

// =====================================================
// AUDIT LOGGING FOR SECURITY EVENTS
// =====================================================

export async function logSecurityEvent(
  eventType: 'rate_limit' | 'auth_failure' | 'idor_attempt' | 'validation_failure' | 'suspicious_activity',
  details: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase.from('audit_logs').insert({
      action: `security:${eventType}`,
      metadata: details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Silently fail - don't break the request for audit logging
    console.error('[Security] Failed to log security event:', eventType);
  }
}
