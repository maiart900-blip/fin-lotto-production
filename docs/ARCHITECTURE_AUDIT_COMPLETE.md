# FIN LOTTO Architecture Audit - Complete

## Executive Summary

The codebase already has substantial multi-tenant infrastructure. This audit identifies what exists, what was added, and what gaps remain.

---

## 1. Existing Infrastructure (Already Built)

### Database Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `tenants` | Multi-tenant configuration | EXISTS - 2 tenants active |
| `sites` | Site management with api_key | EXISTS |
| `customers` | Customer records with tenant_id, agent_id | EXISTS |
| `entries` | Betting slips with tenant_id, agent_id | EXISTS |
| `agents` | Agent hierarchy with parent_agent_id | EXISTS |

### Existing Tenants

| Name | Slug | Domain | Type |
|------|------|--------|------|
| FIN LOTTO Master | `master` | finlotto.com | Main Platform |
| มีตังค์หวยจ๋า | `meetang-huayja` | meetang.finlotto.com | Child Auto Site |

### Existing Code Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| Tenant Context | `lib/tenant-context.tsx` | React context for tenant data |
| Tenant Layout | `app/t/[slug]/layout.tsx` | Dynamic tenant routing |
| Tenant API | `app/api/tenant/[slug]/route.ts` | Tenant data endpoint |
| Sites API | `app/api/sites/route.ts` | Site management |
| Domain Settings | `app/(main)/domain-settings/page.tsx` | Domain configuration UI |
| Site Branding | `app/(main)/site-manager/branding/page.tsx` | Branding configuration UI |
| Middleware | `middleware.ts` | Domain/subdomain routing |

---

## 2. New Infrastructure (Added in This Work)

### Key-in Agent Data Scoping

| File | Purpose |
|------|---------|
| `lib/customer-scope.ts` | Customer access filtering by agent hierarchy |
| `lib/data-scope.ts` | Generic data scope utilities |
| `lib/agent-permissions.ts` | Agent permission resolution |
| `lib/agent-permissions.client.ts` | Client-safe permission constants |

### Risk Aggregation System

| File | Purpose |
|------|---------|
| `lib/db/migrations/create-risk-aggregation-system.sql` | Tables: risk_aggregations, risk_settings, site_api_keys |
| `lib/site-api-auth.ts` | API key generation and validation |
| `app/api/risk/ingest/route.ts` | Child sites push aggregated risk data |
| `app/api/risk/dashboard/route.ts` | Risk dashboard summary |
| `app/api/risk/by-number/route.ts` | Exposure lookup per number |
| `app/api/risk/top-exposure/route.ts` | Highest risk numbers ranked |
| `app/api/risk/optimal-outcome/route.ts` | Best/worst winning analysis |
| `app/api/cron/aggregate-keyin-risk/route.ts` | Aggregate key-in entries |
| `app/api/admin/site-api-keys/route.ts` | Manage child site API keys |

### Simplified Index Migration

| File | Purpose |
|------|---------|
| `lib/db/migrations/production-scope-indexes.sql` | Indexes for existing columns only |

---

## 3. Architecture Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FIN LOTTO MAIN (finlotto.com)                        │
│  Database: Current Supabase instance                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ Key-in Agents   │  │ Risk Dashboard  │  │ Risk Aggregations API   │  │
│  │ (Scoped data)   │  │ (Super admin)   │  │ (Receives child data)   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                   ▲
                    Aggregated risk data via API
                                   │
┌──────────────────────────────────┴──────────────────────────────────────┐
│              Child Auto Site (meetang.finlotto.com)                     │
│  Currently: Same DB with tenant_id filter                               │
│  Future: Could be separate DB pushing via /api/risk/ingest              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ Own Customers   │  │ Own Slips       │  │ Own Branding            │  │
│  │ (tenant_id)     │  │ (tenant_id)     │  │ (tenants table)         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Current vs Future Architecture

### Current State (Option B - Same DB)
- Child auto sites use same database
- Data isolated by `tenant_id` column
- Works for current scale

### Future State (Option A - Separate DBs)
- Child auto sites have own databases
- Push aggregated risk via `/api/risk/ingest`
- Better isolation, scalability
- Migration path: New sites use separate DBs, existing sites stay on shared DB

---

## 5. Data Scoping Summary

### Key-in Agents (IMPLEMENTED)

| Data Type | Scope Method | Status |
|-----------|--------------|--------|
| Customers | `agent_id IN downline OR agent_id IS NULL` | DONE |
| Entries | `agent_id IN downline` | DONE |
| Credit transactions | Via customer JOIN | DONE |
| Network members | `parent_agent_id` hierarchy | DONE |

### Child Auto Sites (EXISTING)

| Data Type | Scope Method | Status |
|-----------|--------------|--------|
| All data | `tenant_id = current_tenant` | EXISTS |

### Main Platform (SUPER ADMIN)

| Data Type | Access | Status |
|-----------|--------|--------|
| Risk aggregations | Full access | NEW |
| Raw slips from child sites | Aggregated only (not raw) | BY DESIGN |
| Key-in agent data | Full access | EXISTS |

---

## 6. Gaps Identified

### Minor Gaps (Not Blocking)

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| `tenants.logo_url` is NULL | No custom logos | Add in branding settings UI |
| No `primary_color` column | Default theme used | Add via migration if needed |
| `sites.api_key` may be empty | Child site auth | Generate via `/api/admin/site-api-keys` |

### No Critical Gaps

The architecture is functional for:
- Multi-tenant isolation (existing)
- Key-in agent data scoping (new)
- Risk aggregation from child sites (new)
- Branding per tenant (existing, needs data)

---

## 7. Migration Checklist

### Required Migrations

1. **production-scope-indexes.sql** - Performance indexes for existing columns
2. **create-risk-aggregation-system.sql** - Risk tables (only if risk dashboard needed)

### Not Required

- ~~add-scope-columns.sql~~ - DELETED (columns already exist or not needed)

---

## 8. Deployment Recommendation

### Phase 1: Deploy Key-in Scoping (Safe)
- All scope changes are additive (restrict access)
- No database migration required
- Backward compatible

### Phase 2: Deploy Risk Aggregation (When Ready)
- Run `create-risk-aggregation-system.sql`
- Configure cron job for key-in aggregation
- Generate API keys for child sites

### Phase 3: Run Index Migration (Performance)
- Run `production-scope-indexes.sql` during low traffic
- Uses CONCURRENTLY - no table locks

---

## 9. Build Status

**PASS** - All code compiles successfully

---

## 10. Final Notes

The FIN LOTTO codebase already has robust multi-tenant infrastructure. This work added:

1. **Key-in agent data isolation** - Agents see only their customers/downline
2. **Risk aggregation system** - Central risk dashboard for all sources
3. **Child site API authentication** - Secure data push from child sites

The architecture supports both current (same DB) and future (separate DB) deployment models for child auto sites.
