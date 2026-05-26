# Agent Data Scope Audit Report

## Audit Date: 2026-05-26

## Summary

This audit verifies that agent users see only their own tenant/agent/downline data, and NEVER see parent platform or global data.

## Scope Functions Created

### `lib/data-scope.ts`

| Function | Purpose |
|----------|---------|
| `getDataScope(session)` | Get scope parameters from session |
| `requireTenantScope(scope)` | Throw if no tenant_id |
| `requireAgentScope(scope)` | Throw if no agent_id |
| `assertNoGlobalFallback(scope)` | Block global data access for agents |
| `applyTenantScope(query, scope)` | Add tenant_id filter |
| `applyAgentDownlineScope(query, scope)` | Add agent_id IN filter |
| `applyFullDataScope(query, scope)` | Combined tenant + agent filter |
| `isRecordAccessible(record, scope)` | Check single record access |
| `getEmptyStateMessage(scope, type)` | Get localized empty state message |
| `validateSessionForScope(session)` | Validate session has required fields |

### `lib/customer-scope.ts`

| Function | Purpose |
|----------|---------|
| `getCustomerScopeForUser(session)` | Get customer query scope |
| `applyCustomerScope(query, scope)` | Apply filters to customer query |
| `requireCustomerAccess(id, session)` | Check single customer access |
| `filterAccessibleCustomerIds(ids, session)` | Filter batch customer IDs |
| `getAgentDownlineIds(agentId)` | Get recursive downline |

## APIs Audited and Fixed

### Customer APIs

| API | Status | Fix Applied |
|-----|--------|-------------|
| `GET /api/customers` | FIXED | `applyFullDataScope` added |
| `GET /api/customers/[id]` | FIXED | `requireCustomerAccess` added |
| `PATCH /api/customers/[id]` | FIXED | `requireCustomerAccess` added |
| `DELETE /api/customers/[id]` | FIXED | `requireCustomerAccess` added |
| `GET /api/manual-key/customers` | FIXED | `applyFullDataScope` added |
| `POST /api/manual-key/customers` | FIXED | tenant_id set from session |
| `GET /api/network-members` | FIXED | `applyFullDataScope` added |

### Entry/Betting APIs

| API | Status | Fix Applied |
|-----|--------|-------------|
| `GET /api/entries` | FIXED | `applyFullDataScope` added |
| `POST /api/entries` | NEEDS REVIEW | Should set tenant_id from session |

### Transaction APIs

| API | Status | Fix Applied |
|-----|--------|-------------|
| `GET /api/transactions` | FIXED | `applyFullDataScope` added |
| `GET /api/credit-transactions` | FIXED | Customer-scoped filter |
| `GET /api/finance/transactions` | FIXED | `applyFullDataScope` on all sources |

## Session Requirements

For agent users, session MUST contain:

| Field | Required | Purpose |
|-------|----------|---------|
| `id` | YES | User ID |
| `role` | YES | User role |
| `user_type` | YES | User type (agent/admin/etc) |
| `tenant_id` | YES | Tenant isolation |
| `visible_menus` | NO | Structure permissions (menu access) |

If `tenant_id` is missing for agent user:
- Data queries are BLOCKED
- Impossible filter applied (`tenant_id = '__NO_ACCESS__'`)
- Empty results returned

## Verification Endpoint

Use `GET /api/debug/data-scope` to verify:

```json
{
  "dataScope": {
    "tenantId": "uuid",
    "agentId": "uuid",
    "downlineAgentIds": ["uuid1", "uuid2"],
    "downlineCount": 5
  },
  "visibleData": {
    "customers": 42,
    "entries": 128
  },
  "blockedData": {
    "customers": 1523,
    "entries": 8742
  },
  "security": {
    "globalFallbackBlocked": true,
    "tenantIsolationEnforced": true,
    "agentIsolationEnforced": true
  }
}
```

## Remaining Items

| Item | Priority | Notes |
|------|----------|-------|
| POST /api/entries | HIGH | Ensure tenant_id set from session |
| Report APIs | MEDIUM | Need scope audit |
| Betting history | MEDIUM | Need scope audit |
| Bank APIs | MEDIUM | Need scope audit |
