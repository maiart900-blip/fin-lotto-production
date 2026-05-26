# Level 5 Platform Roadmap

## Executive Summary

Transform the current production lottery system into an autonomous, secure, scalable, and observable enterprise platform through phased implementation.

---

## Current Architecture Audit (Level 1.5 - Production Ready)

### What We Have

| Category | Status | Files |
|----------|--------|-------|
| **Authentication** | Cookie-based + RBAC | `lib/api-auth.ts`, `lib/rbac.ts` |
| **API Protection** | Per-route guards | `requireAdmin()`, `requireSuperAdmin()`, etc. |
| **Serializers** | Basic response formatting | `lib/api-serializers.ts` |
| **Fetcher** | Centralized with credentials | `lib/fetcher.ts` |
| **Audit Logging** | Type definitions exist | `lib/audit-logger.ts` (not fully integrated) |
| **Monitoring** | Basic health checks | `lib/monitoring.ts` |
| **Middleware** | Session update only | `middleware.ts` |
| **Database** | Supabase PostgreSQL | 345+ API routes |
| **Caching** | Upstash Redis available | `lib/redis.ts` |

### Gaps Identified

1. **No rate limiting** on API routes
2. **Audit logging not integrated** into API routes
3. **No request validation middleware**
4. **No centralized error handling**
5. **No API versioning**
6. **No circuit breaker patterns**
7. **No automated testing**
8. **No CI/CD pipeline**
9. **No metrics/observability**
10. **No automated compliance checks**

---

## Level Definitions

### Level 2: Scale-Ready
- Rate limiting
- Caching strategy
- Database connection pooling
- Request validation
- Error handling middleware
- Basic metrics

### Level 3: Enterprise/Compliance-Ready
- Full audit trail
- Data encryption at rest
- GDPR/compliance tools
- Role-based data access
- Automated backups
- Disaster recovery

### Level 4: Platform Ecosystem-Ready
- API versioning
- Webhook system
- Plugin architecture
- Multi-tenant isolation
- External integrations
- Developer portal

### Level 5: Autonomous/AI Ops-Ready
- Self-healing systems
- Anomaly detection
- Predictive scaling
- AI-powered fraud detection
- Automated incident response
- Continuous optimization

---

## Phase 1: Scale-Ready Foundation (Level 2)

### PR 1.1: Rate Limiting Infrastructure
**Risk Level:** Low
**Estimated Scope:** 3 files

#### Files to Change
```
lib/rate-limiter.ts (new)
middleware.ts (modify)
app/api/**/route.ts (add decorator)
```

#### Implementation
```typescript
// lib/rate-limiter.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const rateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
});

export const apiRateLimits = {
  default: { requests: 100, window: '1 m' },
  auth: { requests: 10, window: '1 m' },
  write: { requests: 30, window: '1 m' },
  read: { requests: 200, window: '1 m' },
};
```

#### Database Migrations
- None required (uses Redis)

#### Tests
- Unit test for rate limiter
- Integration test for blocked requests

#### Rollback Plan
- Remove middleware rate limit check
- Rate limiter is stateless, no data to rollback

---

### PR 1.2: Request Validation Middleware
**Risk Level:** Low
**Estimated Scope:** 5 files

#### Files to Change
```
lib/validation.ts (new)
lib/api-auth.ts (extend)
app/api/auth/login/route.ts (example integration)
app/api/customers/route.ts (example integration)
app/api/bets/route.ts (example integration)
```

#### Implementation
```typescript
// lib/validation.ts
import { z } from 'zod';

export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return async (request: Request): Promise<{ data: T } | { error: Response }> => {
    try {
      const body = await request.json();
      const data = schema.parse(body);
      return { data };
    } catch (error) {
      return { 
        error: NextResponse.json(
          { code: 'VALIDATION_ERROR', errors: error.errors },
          { status: 400 }
        )
      };
    }
  };
}

// Reusable schemas
export const schemas = {
  login: z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(6),
  }),
  createCustomer: z.object({
    name: z.string().min(2),
    phone: z.string().regex(/^[0-9]{10}$/),
    credit_limit: z.number().min(0).optional(),
  }),
  placeBet: z.object({
    lottery_id: z.string().uuid(),
    entries: z.array(z.object({
      type: z.enum(['3top', '3tod', '2top', '2bot', 'run_top', 'run_bot']),
      number: z.string(),
      amount: z.number().positive(),
    })),
  }),
};
```

#### Tests
- Schema validation tests
- Error response format tests

#### Rollback Plan
- Remove validation calls from routes
- Routes fall back to manual validation

---

### PR 1.3: Centralized Error Handling
**Risk Level:** Low
**Estimated Scope:** 4 files

#### Files to Change
```
lib/api-errors.ts (new)
lib/api-auth.ts (extend error handling)
app/api/**/route.ts (wrap with handler)
```

#### Implementation
```typescript
// lib/api-errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number = 400,
    public details?: unknown
  ) {
    super(message);
  }
}

export const Errors = {
  UNAUTHORIZED: new ApiError('UNAUTHORIZED', 'Authentication required', 401),
  FORBIDDEN: new ApiError('FORBIDDEN', 'Access denied', 403),
  NOT_FOUND: new ApiError('NOT_FOUND', 'Resource not found', 404),
  VALIDATION: (errors: unknown) => new ApiError('VALIDATION_ERROR', 'Invalid input', 400, errors),
  RATE_LIMITED: new ApiError('RATE_LIMITED', 'Too many requests', 429),
  INTERNAL: new ApiError('INTERNAL_ERROR', 'Internal server error', 500),
};

export function withErrorHandler(handler: Function) {
  return async (request: Request, context?: unknown) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { code: error.code, message: error.message, details: error.details },
          { status: error.status }
        );
      }
      console.error('[API Error]', error);
      return NextResponse.json(
        { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        { status: 500 }
      );
    }
  };
}
```

#### Rollback Plan
- Routes continue to work with try/catch
- Error handler is additive, no breaking changes

---

### PR 1.4: Response Caching Layer
**Risk Level:** Medium
**Estimated Scope:** 6 files

#### Files to Change
```
lib/cache.ts (new)
lib/redis.ts (extend)
app/api/lotteries/route.ts (add caching)
app/api/lottery-results/route.ts (add caching)
app/api/payout-rates/route.ts (add caching)
```

#### Implementation
```typescript
// lib/cache.ts
import { redis } from './redis';

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data as T | null;
  },
  
  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  },
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};

export const cacheKeys = {
  lotteries: 'lotteries:all',
  lottery: (id: string) => `lottery:${id}`,
  results: (date: string) => `results:${date}`,
  payoutRates: (lotteryId: string) => `payout_rates:${lotteryId}`,
};

export const cacheTTL = {
  lotteries: 300, // 5 minutes
  results: 86400, // 24 hours
  payoutRates: 3600, // 1 hour
};
```

#### Rollback Plan
- Remove cache calls, routes hit database directly
- No data loss, cache is read-through

---

## Phase 2: Enterprise Foundation (Level 3)

### PR 2.1: Audit Trail Integration
**Risk Level:** Medium
**Estimated Scope:** 20+ files

#### Files to Change
```
lib/audit-logger.ts (complete implementation)
lib/api-auth.ts (add audit logging)
app/api/auth/login/route.ts
app/api/customers/route.ts
app/api/bets/route.ts
app/api/transactions/route.ts
... (all write operations)
```

#### Database Migrations
```sql
-- 002-audit-logs-table.sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID,
  actor_type TEXT,
  target_type TEXT,
  target_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  risk_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
```

#### Rollback Plan
- Disable audit logging flag
- Logs table remains for historical data

---

### PR 2.2: Data Encryption Layer
**Risk Level:** High
**Estimated Scope:** 10 files

#### Files to Change
```
lib/encryption.ts (new)
lib/supabase/server.ts (add encryption hooks)
app/api/customers/route.ts (encrypt PII)
app/api/bank-accounts/route.ts (encrypt sensitive data)
```

#### Implementation
```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY!;
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Fields to encrypt
export const sensitiveFields = {
  customers: ['phone', 'line_id', 'bank_account'],
  bank_accounts: ['account_number'],
};
```

#### Rollback Plan
- Keep encrypted data, add decrypt-on-read
- Migration script to decrypt if needed

---

### PR 2.3: Compliance Dashboard
**Risk Level:** Low
**Estimated Scope:** 5 files

#### Files to Create
```
app/(main)/compliance/page.tsx
app/api/compliance/audit-report/route.ts
app/api/compliance/data-export/route.ts
app/api/compliance/retention-status/route.ts
```

---

## Phase 3: Platform Ecosystem (Level 4)

### PR 3.1: API Versioning
**Risk Level:** Medium
**Estimated Scope:** Base infrastructure + gradual migration

#### Files to Change
```
middleware.ts (add version routing)
app/api/v2/[...path]/route.ts (version handler)
lib/api-version.ts (new)
```

#### Implementation Strategy
1. Keep `/api/*` as v1 (current)
2. Add `/api/v2/*` with new patterns
3. Gradual deprecation of v1

---

### PR 3.2: Webhook System
**Risk Level:** Medium
**Estimated Scope:** 8 files

#### Files to Create
```
lib/webhooks.ts
app/api/webhooks/register/route.ts
app/api/webhooks/[id]/route.ts
app/api/admin/webhooks/route.ts
```

#### Database Migrations
```sql
-- 003-webhooks-table.sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id),
  event TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### PR 3.3: Multi-Tenant Data Isolation
**Risk Level:** High
**Estimated Scope:** 15+ files

#### Implementation
- Add `tenant_id` column to all relevant tables
- RLS policies for tenant isolation
- Tenant context in API requests

---

## Phase 4: Autonomous Operations (Level 5)

### PR 4.1: Anomaly Detection System
**Risk Level:** Medium
**Estimated Scope:** 6 files

#### Files to Create
```
lib/anomaly/detector.ts
lib/anomaly/patterns.ts
app/api/ai/anomaly-check/route.ts
app/(main)/ai-ops/anomalies/page.tsx
```

#### Implementation
```typescript
// lib/anomaly/detector.ts
export interface AnomalyPattern {
  id: string;
  name: string;
  check: (data: unknown) => Promise<AnomalyResult>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const anomalyPatterns: AnomalyPattern[] = [
  {
    id: 'unusual_bet_pattern',
    name: 'Unusual Betting Pattern',
    severity: 'high',
    check: async (data) => {
      // Check for unusual bet amounts or frequencies
    },
  },
  {
    id: 'suspicious_login',
    name: 'Suspicious Login Activity',
    severity: 'medium',
    check: async (data) => {
      // Check for login from new location/device
    },
  },
  {
    id: 'credit_anomaly',
    name: 'Credit Balance Anomaly',
    severity: 'critical',
    check: async (data) => {
      // Check for unexpected credit changes
    },
  },
];
```

---

### PR 4.2: Self-Healing Infrastructure
**Risk Level:** High
**Estimated Scope:** 8 files

#### Files to Create
```
lib/self-healing/health-monitor.ts
lib/self-healing/recovery-actions.ts
app/api/cron/health-check/route.ts
app/api/cron/auto-recovery/route.ts
```

---

### PR 4.3: AI-Powered Fraud Detection
**Risk Level:** Medium
**Estimated Scope:** 6 files

#### Files to Create
```
lib/ai/fraud-model.ts
lib/ai/risk-scoring.ts
app/api/ai/fraud-check/route.ts
app/(main)/ai-ops/fraud-dashboard/page.tsx
```

---

## Implementation Schedule

| Phase | PRs | Timeline | Dependencies |
|-------|-----|----------|--------------|
| **Phase 1** | 1.1 - 1.4 | Week 1-2 | None |
| **Phase 2** | 2.1 - 2.3 | Week 3-4 | Phase 1 complete |
| **Phase 3** | 3.1 - 3.3 | Week 5-7 | Phase 2 complete |
| **Phase 4** | 4.1 - 4.3 | Week 8-10 | Phase 3 complete |

---

## Risk Assessment

| PR | Risk Level | Impact if Failed | Mitigation |
|----|------------|------------------|------------|
| 1.1 Rate Limiting | Low | Some requests blocked | Feature flag |
| 1.2 Validation | Low | Invalid data rejected | Schema fallback |
| 1.3 Error Handling | Low | Error format changes | Backward compat |
| 1.4 Caching | Medium | Stale data possible | Cache invalidation |
| 2.1 Audit Trail | Medium | Missing audit records | Async logging |
| 2.2 Encryption | High | Data access issues | Gradual rollout |
| 2.3 Compliance | Low | Dashboard only | No data changes |
| 3.1 API Versioning | Medium | Route confusion | Parallel versions |
| 3.2 Webhooks | Medium | Failed deliveries | Retry queue |
| 3.3 Multi-Tenant | High | Data leakage | RLS policies |
| 4.1 Anomaly Detection | Medium | False positives | Tuning period |
| 4.2 Self-Healing | High | Incorrect recovery | Manual override |
| 4.3 Fraud Detection | Medium | False positives | Human review |

---

## Next Steps

1. **Start with PR 1.1** (Rate Limiting) - Lowest risk, immediate value
2. **Set up CI/CD pipeline** for automated testing
3. **Create test coverage baseline** before major changes
4. **Document all API changes** for backwards compatibility

---

## Success Metrics

| Level | Metric | Target |
|-------|--------|--------|
| Level 2 | API response time p99 | < 500ms |
| Level 2 | Rate limit effectiveness | < 1% abuse |
| Level 3 | Audit log completeness | 100% write ops |
| Level 3 | Data encryption coverage | 100% PII |
| Level 4 | Webhook delivery rate | > 99% |
| Level 4 | Tenant isolation score | 100% |
| Level 5 | Anomaly detection rate | > 90% |
| Level 5 | Auto-recovery success | > 95% |
