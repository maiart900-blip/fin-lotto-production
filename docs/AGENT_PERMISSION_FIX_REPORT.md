# Agent Permission Fix Report

## Date: 2026-05-26

## Summary

Fixed agent tenant permission propagation and sidebar access issues. Agent users now see only their authorized menus based on tenant permissions, system type, and feature flags.

## Issues Addressed

### 1. Platform Menu Leakage
- **Problem**: Agents were seeing platform-only menus (financial hub, master control, tenant manager)
- **Solution**: Created `PLATFORM_ONLY_MENUS` constant with all platform-restricted routes; sidebar now filters these for all agent users

### 2. Manual Key Menus Not Showing
- **Problem**: Agents with `enable_manual_key: true` couldn't see manual key pages
- **Solution**: Added `MANUAL_KEY_MENUS` constant; sidebar now shows these when `enable_manual_key !== false` AND tenant_mode allows it

### 3. Missing Tenant Context in Session
- **Problem**: Session didn't include `tenant_id`, `tenant_mode`, or `feature_flags`
- **Solution**: Updated login route to fetch tenant data and include in session:
  - `tenant_id`: Agent's tenant
  - `tenant_mode`: 'auto_only' | 'manual_key_only' | 'hybrid' | 'both'
  - `feature_flags`: Array of enabled tenant features

### 4. Inconsistent Permission Checks
- **Problem**: Sidebar, API routes, and pages used different permission logic
- **Solution**: Created centralized permission resolver:
  - `lib/agent-permissions.ts` - Server-side resolver
  - `lib/agent-permissions.client.ts` - Client-side constants and helpers

## Files Modified

| File | Changes |
|------|---------|
| `lib/agent-permissions.ts` | Server-side permission resolver |
| `lib/agent-permissions.client.ts` | Client-safe constants and helpers |
| `components/layout/app-sidebar.tsx` | Updated to use agent permission filtering |
| `app/api/auth/login/route.ts` | Added tenant context to session |
| `hooks/use-auth.ts` | Extended SessionUser interface |
| `app/api/debug/effective-permissions/route.ts` | New debug endpoint |

## Menu Constants Created

### PLATFORM_ONLY_MENUS (Blocked for Agents)
- /super-admin, /master-control, /tenant-manager, /site-manager
- /multi-tenant, /financial-hub, /enterprise-summary
- /security-dashboard, /backup, /health-check, /audit-logs
- /users, /roles-permissions, /settings/system
- /payment-gateway, /scb-maemanee, /sub-sites

### MANUAL_KEY_MENUS (Shown when enabled)
- /manual-key, /admin/key, /manual-key/entries
- /manual-key/customers, /manual-key/rates
- /manual-downline, /manual-key-agents
- /prize-payout

### AUTO_SYSTEM_MENUS (Shown when enabled)
- /auto-system, /auto-system/entries
- /auto-system/customers, /auto-marketing

### AGENT_DEFAULT_MENUS (Always visible)
- Dashboard, Results, Reports, Profit/Loss
- Agent finance (commission, withdraw, summary)
- Downline members

## Permission Resolution Order

1. Check if user is agent (role = 'agent' | 'agent_key' | 'partner')
2. Block all PLATFORM_ONLY_MENUS
3. Check tenant_mode for feature availability
4. Check agent.enable_manual_key for manual key menus
5. Check agent.enable_auto for auto system menus
6. Apply visible_menus from agent_permissions table
7. Apply hidden_menus restrictions

## Verification

Debug endpoint available at:
```
GET /api/debug/effective-permissions
```

Returns complete permission matrix including:
- user_type, tenant_id, agent_id
- tenant_mode, enabled_features
- visible_menus, blocked_menus
- allowed_routes, denied_routes with reasons

## Build Status

**PASSED** - All 254K+ lines compile without errors.
