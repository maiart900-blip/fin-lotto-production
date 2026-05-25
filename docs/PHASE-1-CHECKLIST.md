# Phase 1 Implementation Checklist

## PR 1.1: Rate Limiting Infrastructure

### Pre-Implementation
- [ ] Verify Upstash Redis connection
- [ ] Review current API traffic patterns
- [ ] Document current request volumes

### Implementation
- [ ] Create `lib/rate-limiter.ts`
- [ ] Update `middleware.ts` with rate limit check
- [ ] Add rate limit headers to responses
- [ ] Create admin endpoint to view rate limit stats

### Testing
- [ ] Unit test: Rate limiter configuration
- [ ] Unit test: Sliding window logic
- [ ] Integration test: Blocked request returns 429
- [ ] Integration test: Rate limit headers present
- [ ] Load test: Verify limits under pressure

### Deployment
- [ ] Deploy to staging
- [ ] Monitor for false positives (30 min)
- [ ] Deploy to production
- [ ] Monitor for 24 hours

### Rollback Triggers
- Error rate > 5%
- False positive rate > 1%
- Latency increase > 100ms

---

## PR 1.2: Request Validation Middleware

### Pre-Implementation
- [ ] Audit existing request validation code
- [ ] Document all API request schemas
- [ ] Install zod if not present

### Implementation
- [ ] Create `lib/validation.ts`
- [ ] Define schemas for critical endpoints:
  - [ ] `auth/login`
  - [ ] `customers` (POST/PUT)
  - [ ] `bets` (POST)
  - [ ] `transactions` (POST)
- [ ] Update routes to use validation

### Testing
- [ ] Unit test: Schema validation
- [ ] Unit test: Error response format
- [ ] Integration test: Invalid request rejected
- [ ] Integration test: Valid request passes

### Deployment
- [ ] Deploy to staging
- [ ] Test all forms in UI
- [ ] Deploy to production

---

## PR 1.3: Centralized Error Handling

### Pre-Implementation
- [ ] Document current error response formats
- [ ] Identify all error codes in use
- [ ] Plan migration path for existing errors

### Implementation
- [ ] Create `lib/api-errors.ts`
- [ ] Define standard error codes
- [ ] Create `withErrorHandler` wrapper
- [ ] Update critical routes:
  - [ ] `auth/*`
  - [ ] `customers/*`
  - [ ] `bets/*`

### Testing
- [ ] Unit test: ApiError class
- [ ] Unit test: Error handler wrapper
- [ ] Integration test: Error response format
- [ ] Integration test: Stack traces not leaked

### Deployment
- [ ] Deploy to staging
- [ ] Verify error handling in UI
- [ ] Deploy to production

---

## PR 1.4: Response Caching Layer

### Pre-Implementation
- [ ] Identify cacheable endpoints
- [ ] Determine TTL for each endpoint
- [ ] Verify Redis capacity

### Implementation
- [ ] Create `lib/cache.ts`
- [ ] Add caching to:
  - [ ] `GET /api/lotteries`
  - [ ] `GET /api/lottery-results`
  - [ ] `GET /api/payout-rates`
- [ ] Add cache invalidation on writes

### Testing
- [ ] Unit test: Cache get/set
- [ ] Unit test: Cache invalidation
- [ ] Integration test: Cache hit
- [ ] Integration test: Cache miss
- [ ] Integration test: Stale data after write

### Deployment
- [ ] Deploy to staging
- [ ] Verify data freshness
- [ ] Monitor cache hit rate
- [ ] Deploy to production

---

## Phase 1 Completion Criteria

- [ ] All PRs merged
- [ ] No production incidents for 48 hours
- [ ] Rate limit dashboard working
- [ ] Cache hit rate > 50% for cached endpoints
- [ ] Error response format consistent
- [ ] All validation schemas documented
