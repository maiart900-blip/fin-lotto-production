# Site Management System (Tenant Management)

## Overview

ระบบจัดการเว็บลูก (Tenant Management) แบบครบวงจร สำหรับ Super Admin

## Database Tables

### Core Tables

| Table | Purpose |
|-------|---------|
| `tenants` | ข้อมูลหลักของเว็บลูก (enhanced with new columns) |
| `tenant_subscriptions` | Subscription/Package ของแต่ละ Tenant |
| `tenant_feature_flags` | Feature flags per tenant |
| `tenant_addons` | Add-ons ที่ Tenant ซื้อเพิ่ม |

### Audit & Tracking

| Table | Purpose |
|-------|---------|
| `tenant_activity_logs` | Audit log ทุก action |
| `subscription_events` | Events ของ subscription |
| `trial_extensions` | ประวัติการขยาย trial |
| `tenant_health` | Health metrics ของ tenant |

### New Tenant Columns

```
status: 'active' | 'trial' | 'suspended' | 'cancelled'
wallet_frozen: boolean
settlement_frozen: boolean
max_daily_payout: numeric
max_single_payout: numeric
max_exposure: numeric
max_customers: integer
max_agents: integer
max_daily_bets: integer
plan: text (starter, basic, pro, enterprise, unlimited)
billing_email: text
contact_phone: text
trial_ends_at: timestamptz
subscription_ends_at: timestamptz
```

## Components

### TenantEditDialog

Full-featured tenant editor with 7 tabs:

1. **ข้อมูลทั่วไป** - Basic info, domain, contact
2. **แพ็กเกจ** - Package/subscription management
3. **Revenue Share** - Custom revenue share rates
4. **ลิมิต** - Resource limits
5. **Feature Flags** - Feature on/off toggles
6. **Provider** - Enabled game providers
7. **Audit Log** - Activity history

### TenantDetailDashboard

Read-only dashboard showing:
- Tenant status and health
- Revenue metrics
- Subscription info
- Quick stats

## API Endpoints

### `/api/tenants/[id]`

- `GET` - Get tenant details
- `PUT` - Update tenant (basic info, limits)
- `DELETE` - Soft delete tenant

### `/api/tenants/[id]/manage`

Full management endpoint:

```typescript
// Actions:
'change-subscription'    // Change package
'set-revenue-share'      // Set custom revenue share
'toggle-feature'         // Toggle feature flag
'update-limits'          // Update resource limits
'toggle-provider'        // Enable/disable provider
'extend-trial'           // Extend trial period
'freeze-wallet'          // Freeze/unfreeze wallet
'freeze-settlement'      // Freeze/unfreeze settlement
'suspend-tenant'         // Suspend tenant
'reactivate-tenant'      // Reactivate tenant
'get-activity-logs'      // Get audit logs
```

## Usage Example

```tsx
import { TenantEditDialog, TenantDetailDashboard } from '@/components/tenant';

// Edit Dialog
<TenantEditDialog
  tenantId="uuid-here"
  open={isOpen}
  onOpenChange={setIsOpen}
  onSaved={() => refetch()}
/>

// Detail Dashboard
<TenantDetailDashboard
  tenantId="uuid-here"
  open={isOpen}
  onOpenChange={setIsOpen}
  onEdit={() => openEditDialog()}
/>
```

## Activity Log Actions

All changes are logged with:
- `action`: What was done
- `actor_type`: Who did it (super_admin, tenant_admin, system, api)
- `actor_id`: User ID
- `details`: JSON with old/new values
- `ip_address`: Request IP
- `created_at`: Timestamp

### Logged Actions

- `tenant_updated` - Basic info changed
- `subscription_changed` - Package changed
- `revenue_share_set` - Revenue share modified
- `limits_updated` - Resource limits changed
- `feature_toggled` - Feature flag changed
- `provider_toggled` - Provider enabled/disabled
- `trial_extended` - Trial period extended
- `wallet_frozen` / `wallet_unfrozen`
- `settlement_frozen` / `settlement_unfrozen`
- `tenant_suspended` / `tenant_reactivated`
