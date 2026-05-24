/**
 * SCALABLE API PATTERNS
 * =====================
 * Designed for 10,000+ concurrent users during peak lottery times
 * Uses connection pooling, caching, and queue-based processing
 */

import { NextRequest, NextResponse } from 'next/server';

// =====================================================
// 1. RATE LIMITING
// =====================================================

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: NextRequest) => string;
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(config: RateLimitConfig) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const key = config.keyGenerator?.(req) || 
                req.headers.get('x-forwarded-for')?.split(',')[0] || 
                'anonymous';
    
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < now) {
      entry = { count: 1, resetAt: now + config.windowMs };
      rateLimitStore.set(key, entry);
      return null; // Allow request
    }
    
    entry.count++;
    
    if (entry.count > config.maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((entry.resetAt - now) / 1000).toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetAt.toString(),
          }
        }
      );
    }
    
    return null; // Allow request
  };
}

// Pre-configured rate limiters
export const rateLimiters = {
  // Betting API - strict limit during peak times
  betting: rateLimit({
    windowMs: 1000, // 1 second
    maxRequests: 10, // 10 bets per second per user
    keyGenerator: (req) => {
      const userId = req.headers.get('x-user-id');
      return `bet:${userId || 'anonymous'}`;
    }
  }),
  
  // Read operations - more lenient
  read: rateLimit({
    windowMs: 1000,
    maxRequests: 100,
  }),
  
  // Auth operations - strict
  auth: rateLimit({
    windowMs: 60000, // 1 minute
    maxRequests: 10,
  }),
  
  // Admin operations
  admin: rateLimit({
    windowMs: 1000,
    maxRequests: 50,
  }),
};

// =====================================================
// 2. REQUEST QUEUE FOR BETTING
// =====================================================

interface QueuedBet {
  id: string;
  userId: string;
  siteId: string;
  roundId: string;
  bets: Array<{
    number: string;
    type: string;
    amount: number;
  }>;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

class BettingQueue {
  private queue: QueuedBet[] = [];
  private processing = false;
  private readonly BATCH_SIZE = 100;
  private readonly PROCESS_INTERVAL_MS = 100; // Process every 100ms

  constructor() {
    // Start processing loop
    setInterval(() => this.processQueue(), this.PROCESS_INTERVAL_MS);
  }

  async enqueue(bet: Omit<QueuedBet, 'id' | 'timestamp' | 'status'>): Promise<string> {
    const queuedBet: QueuedBet = {
      ...bet,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      status: 'pending',
    };
    
    this.queue.push(queuedBet);
    return queuedBet.id;
  }

  async getStatus(id: string): Promise<QueuedBet | null> {
    return this.queue.find(b => b.id === id) || null;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    try {
      // Get batch of pending bets
      const pendingBets = this.queue
        .filter(b => b.status === 'pending')
        .slice(0, this.BATCH_SIZE);
      
      if (pendingBets.length === 0) {
        this.processing = false;
        return;
      }
      
      // Mark as processing
      pendingBets.forEach(b => b.status = 'processing');
      
      // Process in parallel (in production, this would be database operations)
      await Promise.all(pendingBets.map(async (bet) => {
        try {
          // Simulate processing
          await this.processBet(bet);
          bet.status = 'completed';
          bet.result = { success: true, betId: bet.id };
        } catch (error) {
          bet.status = 'failed';
          bet.error = error instanceof Error ? error.message : 'Unknown error';
        }
      }));
      
      // Clean up old entries (keep for 5 minutes)
      const cutoff = Date.now() - 5 * 60 * 1000;
      this.queue = this.queue.filter(b => 
        b.timestamp > cutoff || b.status === 'pending' || b.status === 'processing'
      );
      
    } finally {
      this.processing = false;
    }
  }

  private async processBet(bet: QueuedBet): Promise<void> {
    // In production, this would:
    // 1. Validate bet limits
    // 2. Check user balance
    // 3. Deduct balance
    // 4. Insert bet record
    // 5. Update number limits
    // All in a database transaction
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

export const bettingQueue = new BettingQueue();

// =====================================================
// 3. CACHING LAYER
// =====================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleAt: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL_MS = 30000; // 30 seconds
  private readonly DEFAULT_STALE_MS = 60000; // 1 minute

  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttlMs?: number; staleMs?: number }
  ): Promise<T> {
    const ttlMs = options?.ttlMs ?? this.DEFAULT_TTL_MS;
    const staleMs = options?.staleMs ?? this.DEFAULT_STALE_MS;
    const now = Date.now();
    
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    // Cache hit and fresh
    if (entry && now < entry.expiresAt) {
      return entry.data;
    }
    
    // Cache hit but stale - return stale data and refresh in background
    if (entry && now < entry.staleAt) {
      // Background refresh
      this.refresh(key, fetcher, ttlMs, staleMs);
      return entry.data;
    }
    
    // Cache miss or expired - fetch fresh data
    const data = await fetcher();
    this.set(key, data, ttlMs, staleMs);
    return data;
  }

  private set<T>(key: string, data: T, ttlMs: number, staleMs: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      expiresAt: now + ttlMs,
      staleAt: now + staleMs,
    });
  }

  private async refresh<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
    staleMs: number
  ): Promise<void> {
    try {
      const data = await fetcher();
      this.set(key, data, ttlMs, staleMs);
    } catch (error) {
      console.error(`[Cache] Failed to refresh key ${key}:`, error);
    }
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const cache = new CacheManager();

// Pre-defined cache keys
export const cacheKeys = {
  lotteries: () => 'lotteries:all',
  lottery: (id: string) => `lottery:${id}`,
  activeRounds: () => 'rounds:active',
  round: (id: string) => `round:${id}`,
  rates: (siteId: string, lotteryId: string) => `rates:${siteId}:${lotteryId}`,
  limits: (lotteryId: string) => `limits:${lotteryId}`,
  userBalance: (userId: string) => `balance:${userId}`,
  siteConfig: (siteId: string) => `site:${siteId}:config`,
};

// =====================================================
// 4. CONNECTION POOLING (Supabase/PostgreSQL)
// =====================================================

// Connection pool configuration
export const dbPoolConfig = {
  // Maximum number of connections in the pool
  max: 20,
  
  // Minimum number of connections to maintain
  min: 5,
  
  // How long a client is allowed to remain idle before being closed
  idleTimeoutMillis: 30000,
  
  // How long to wait for a connection from the pool
  connectionTimeoutMillis: 5000,
  
  // Statement timeout for queries
  statement_timeout: 30000,
  
  // Keep-alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// =====================================================
// 5. API RESPONSE HELPERS
// =====================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: number;
    requestId: string;
    cached?: boolean;
    processingTime?: number;
  };
}

export function createApiResponse<T>(
  data: T,
  requestId: string,
  cached = false,
  startTime?: number
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      requestId,
      cached,
      processingTime: startTime ? Date.now() - startTime : undefined,
    }
  });
}

export function createErrorResponse(
  error: string,
  status: number,
  requestId: string
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      meta: {
        timestamp: Date.now(),
        requestId,
      }
    },
    { status }
  );
}

// =====================================================
// 6. REQUEST VALIDATION
// =====================================================

export function validateBetRequest(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid request body'] };
  }
  
  const bet = data as Record<string, unknown>;
  
  if (!bet.roundId || typeof bet.roundId !== 'string') {
    errors.push('Invalid roundId');
  }
  
  if (!bet.bets || !Array.isArray(bet.bets)) {
    errors.push('bets must be an array');
  } else {
    bet.bets.forEach((b: unknown, i: number) => {
      const item = b as Record<string, unknown>;
      if (!item.number || typeof item.number !== 'string') {
        errors.push(`bets[${i}].number is required`);
      }
      if (!item.type || typeof item.type !== 'string') {
        errors.push(`bets[${i}].type is required`);
      }
      if (typeof item.amount !== 'number' || item.amount <= 0) {
        errors.push(`bets[${i}].amount must be a positive number`);
      }
    });
  }
  
  return { valid: errors.length === 0, errors };
}

// =====================================================
// 7. MIDDLEWARE CHAIN
// =====================================================

type Middleware = (req: NextRequest) => Promise<NextResponse | null>;

export function createMiddlewareChain(...middlewares: Middleware[]) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    for (const middleware of middlewares) {
      const response = await middleware(req);
      if (response) return response; // Short-circuit if middleware returns response
    }
    return null;
  };
}

// Example usage for betting endpoint:
export const bettingMiddleware = createMiddlewareChain(
  rateLimiters.betting,
  // Add more middlewares as needed
);

// =====================================================
// 8. GRACEFUL DEGRADATION
// =====================================================

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  options?: { timeout?: number }
): Promise<T> {
  const timeout = options?.timeout ?? 5000;
  
  try {
    return await Promise.race([
      primary(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
  } catch (error) {
    console.warn('[Fallback] Primary failed, using fallback:', error);
    return fallback();
  }
}

// =====================================================
// 9. HEALTH CHECK
// =====================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: {
    database: boolean;
    cache: boolean;
    queue: boolean;
  };
  metrics: {
    queueLength: number;
    cacheSize: number;
    uptime: number;
  };
}

const startTime = Date.now();

export function getHealthStatus(): HealthStatus {
  const dbHealthy = true; // In production, actually check DB connection
  const cacheHealthy = true;
  const queueHealthy = true;
  
  const allHealthy = dbHealthy && cacheHealthy && queueHealthy;
  const anyUnhealthy = !dbHealthy || !cacheHealthy || !queueHealthy;
  
  return {
    status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
    timestamp: Date.now(),
    services: {
      database: dbHealthy,
      cache: cacheHealthy,
      queue: queueHealthy,
    },
    metrics: {
      queueLength: 0, // Get from actual queue
      cacheSize: 0, // Get from actual cache
      uptime: Date.now() - startTime,
    }
  };
}
