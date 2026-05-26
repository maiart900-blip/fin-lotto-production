# Effective Permission Matrix

## Date: 2026-05-26

## Permission Resolution Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    Permission Hierarchy                      │
├─────────────────────────────────────────────────────────────┤
│ 1. User Role (super_admin > admin > agent > member)         │
│    ↓                                                         │
│ 2. Tenant Mode (auto_only | manual_key_only | hybrid)       │
│    ↓                                                         │
│ 3. Package Features/Limits (from tenants.package)           │
│    ↓                                                         │
│ 4. Agent Settings (enable_manual_key, enable_auto)          │
│    ↓                                                         │
│ 5. Agent Permissions (agent_permissions table)              │
│    ↓                                                         │
│ 6. User Permissions (menu_permissions table)                │
└─────────────────────────────────────────────────────────────┘
```

## Permission Matrix by Role

### Super Admin
| Permission | Value | Source |
|------------|-------|--------|
| See all menus | Yes | Role |
| Manage all tenants | Yes | Role |
| Access financial hub | Yes | Role |
| Access security | Yes | Role |
| Override permissions | Yes | Role |

### Admin
| Permission | Value | Source |
|------------|-------|--------|
| See admin menus | Yes | Role |
| Manage users | Yes | Role |
| Access financial | Yes | Role |
| Access super admin | No | Blocked |
| Branch-scoped data | Yes | branch_id |

### Agent
| Permission | Value | Source |
|------------|-------|--------|
| See agent menus | Yes | Role |
| Manual key access | Conditional | enable_manual_key + tenant_mode |
| Auto system access | Conditional | enable_auto + tenant_mode |
| See platform menus | No | Blocked |
| Tenant-scoped data | Yes | tenant_id |
| Downline data only | Yes | agent_id |

### Member (Staff)
| Permission | Value | Source |
|------------|-------|--------|
| See staff menus | Yes | memberVisible flag |
| See operations | Yes | staffVisible flag |
| See financial | Limited | Based on visible_menus |
| See admin menus | No | Blocked |

## Feature Flag Matrix

| Feature | Super Admin | Admin | Agent | Member |
|---------|-------------|-------|-------|--------|
| manual_key | Yes | Yes | Conditional | No |
| auto_system | Yes | Yes | Conditional | No |
| create_sub_agent | Yes | Yes | Conditional | No |
| view_reports | Yes | Yes | Yes | Conditional |
| approve_transactions | Yes | Yes | Conditional | No |
| manage_members | Yes | Yes | Conditional | No |
| manage_finances | Yes | Yes | Conditional | No |
| access_vip | Yes | Conditional | No | No |

## Tenant Mode Impact on Agent Features

| Tenant Mode | Manual Key | Auto System | Notes |
|-------------|------------|-------------|-------|
| auto_only | Blocked | Enabled | Only auto betting |
| manual_key_only | Enabled | Blocked | Only manual key |
| hybrid | Both | Both | All features |
| both | Both | Both | Same as hybrid |

## Menu Access Decision Tree

```
Is user Super Admin?
├─ Yes → Allow all menus
└─ No → Is user Admin?
    ├─ Yes → Allow all except super_admin
    └─ No → Is user Agent?
        ├─ Yes → Check agent permissions
        │   ├─ Is menu platform-only? → Deny
        │   ├─ Is manual key menu?
        │   │   ├─ enable_manual_key: true AND tenant_mode allows → Allow
        │   │   └─ Otherwise → Deny
        │   ├─ Is auto system menu?
        │   │   ├─ enable_auto: true AND tenant_mode allows → Allow
        │   │   └─ Otherwise → Deny
        │   ├─ In visible_menus? → Allow
        │   └─ In AGENT_DEFAULT_MENUS? → Allow
        └─ No → Is user Member/Staff?
            ├─ Yes → Check memberVisible/staffVisible flags
            └─ No → Customer (fixed UI)
```

## API Authorization

All API routes should check permissions using:

```typescript
import { resolveAgentPermissions } from '@/lib/agent-permissions';

// In API route
if (session.user_type === 'agent') {
  const perms = await resolveAgentPermissions(session.id);
  
  // Check specific permission
  if (!perms.can_key_lottery) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 });
  }
  
  // Check menu access
  if (!perms.effective_menus.includes('manual-key')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
}
```

## Debug Endpoint

```
GET /api/debug/effective-permissions
```

Response:
```json
{
  "success": true,
  "effective_permissions": {
    "user_id": "xxx",
    "user_type": "agent",
    "tenant_id": "xxx",
    "agent_id": "xxx",
    "tenant_mode": "hybrid",
    "enabled_features": ["manual_key", "view_reports"],
    "visible_menus": ["dashboard", "manual-key", ...],
    "blocked_menus": ["super-admin", "financial-hub", ...],
    "allowed_routes": ["/", "/manual-key", ...],
    "denied_routes": [
      { "route": "/users", "reason": "Platform-only menu" },
      { "route": "/auto-system", "reason": "Auto system disabled" }
    ]
  }
}
```

## Status

**COMPLETE** - Permission matrix documented and implemented.
