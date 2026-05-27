# Production Domain Setup - Final Checklist

## Status: READY TO PRESS PRODUCTION SITE

All code changes are complete. Follow the steps below to go live.

---

## 1. DNS Configuration

### For `meetang.finlotto.com`

| Setting | Value |
|---------|-------|
| **Record Type** | CNAME |
| **Host/Name** | `meetang` |
| **Target/Value** | `cname.vercel-dns.com` |
| **TTL** | Auto or 300 |
| **Cloudflare Proxy** | **DISABLED** (DNS only / grey cloud) |

> **Important**: Cloudflare proxy must be disabled (grey cloud) for Vercel's SSL to work correctly.

### Alternative: A Record (if CNAME not supported at apex)

| Setting | Value |
|---------|-------|
| **Record Type** | A |
| **Host/Name** | `meetang` |
| **Value** | `76.76.21.21` |
| **TTL** | Auto or 300 |

---

## 2. Vercel Domain Configuration

After DNS is set up:

1. Go to Vercel Project Settings > Domains
2. Add `meetang.finlotto.com`
3. Vercel will automatically provision SSL certificate

---

## 3. Domain Routing (IMPLEMENTED)

The middleware at `/middleware.ts` now:

- Detects `Host` header from incoming requests
- Maps `meetang.finlotto.com` -> tenant slug `meetang-huayja`
- Rewrites requests to `/t/meetang-huayja/*` internally
- Blocks cross-tenant access (e.g., meetang.finlotto.com/t/master is blocked)
- Keeps the URL clean (user sees `meetang.finlotto.com/customer/login`, not `/t/meetang-huayja/customer/login`)

---

## 4. Logo/Branding Setup

### Where to Upload Logo

**Option A: Via Admin UI**
1. Login as super_admin
2. Go to `/tenant-manager`
3. Click edit on "มีตังค์หวยจ๋า"
4. Upload logo in the edit dialog

**Option B: Via Site Manager**
1. Go to `/site-manager/branding`
2. Select tenant from dropdown
3. Upload logo

### Current Branding Status

| Tenant | Name | Logo Status |
|--------|------|-------------|
| FIN LOTTO Master | FIN LOTTO Master | NULL (needs upload) |
| มีตังค์หวยจ๋า | มีตังค์หวยจ๋า | NULL (needs upload) |

### Confirm Child Site Name
- Child site name is correctly set to **"มีตังค์หวยจ๋า"** in the database
- This name will appear in the header and welcome message

---

## 5. Smoke Test Checklist (Post-DNS)

After DNS propagates (5-30 minutes), verify:

| Test | Expected Result |
|------|-----------------|
| `https://meetang.finlotto.com` | Shows "มีตังค์หวยจ๋า" branding |
| `https://meetang.finlotto.com/customer/login` | Customer login page |
| `https://meetang.finlotto.com/customer/bet` | Betting page (after login) |
| `https://finlotto.com` | Shows FIN LOTTO Master (not child site) |
| `https://meetang.finlotto.com/t/master` | Redirected back to child tenant |

---

## 6. Adding More Child Sites

To add another child site domain:

1. Create tenant in `/tenant-manager`
2. Add domain mapping in `/middleware.ts`:
   ```typescript
   const DOMAIN_TENANT_MAP: Record<string, string> = {
     'meetang.finlotto.com': 'meetang-huayja',
     'newsite.finlotto.com': 'new-tenant-slug',  // Add here
   };
   ```
3. Configure DNS (CNAME to `cname.vercel-dns.com`)
4. Add domain in Vercel project settings

---

## Summary

| Item | Status |
|------|--------|
| Domain routing middleware | **DONE** |
| Tenant-to-domain mapping | **DONE** |
| Cross-tenant access blocked | **DONE** |
| DNS instructions | **PROVIDED** |
| Logo upload location | **DOCUMENTED** |
| Child site name confirmed | **มีตังค์หวยจ๋า** |
| Build | **PASSING** |

---

## Final Status

# READY TO PRESS PRODUCTION SITE

Configure DNS as instructed above, then run the smoke test checklist.
