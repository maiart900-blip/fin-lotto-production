# FINAL DEPLOYMENT CHECKLIST

## Database Schema Verification Results

### Tables WITH scope columns (Ready):
| Table | tenant_id | agent_id | parent_agent_id |
|-------|-----------|----------|-----------------|
| customers | YES | YES | YES |
| entries | YES | YES | N/A |
| agents | YES | N/A | YES |

### Tables MISSING scope columns (Need Migration):
| Table | tenant_id | agent_id | Has customer_id |
|-------|-----------|----------|-----------------|
| credit_transactions | NO | NO | YES |
| slip_uploads | NO | NO | NO (has user_id) |
| topup_requests | NO | NO | YES |
| withdraw_requests | NO | NO | YES |

---

## Pre-Deployment Steps (IN ORDER)

### Step 1: Run Schema Migration
```bash
# Add missing columns to tables
psql $DATABASE_URL -f lib/db/migrations/add-scope-columns.sql
```

**What this does:**
- Adds `tenant_id` and `agent_id` columns to 4 tables
- Backfills existing rows from customers table via JOIN
- Creates triggers to auto-populate on INSERT/UPDATE

### Step 2: Verify Backfill
```sql
SELECT 
  'credit_transactions' as table_name,
  COUNT(*) as total,
  COUNT(tenant_id) as with_tenant,
  COUNT(agent_id) as with_agent
FROM credit_transactions
UNION ALL
SELECT 'topup_requests', COUNT(*), COUNT(tenant_id), COUNT(agent_id) FROM topup_requests
UNION ALL
SELECT 'withdraw_requests', COUNT(*), COUNT(tenant_id), COUNT(agent_id) FROM withdraw_requests
UNION ALL
SELECT 'slip_uploads', COUNT(*), COUNT(tenant_id), COUNT(agent_id) FROM slip_uploads;
```

**Expected:** `with_tenant` and `with_agent` should equal `total` for each table.

### Step 3: Run Index Migration
```bash
# Create performance indexes (uses CONCURRENTLY)
psql $DATABASE_URL -f lib/db/migrations/production-scope-indexes.sql
```

### Step 4: Verify Indexes
```sql
SELECT indexname, tablename FROM pg_indexes 
WHERE indexname LIKE 'idx_%tenant%' OR indexname LIKE 'idx_%agent%'
ORDER BY tablename;
```

**Expected:** 25+ indexes created.

---

## Deployment Steps

### Step 5: Deploy Code
```bash
git push origin main
# Or merge PR
```

### Step 6: Verify Build
- Check Vercel deployment logs
- Confirm no build errors

### Step 7: Smoke Test (Staging)
1. Login as super_admin - verify access to all data
2. Login as tenant_owner - verify only tenant data visible
3. Login as agent - verify only downline data visible
4. Create new customer - verify tenant_id/agent_id auto-populated
5. Check cron jobs - verify still working

---

## Post-Deployment Monitoring

### Metrics to Watch (First 24 Hours)
- [ ] API error rate (expect < 1%)
- [ ] 403 response rate from agents
- [ ] Query latency on scoped APIs
- [ ] Cron job completion status

### Alert Triggers
- API error rate > 5%
- Agent reports seeing no data
- Super admin reports missing data
- Query latency > 2x baseline

---

## Rollback Plan

### Code Rollback
```bash
git revert HEAD
git push origin main
```

### Index Rollback (if needed)
```sql
-- Safe to drop, won't affect data
DROP INDEX IF EXISTS idx_customers_tenant_id;
DROP INDEX IF EXISTS idx_customers_agent_id;
-- ... (see full list in VERIFICATION_AUDIT_REPORT.md)
```

### Column Rollback (DESTRUCTIVE - last resort)
```sql
-- WARNING: This removes the scope columns
ALTER TABLE credit_transactions DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS agent_id;
ALTER TABLE slip_uploads DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS agent_id;
ALTER TABLE topup_requests DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS agent_id;
ALTER TABLE withdraw_requests DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS agent_id;
```

---

## Migration Files Summary

| File | Purpose | Run Order |
|------|---------|-----------|
| `add-scope-columns.sql` | Add missing columns + backfill | 1st |
| `production-scope-indexes.sql` | Create performance indexes | 2nd |

---

## Sign-Off

- [ ] DBA reviewed schema migration
- [ ] QA completed staging tests
- [ ] On-call engineer notified
- [ ] Rollback plan tested

**Deployment Window:** Low-traffic period recommended
**Estimated Duration:** 30-60 minutes (including backfill)
