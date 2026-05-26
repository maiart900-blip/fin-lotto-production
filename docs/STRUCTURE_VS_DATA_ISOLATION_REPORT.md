# Structure vs Data Isolation Report

## Core Principle

**Agents inherit STRUCTURE only, NEVER DATA.**

| Category | What It Means | Inheritable? |
|----------|---------------|--------------|
| **STRUCTURE** | Menus, routes, feature flags, UI layout, permissions, labels | YES |
| **DATA** | Customers, entries, bets, transactions, wallets, ledgers, reports | **NEVER** |

## Implementation Constants

```typescript
// lib/data-scope.ts
export const INHERIT_STRUCTURE_ONLY = true;
export const NEVER_INHERIT_DATA = true;
```

## How It Works

### Structure Inheritance (Allowed)

1. **Parent Platform** grants menu visibility to agent via `visible_menus`
2. **Agent Session** receives `visible_menus` array at login
3. **Sidebar** shows menus based on `visible_menus` (structure only)
4. **Agent** can navigate to allowed pages

### Data Isolation (Enforced)

1. **Every API** applies `getDataScope(session)` to determine filters
2. **Queries** use `applyFullDataScope(query, scope)` to add WHERE clauses
3. **Agent** sees only data where:
   - `tenant_id = session.tenant_id`
   - `agent_id IN session.downline_agent_ids`
4. **Global/Parent data** is BLOCKED with impossible filter if scope missing

## Data Scope Hierarchy

| User Type | Tenant Scope | Agent Scope | Sees |
|-----------|--------------|-------------|------|
| Super Admin | None | None | All global data |
| Tenant Owner | tenant_id = X | None | All tenant X data |
| Agent | tenant_id = X | agent_id IN downline | Own/downline data only |
| Member/Staff | tenant_id = X | agent_id = assigned | Assigned agent data only |
| Customer | tenant_id = X | - | Own data only |

## Key Files

| File | Purpose |
|------|---------|
| `lib/data-scope.ts` | Centralized scope functions |
| `lib/customer-scope.ts` | Customer-specific scoping |
| `lib/agent-permissions.client.ts` | Menu constants (client-safe) |
| `lib/agent-permissions.ts` | Server-side permission resolver |

## APIs Fixed

| API | Scope Applied |
|-----|---------------|
| `/api/customers` | tenant_id + agent_id filter |
| `/api/customers/[id]` | Single record access check |
| `/api/entries` | tenant_id + agent_id filter |
| `/api/transactions` | tenant_id + agent_id filter |
| `/api/finance/transactions` | tenant_id + agent_id filter |
| `/api/credit-transactions` | Customer-scoped filter |
| `/api/network-members` | tenant_id + agent_id filter |
| `/api/manual-key/customers` | tenant_id + agent_id filter |

## Empty State Behavior

When agent has no scoped data:
- Show: "ยังไม่มีข้อมูลในสายงานของคุณ"
- Do NOT show parent data
- Do NOT fallback to global data

## Debug Verification

Use `/api/debug/data-scope` to verify:
- Session tenant_id and agent_id
- Downline agent IDs
- Visible vs blocked data counts
- Applied filter explanation
