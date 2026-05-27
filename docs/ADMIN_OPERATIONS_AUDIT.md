# Admin Operations Audit - FIN LOTTO Platform

## Overview

This document provides a complete audit of admin operations for managing child auto websites on the FIN LOTTO platform.

---

## 1. Where to Edit Child Site Settings

### Primary UI: Tenant Manager

**Location:** `/tenant-manager`

**Features:**
- List all tenants (master + child sites)
- Create new child sites
- Edit existing site settings
- Delete/deactivate sites

**Edit Dialog Fields:**
| Field | Type | Purpose |
|-------|------|---------|
| `name` | text | Site display name |
| `slug` | text | URL slug (e.g., `meetang-huayja`) |
| `domain` | text | Custom domain (e.g., `meetang.finlotto.com`) |
| `logo_url` | text | Logo image URL |
| `status` | select | active/inactive |
| `owner_id` | select | Site owner user |

### Secondary UI: Site Branding

**Location:** `/site-manager/branding`

**Features:**
- Visual branding preview
- Logo upload
- Theme color configuration
- Real-time preview

---

## 2. Where to Upload/Change Logos

### Method 1: Tenant Edit Dialog

1. Navigate to `/tenant-manager`
2. Click edit icon on tenant row
3. Enter `logo_url` field (direct URL to image)
4. Save changes

### Method 2: Branding Page (Recommended)

1. Navigate to `/site-manager/branding`
2. Use logo upload component
3. Preview changes before saving
4. Supports drag-and-drop

### API Endpoint

```
PUT /api/tenants/{tenant_id}
Body: { "logo_url": "https://..." }
```

### Database Field

```sql
-- tenants.logo_url (text, nullable)
UPDATE tenants SET logo_url = 'https://...' WHERE id = '...';
```

---

## 3. Child Site Dashboard Routes

### Customer Portal Routes (Child Site)

| Route | Purpose | Layout |
|-------|---------|--------|
| `/t/{slug}` | Child site home | Tenant layout |
| `/t/{slug}/customer/login` | Customer login | Auth layout |
| `/t/{slug}/customer/register` | Customer registration | Auth layout |
| `/t/{slug}/customer/dashboard` | Customer dashboard | Customer layout |
| `/t/{slug}/bet` | Place bets (แทงหวย) | Customer layout |
| `/t/{slug}/deposit` | Deposit funds (ฝากเงิน) | Customer layout |
| `/t/{slug}/withdraw` | Withdraw funds (ถอนเงิน) | Customer layout |
| `/t/{slug}/history` | Bet history (ประวัติ) | Customer layout |
| `/t/{slug}/profile` | Customer profile | Customer layout |

### Admin Routes (FIN LOTTO Master Only)

| Route | Purpose | Access |
|-------|---------|--------|
| `/admin` | Admin dashboard | Super admin |
| `/tenant-manager` | Manage child sites | Super admin |
| `/site-manager/branding` | Branding settings | Tenant admin |
| `/domain-settings` | Domain configuration | Super admin |
| `/risk-dashboard` | Risk analysis | Super admin |

---

## 4. Which Pages Are Scoped to Tenant

### Tenant-Scoped Pages (Show Only That Tenant's Data)

| Page | Scoping Logic |
|------|---------------|
| `/t/{slug}/*` | All child site pages - tenant from URL slug |
| Customer dashboard | `tenant_id` from session |
| Bet history | `entries.tenant_id = session.tenant_id` |
| Deposits/Withdrawals | `transactions.tenant_id = session.tenant_id` |

### Global Pages (Super Admin - See All Data)

| Page | Access Level |
|------|--------------|
| `/admin/*` | Super admin only |
| `/tenant-manager` | Super admin only |
| `/risk-dashboard` | Super admin only (aggregated from all sources) |

### Scoping Implementation

**Files:**
- `lib/customer-scope.ts` - Customer data scoping
- `lib/data-scope.ts` - General data scoping
- `lib/tenant-context.tsx` - Tenant context provider

**Key Logic:**
```typescript
// Customer scope applies tenant_id filter
if (scope.tenantId) {
  query = query.eq('tenant_id', scope.tenantId);
}

// Agent scope applies agent_id filter for key-in
if (scope.isAgent) {
  query = query.or(`agent_id.in.(${agentIds}),agent_id.is.null`);
}
```

---

## 5. Summary Table

| Feature | Location | Status |
|---------|----------|--------|
| Create child site | `/tenant-manager` | WORKING |
| Edit child site | `/tenant-manager` (edit dialog) | WORKING |
| Upload logo | `/site-manager/branding` | WORKING |
| Change logo URL | `/tenant-manager` edit | WORKING |
| Set domain | `/tenant-manager` edit | WORKING |
| Set theme colors | `/site-manager/branding` | WORKING |
| View child site | `/t/{slug}` | WORKING |
| Customer login | `/t/{slug}/customer/login` | WORKING |
| Place bets | `/t/{slug}/bet` | WORKING |
| Tenant scoping | All customer pages | WORKING |
| Risk dashboard | `/risk-dashboard` | READY (tables created) |

---

## 6. Database Schema (Tenants Table)

```sql
tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,           -- "มีตังค์หวยจ๋า"
  slug TEXT NOT NULL UNIQUE,    -- "meetang-huayja"
  domain TEXT,                  -- "meetang.finlotto.com"
  logo_url TEXT,                -- Logo image URL
  theme_config JSONB,           -- Theme colors/settings
  owner_id UUID,                -- Site owner
  is_active BOOLEAN,
  is_master BOOLEAN,            -- true for FIN LOTTO Master
  status TEXT,                  -- "active", "inactive"
  plan TEXT,                    -- Subscription plan
  max_customers INTEGER,
  max_agents INTEGER,
  max_daily_bets INTEGER,
  max_exposure NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

---

## 7. Current Child Sites

| Name | Slug | Domain | Status |
|------|------|--------|--------|
| FIN LOTTO Master | `master` | `finlotto.com` | active |
| มีตังค์หวยจ๋า | `meetang-huayja` | `meetang.finlotto.com` | active |

---

## 8. How to Add a New Child Site

1. **Navigate to Tenant Manager:** `/tenant-manager`
2. **Click "Add Tenant"**
3. **Fill in details:**
   - Name: Site display name (e.g., "เว็บหวยใหม่")
   - Slug: URL identifier (e.g., "new-lottery")
   - Domain: Custom domain (optional)
   - Owner: Assign owner user
4. **Save** - Site is created
5. **Configure branding:** Go to `/site-manager/branding`
6. **Upload logo and set colors**
7. **Configure DNS** (if using custom domain)

---

## 9. Risk System Integration

Child sites can push aggregated risk data to FIN LOTTO via:

**API Endpoint:** `POST /api/risk/ingest`

**Authentication:** Site API key from `site_api_keys` table

**Manage API Keys:** `/api/admin/site-api-keys` (Super admin)

---

## Document Version

- **Created:** May 27, 2026
- **Status:** Production Ready
- **All smoke tests:** PASS
