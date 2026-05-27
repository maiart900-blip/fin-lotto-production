# Pre-Production Checklist

**Generated:** 2026-05-27
**Status:** READY FOR PRODUCTION (with noted action items)

---

## 1. DNS / Domain Readiness

| Tenant | Slug | Domain | Status |
|--------|------|--------|--------|
| FIN LOTTO Master | `master` | `finlotto.com` | Configured in DB |
| มีตังค์หวยจ๋า | `meetang-huayja` | `meetang.finlotto.com` | Configured in DB |

### DNS Configuration Required

For `meetang.finlotto.com`:
```
Type: CNAME
Name: meetang
Value: cname.vercel-dns.com
```

For `finlotto.com` (if using Vercel):
```
Type: A
Name: @
Value: 76.76.21.21
```

### Middleware Domain Routing

- **Current:** Slug-based routing (`/t/[slug]`) is working
- **Production:** Domain-based routing needs middleware update

**Action Required:** Update middleware to detect `Host` header and route to correct tenant.

---

## 2. Branding / Logo

| Tenant | Logo Status | Action |
|--------|-------------|--------|
| FIN LOTTO Master | `logo_url = NULL` | Upload logo via branding page |
| มีตังค์หวยจ๋า | `logo_url = NULL` | Upload logo via branding page |

**Branding Page:** `/site-manager/branding`

---

## 3. Risk Tables

| Table | Status | Columns |
|-------|--------|---------|
| `risk_aggregations` | CREATED | 23 columns |
| `site_api_keys` | CREATED | 17 columns |
| `risk_aggregation_history` | CREATED | 15 columns |

All risk tables are ready for production use.

---

## 4. Entry Tenant Coverage

| Metric | Value |
|--------|-------|
| Total Entries | 52 |
| With tenant_id | 52 |
| Without tenant_id | 0 |

**Coverage: 100%** - All entries are properly scoped.

---

## 5. Build Status

**Status:** PASS

The application builds successfully with no errors.

---

## 6. Final Smoke Test Results

| Test | Status |
|------|--------|
| Child Site Routing (`/t/meetang-huayja`) | PASS |
| Branding Isolation | PASS |
| Dashboard Isolation | PASS |
| Entry Visibility | PASS (after backfill) |
| Risk System Tables | PASS |

---

## 7. Production Deployment Steps

### Step 1: Deploy Code
```bash
git add .
git commit -m "feat: add risk aggregation system, fix entry tenant scoping"
git push origin main
```

### Step 2: Configure DNS
1. Add CNAME record for `meetang.finlotto.com` → `cname.vercel-dns.com`
2. Add domain in Vercel project settings
3. Wait for SSL certificate provisioning

### Step 3: Upload Logos
1. Login as admin
2. Navigate to `/site-manager/branding`
3. Upload logos for both tenants

### Step 4: Test Production
1. Visit `https://meetang.finlotto.com`
2. Verify branding shows correctly
3. Test customer login flow
4. Verify data isolation

---

## 8. Risk API Integration (Post-Launch)

### For Child Auto Sites

1. Generate API key via `/api/admin/site-api-keys` (POST)
2. Configure child site to push to `/api/risk/ingest`
3. Set push frequency (recommended: 30-60 seconds)

### API Key Format
```
flk_[site_id]_[random_key]
```

### Ingest Endpoint
```
POST /api/risk/ingest
Authorization: Bearer flk_meetang_xxx...
Content-Type: application/json

{
  "lottery_type": "หวยรัฐบาล",
  "draw_date": "2026-06-01",
  "aggregations": [
    {
      "lottery_number": "123",
      "bet_type": "3ตัวบน",
      "total_bet_amount": 5000,
      "payout_liability": 4500000,
      "bet_count": 10
    }
  ]
}
```

---

## 9. Remaining Items

| Item | Priority | Owner |
|------|----------|-------|
| Configure DNS for meetang.finlotto.com | HIGH | DevOps |
| Upload tenant logos | MEDIUM | Admin |
| Add domain routing in middleware | HIGH | Dev |
| Generate API key for child site | LOW | Admin |
| Set up risk aggregation cron | LOW | Dev |

---

## 10. Sign-Off

- [ ] Code deployed to production
- [ ] DNS configured and SSL active
- [ ] Logos uploaded
- [ ] Smoke test on production passed
- [ ] Risk API tested with mock data

**Approved for Production:** _________________

**Date:** _________________
