# FIN LOTTO Smoke Test Results

**Date:** May 26, 2026  
**Environment:** Development (localhost:3000)

---

## Test Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Child Site Routing | PASS | `/t/meetang-huayja` loads correctly |
| 2. Branding Isolation | PASS | Child shows "มีตังค์หวยจ๋า", Master shows "FIN LOTTO Master" |
| 3. Dashboard Isolation | PASS | Admin routes require authentication |
| 4. Entry Visibility | BLOCKED | 52 entries, 0 have tenant_id |
| 5. Risk System | PARTIAL | Only `risk_settings` exists |

---

## Detailed Results

### Test 1: Child Site Routing - PASS

**URL Tested:** `http://localhost:3000/t/meetang-huayja`

**Result:** Page loads successfully with child site content:
- Header shows: "มีตังค์หวยจ๋า"
- Welcome text shows: "ยินดีต้อนรับสู่ มีตังค์หวยจ๋า"
- Navigation links work (หน้าแรก, ซื้อหวย, ผลหวย, etc.)

**Evidence:** Snapshot shows correct tenant context loaded.

---

### Test 2: Branding Isolation - PASS

**URLs Tested:**
- Child: `/t/meetang-huayja`
- Master: `/t/master`

**Result:** Each tenant displays its own branding:

| Element | Child Site | Master Site |
|---------|------------|-------------|
| Header Title | มีตังค์หวยจ๋า | FIN LOTTO Master |
| Welcome Text | ยินดีต้อนรับสู่ มีตังค์หวยจ๋า | ยินดีต้อนรับสู่ FIN LOTTO Master |

**Evidence:** Screenshots show distinct branding per tenant.

---

### Test 3: Dashboard Isolation - PASS

**URLs Tested:**
- `/admin` - Redirects to login (protected)
- `/t/meetang-huayja/customer/login` - Accessible (public)

**Result:** Admin areas require authentication. Child site customer portal is accessible.

---

### Test 4: Entry Visibility - BLOCKED

**Query Result:**
```
total_entries: 52
entries_with_tenant: 0
entries_without_tenant: 52
```

**Impact:** 
- Tenant-scoped queries will return 0 entries
- Child site users will see empty slip history
- Risk aggregation will have no data to aggregate

**Required Fix:**
```sql
UPDATE entries e
SET tenant_id = c.tenant_id
FROM customers c
WHERE e.customer_id = c.id
  AND e.tenant_id IS NULL;
```

---

### Test 5: Risk System - PARTIAL

**Table Status:**
| Table | Status |
|-------|--------|
| `risk_settings` | EXISTS |
| `risk_aggregations` | MISSING |
| `site_api_keys` | MISSING |

**Impact:**
- `/api/risk/ingest` will fail (no table to insert into)
- `/api/risk/dashboard` will fail
- Child sites cannot push risk data

**Required Fix:** Run migration:
```
lib/db/migrations/create-risk-aggregation-system.sql
```

---

## Blocking Issues

### Issue 1: Entries Missing tenant_id

**Severity:** HIGH  
**Impact:** All 52 existing entries invisible to tenant users  
**Resolution:** Run backfill query

### Issue 2: Risk Tables Not Created

**Severity:** HIGH  
**Impact:** Risk aggregation system non-functional  
**Resolution:** Apply migration

---

## Recommended Actions (In Order)

1. **Apply risk aggregation migration**
   ```bash
   # Review then apply via Supabase dashboard or psql
   cat lib/db/migrations/create-risk-aggregation-system.sql
   ```

2. **Backfill entries tenant_id**
   ```sql
   UPDATE entries e
   SET tenant_id = c.tenant_id
   FROM customers c
   WHERE e.customer_id = c.id
     AND e.tenant_id IS NULL;
   ```

3. **Verify backfill**
   ```sql
   SELECT COUNT(*) as fixed FROM entries WHERE tenant_id IS NOT NULL;
   ```

4. **Re-run smoke tests** after fixes

---

## What's Working

- Tenant routing (`/t/[slug]`)
- Tenant context and branding
- Customer login pages per tenant
- Admin authentication protection
- Key-in agent data scoping (code ready)
- Risk APIs (code ready, awaiting tables)

---

## Next Steps After Fixes

1. Test entry visibility for tenant users
2. Test risk ingest API with mock data
3. Configure DNS for `meetang.finlotto.com`
4. Upload child site logo via branding page
5. Production deployment
