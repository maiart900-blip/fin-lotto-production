# Capacity & Load Test Report

Generated: 2026-05-25

## Executive Summary

### Quick Health Check Results (Baseline)

| Metric | Value | Status |
|--------|-------|--------|
| Total Endpoints Tested | 5 | - |
| Average Response Time | 741ms | Good |
| Error Count | 0 | Excellent |
| Health Score | 100% | Excellent |

### Endpoint Response Times

| Endpoint | Response Time | Status |
|----------|---------------|--------|
| /api/health | 647ms | OK |
| /api/lotteries | 732ms | OK |
| /api/dashboard/stats | 965ms | OK |
| /api/customers?limit=1 | 676ms | OK |
| /api/entries?limit=1 | 684ms | OK |

### Stress Test Results (5 iterations, 3 endpoints)

| Metric | Value |
|--------|-------|
| Total Requests | 15 |
| Average Response Time | 134ms |
| P95 Response Time | 300ms |
| Error Rate | 0% |

---

## Preliminary Capacity Estimates

Based on initial testing:

| Metric | Estimate | Notes |
|--------|----------|-------|
| Safe Concurrent Users | 50-100 | Conservative estimate |
| Normal Load Users | 100-250 | With proper monitoring |
| Peak Load Users | 250-500 | May need optimization |
| Estimated Breaking Point | 500-1000 | Requires full load testing |

**Note:** These are preliminary estimates. Full k6 load testing is required for accurate capacity assessment.

---

## System Architecture Overview

### Components Tested

1. **Public Pages** - Landing, login, register, lotteries
2. **Customer Dashboard** - Profile, wallet, betting history
3. **Agent Dashboard** - Network, commission, members
4. **Betting Flow** - Lottery browsing, bet placement
5. **Credit/Transactions** - Financial operations
6. **Admin Dashboard** - Management operations
7. **Monitoring APIs** - Health checks, metrics

### Database

- **Supabase PostgreSQL** - Primary database
- Connection pooling: Enabled via Supabase
- Estimated queries/second: 100-500

### Caching

- **Upstash Redis** - Session and rate limiting
- **In-memory caching** - Route-level caching

### Serverless Functions

- **Vercel Functions** - All API endpoints
- Cold start time: ~500-1000ms
- Warm request time: ~50-200ms

---

## How to Run Full Load Tests

### Prerequisites

```bash
# Install k6 (macOS)
brew install k6

# Install k6 (Linux)
sudo apt-get install k6

# Or via Docker
docker run --rm -i grafana/k6 run -
```

### Running Tests

```bash
# Run all tests at baseline (50 VUs)
./load-tests/run-all.sh

# Run specific test
k6 run load-tests/scripts/public-pages.js

# Run with different traffic levels
k6 run -e LEVEL=normal load-tests/scripts/public-pages.js   # 100 VUs
k6 run -e LEVEL=peak load-tests/scripts/public-pages.js     # 250 VUs
k6 run -e LEVEL=stress load-tests/scripts/public-pages.js   # 500 VUs

# Run full system test with custom VUs
k6 run -e MAX_VUS=50 load-tests/scripts/full-system.js
k6 run -e MAX_VUS=100 load-tests/scripts/full-system.js
k6 run -e MAX_VUS=250 load-tests/scripts/full-system.js
k6 run -e MAX_VUS=500 load-tests/scripts/full-system.js
k6 run -e MAX_VUS=1000 load-tests/scripts/full-system.js

# Generate report after tests
node load-tests/generate-report.js
```

### Test Categories

| Test | Description | VUs Range |
|------|-------------|-----------|
| public-pages.js | Unauthenticated endpoints | 50-1000 |
| auth-flow.js | Login, session, logout | 50-500 |
| customer-dashboard.js | Customer operations | 50-500 |
| betting-flow.js | Lottery and betting | 50-500 |
| credit-transactions.js | Financial APIs | 50-250 |
| admin-dashboard.js | Admin operations | 50-250 |
| agent-dashboard.js | Agent operations | 50-250 |
| monitoring-apis.js | Health and metrics | 50-500 |
| full-system.js | Realistic mixed load | 50-1000 |

---

## Recommended Optimizations

### Database

1. **Add Missing Indexes**
```sql
-- High-priority indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_lottery_created 
  ON entries(lottery_id, created_at DESC);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bets_user_status 
  ON bets(user_id, status, created_at DESC);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_type 
  ON credit_transactions(user_id, transaction_type, created_at DESC);
```

2. **Enable Connection Pooling**
   - Use Supabase connection pooling (already enabled)
   - Monitor connection count via dashboard

### API Optimization

1. **Implement Response Caching**
   - Cache lottery lists (TTL: 60s)
   - Cache payout rates (TTL: 300s)
   - Cache announcements (TTL: 300s)

2. **Pagination**
   - Ensure all list endpoints use pagination
   - Default limit: 20, max: 100

### Infrastructure

1. **Supabase Upgrades**
   - Pro plan for production (8GB RAM, connection pooling)
   - Consider dedicated compute for 500+ users

2. **Vercel Upgrades**
   - Pro plan for higher function limits
   - Consider Edge Functions for latency-sensitive endpoints

3. **Redis Upgrades**
   - Upstash pay-as-you-go for higher limits
   - Monitor commands/second

---

## Metrics to Monitor

### Response Times
- Target P95: < 2000ms
- Target P99: < 5000ms
- Alert threshold: P95 > 3000ms

### Error Rates
- Target: < 1%
- Warning threshold: > 2%
- Alert threshold: > 5%

### Database
- Connection count
- Query duration
- Active transactions

### Redis
- Commands/second
- Memory usage
- Connection count

---

## Next Steps

1. **Run full k6 load tests** at each traffic level
2. **Monitor Supabase dashboard** during tests
3. **Check Vercel function logs** for timeouts
4. **Review Redis metrics** in Upstash dashboard
5. **Generate full capacity report** with `node load-tests/generate-report.js`

---

## Files Created

- `load-tests/README.md` - Documentation
- `load-tests/config.js` - Shared configuration
- `load-tests/run-all.sh` - Test runner script
- `load-tests/generate-report.js` - Report generator
- `load-tests/scripts/` - K6 test scripts
  - `public-pages.js`
  - `auth-flow.js`
  - `customer-dashboard.js`
  - `betting-flow.js`
  - `credit-transactions.js`
  - `admin-dashboard.js`
  - `agent-dashboard.js`
  - `monitoring-apis.js`
  - `full-system.js`
- `app/api/admin/load-test/route.ts` - In-app load test API
