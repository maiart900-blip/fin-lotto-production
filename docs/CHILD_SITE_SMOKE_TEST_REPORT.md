# Child Site Smoke Test Report

## Date: Smoke Test Performed

---

## 1. Domain Routing Status

| Test | Status | Notes |
|------|--------|-------|
| `meetang.finlotto.com` (production domain) | **NOT CONFIGURED** | DNS not resolving - needs Vercel domain setup |
| `/t/meetang-huayja` (slug routing) | **WORKING** | Tenant slug routing functional |

---

## 2. Database State Summary

### Tenants
| ID | Name | Slug | Domain | Status |
|----|------|------|--------|--------|
| `8d46ff2a-...` | FIN LOTTO Master | `master` | `finlotto.com` | active |
| `f2c0e0d0-...` | มีตังค์หวยจ๋า | `meetang-huayja` | `meetang.finlotto.com` | active |

### Customers by Tenant
| Tenant | Customer Count | Agent Assignment |
|--------|----------------|------------------|
| FIN LOTTO Master | 7 customers | **ALL have agent_id = NULL** |
| มีตังค์หวยจ๋า | 0 customers | No customers yet |

### Entries by Tenant
| tenant_id | Entry Count | Status |
|-----------|-------------|--------|
| **NULL** | ALL entries | **CRITICAL: No tenant assigned** |

---

## 3. Critical Findings

### ISSUE #1: Entries Not Tenant-Scoped
**Severity: CRITICAL**

All entries in the database have `tenant_id = NULL`. This means:
- Tenant users will see ZERO entries (scope filter excludes NULL)
- Super admin can see all entries (no scope applied)
- Historical data needs backfill migration

**Recommended Fix:**
```sql
-- Backfill entries tenant_id from customer relationship
UPDATE entries e
SET tenant_id = c.tenant_id
FROM customers c
WHERE e.customer_id = c.id
  AND e.tenant_id IS NULL
  AND c.tenant_id IS NOT NULL;

-- For entries without customer (orphan entries), assign to master tenant
UPDATE entries
SET tenant_id = '8d46ff2a-...'  -- FIN LOTTO Master ID
WHERE tenant_id IS NULL;
```

### ISSUE #2: Customers Not Agent-Assigned
**Severity: MEDIUM**

All 7 customers have `agent_id = NULL`. This is handled by the updated scope logic that allows agents to see unassigned customers in their tenant.

**Status: MITIGATED** - Scope logic updated to include `agent_id IS NULL`

### ISSUE #3: Child Site Domain Not Configured
**Severity: LOW**

`meetang.finlotto.com` domain is not resolving.

**Recommended Fix:**
1. Add domain in Vercel project settings
2. Configure DNS CNAME record pointing to Vercel

---

## 4. API Scope Test Results

### Customer Scope (lib/customer-scope.ts)
| User Type | Expected Behavior | Status |
|-----------|-------------------|--------|
| Super Admin | See all customers | **WORKING** |
| Tenant Owner | See own tenant customers | **WORKING** |
| Agent | See assigned + unassigned in tenant | **WORKING** |

### Entry Scope (lib/data-scope.ts)
| User Type | Expected Behavior | Status |
|-----------|-------------------|--------|
| Super Admin | See all entries | **WORKING** |
| Tenant Owner | See own tenant entries | **BLOCKED** (all entries have NULL tenant_id) |
| Agent | See assigned + unassigned in tenant | **BLOCKED** (all entries have NULL tenant_id) |

---

## 5. Branding Verification

### FIN LOTTO Master
- Logo: Set in tenant record
- Domain: finlotto.com
- Theme: Default

### มีตังค์หวยจ๋า (Child Site)
- Logo: **NOT SET** (logo_url = NULL)
- Domain: meetang.finlotto.com (DNS pending)
- Theme: Inherits default

**Recommendation:** Upload logo for child site via Site Manager > Branding

---

## 6. Risk Aggregation System

| Component | Status |
|-----------|--------|
| `risk_aggregations` table | **NOT CREATED** (migration pending) |
| `/api/risk/ingest` API | **CODE READY** (needs table) |
| `/api/risk/dashboard` API | **CODE READY** (needs table) |
| `/api/cron/aggregate-keyin-risk` | **CODE READY** (needs table) |

**Required Action:** Run `create-risk-aggregation-system.sql` migration

---

## 7. Required Actions Before Production

### Priority 1: Data Migration
```sql
-- 1. Backfill entries.tenant_id from customers
UPDATE entries e
SET tenant_id = c.tenant_id
FROM customers c
WHERE e.customer_id = c.id
  AND e.tenant_id IS NULL;

-- 2. Assign orphan entries to master tenant
UPDATE entries
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'master')
WHERE tenant_id IS NULL;
```

### Priority 2: Run Schema Migrations
1. `production-scope-indexes.sql` - Indexes for scope queries
2. `create-risk-aggregation-system.sql` - Risk tables and APIs

### Priority 3: Domain Configuration
1. Add `meetang.finlotto.com` to Vercel project
2. Configure DNS CNAME record

### Priority 4: Branding Setup
1. Upload logo for child site
2. Configure theme colors if different from main

---

## 8. Test Scenarios for QA

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Child site login | Go to `/t/meetang-huayja/login` | Shows child site branding |
| Tenant data isolation | Login as child site user, view customers | See only child site customers |
| Agent data isolation | Login as agent, view customers | See only assigned + unassigned in tenant |
| Super admin access | Login as super_admin, view all | See all data across tenants |
| Risk dashboard | Super admin views `/admin/risk-dashboard` | Shows aggregated risk (after migration) |

---

## Summary

| Category | Status |
|----------|--------|
| Tenant Routing | **WORKING** (slug), **PENDING** (domain) |
| Customer Scope | **WORKING** |
| Entry Scope | **BLOCKED** - needs data backfill |
| Agent Scope | **WORKING** (with NULL handling) |
| Risk System | **PENDING** - needs migration |
| Child Site Branding | **PARTIAL** - needs logo upload |

**Overall: NEEDS DATA MIGRATION BEFORE FULL DEPLOYMENT**
