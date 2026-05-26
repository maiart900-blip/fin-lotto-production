# Tenant Agent Scope Verification Report

## Date: 2026-05-26

## Objective

Verify that agent users can only access data within their tenant scope and cannot see parent platform or other tenant data.

## Scope Boundaries

### Agent Data Access Rules

| Data Type | Access Scope | Query Filter |
|-----------|--------------|--------------|
| Customers | Own downline only | `agent_id = session.agent_id OR upline_id = session.agent_id` |
| Entries | Own downline entries | `agent_id = session.agent_id` |
| Transactions | Own transactions | `agent_id = session.agent_id` |
| Commission | Own commission | `agent_id = session.agent_id` |
| Reports | Own downline data | `agent_id = session.agent_id` |
| Manual Key Slips | Own slips | `created_by_agent_id = session.agent_id` |

### Tenant Data Access Rules

| Data Type | Access Scope | Query Filter |
|-----------|--------------|--------------|
| Lotteries | Tenant's lotteries | `tenant_id = session.tenant_id` |
| Rates | Tenant's rates | `tenant_id = session.tenant_id` |
| Settings | Tenant settings | `tenant_id = session.tenant_id` |
| Results | Public (all) | No filter |

### Blocked Data (Agent CANNOT Access)

| Data Type | Reason |
|-----------|--------|
| Other agents' downlines | Different agent_id |
| Other tenants' data | Different tenant_id |
| Platform-level data | No tenant_id (platform owns) |
| Financial hub data | Platform-only |
| User management | Platform-only |
| System settings | Platform-only |

## Session Data Structure

```typescript
interface AgentSession {
  id: string;                    // Agent's UUID
  user_type: 'agent';
  role: 'agent' | 'agent_key' | 'partner';
  source_table: 'agents';
  tenant_id: string | null;      // Tenant scope
  agent_id: string;              // Same as id for agents
  system_type: 'auto' | 'manual_key' | 'both';
  enable_manual_key: boolean;
  enable_auto: boolean;
  visible_menus: string[];
  tenant_mode: 'auto_only' | 'manual_key_only' | 'hybrid';
}
```

## API Route Protection Checklist

### Protected Routes (require tenant scope)

| Route | Protection Status | Notes |
|-------|-------------------|-------|
| /api/customers | Scoped | Filters by agent_id |
| /api/entries | Scoped | Filters by agent_id |
| /api/manual-key/* | Scoped | Filters by agent_id |
| /api/agent/* | Scoped | Filters by agent_id |
| /api/reports/* | Scoped | Filters by agent_id |

### Blocked Routes (agents cannot access)

| Route | Protection Status |
|-------|-------------------|
| /api/admin/* | Blocked by role check |
| /api/users/* | Blocked by role check |
| /api/tenants/* | Blocked by role check |
| /api/financial-hub/* | Blocked by role check |
| /api/system/* | Blocked by role check |

## Query Patterns for Agent Data

### Correct Pattern (Scoped)

```typescript
// In API route for agent
const { data } = await supabase
  .from('customers')
  .select('*')
  .or(`agent_id.eq.${session.agent_id},upline_id.eq.${session.agent_id}`)
  .limit(100);
```

### Incorrect Pattern (Data Leak Risk)

```typescript
// WRONG - No scope filtering
const { data } = await supabase
  .from('customers')
  .select('*')
  .limit(100);
```

## Verification Tests

### Test 1: Agent Cannot See Other Agent's Customers
- **Input**: Agent A requests /api/customers
- **Expected**: Only customers where agent_id = Agent A's ID
- **Status**: ✅ Verified

### Test 2: Agent Cannot See Platform Financials
- **Input**: Agent requests /api/financial-hub/summary
- **Expected**: 403 Forbidden
- **Status**: ✅ Verified (route blocked)

### Test 3: Agent Cannot See Other Tenant Data
- **Input**: Agent from Tenant A requests data
- **Expected**: Only data where tenant_id = Tenant A's ID
- **Status**: ✅ Verified

### Test 4: Agent Session Contains Tenant ID
- **Input**: Agent logs in
- **Expected**: Session includes tenant_id
- **Status**: ✅ Verified (added in login route)

## Session Token Verification

After login, agent session cookie contains:

```json
{
  "id": "agent-uuid",
  "role": "agent",
  "user_type": "agent",
  "source_table": "agents",
  "tenant_id": "tenant-uuid",
  "tenant_mode": "hybrid",
  "enable_manual_key": true,
  "enable_auto": false
}
```

## Middleware Checks

The session is verified in:
1. `/lib/supabase/middleware.ts` - Sets session cookies
2. `/lib/api-auth.ts` - Validates API requests
3. `/app/api/*/route.ts` - Individual route guards

## Recommendations

1. **Always include tenant_id filter** when querying tenant-scoped data
2. **Always include agent_id filter** when querying agent-specific data
3. **Use RLS policies** in Supabase for additional protection
4. **Audit logs** should track agent data access

## Status

**VERIFIED** - Agent data is properly scoped to their tenant and downline. Platform data is blocked.
