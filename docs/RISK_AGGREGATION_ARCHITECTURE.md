# Risk Aggregation Architecture Implementation

## Overview

This implementation creates the central risk aggregation system for FIN LOTTO platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FIN LOTTO MAIN PLATFORM                          │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ Key-in Agents   │  │ Risk Dashboard  │  │ Risk Ingest API        │  │
│  │ (Scoped data)   │  │ (Super admin)   │  │ (Child sites push)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    risk_aggregations table                      │    │
│  │  - Aggregated betting data from ALL sources                     │    │
│  │  - No raw slip data                                             │    │
│  │  - Risk levels computed via configurable thresholds             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                   ▲
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────┴─────┐            ┌─────┴─────┐            ┌─────┴─────┐
    │ Key-in    │            │ Child Auto│            │ Child Auto│
    │ Agents    │            │ Site A    │            │ Site B    │
    │ (cron)    │            │ (API)     │            │ (API)     │
    └───────────┘            └───────────┘            └───────────┘
```

## Files Created

### Database Migration
- `lib/db/migrations/create-risk-aggregation-system.sql` - Creates:
  - `site_api_keys` - API key authentication for child sites
  - `risk_aggregations` - Central risk data storage
  - `risk_settings` - Configurable risk thresholds per site/lottery/bet_type
  - `risk_aggregation_history` - Historical snapshots
  - `calculate_risk_level()` - Function for dynamic risk calculation

### API Authentication
- `lib/site-api-auth.ts` - Site API key management functions

### Risk APIs
- `app/api/risk/ingest/route.ts` - Child sites push aggregated data
- `app/api/risk/dashboard/route.ts` - Risk dashboard summary
- `app/api/risk/by-number/route.ts` - Lookup exposure for specific number
- `app/api/risk/top-exposure/route.ts` - Ranked list of highest risk numbers
- `app/api/risk/optimal-outcome/route.ts` - Best/worst winning number analysis

### Admin APIs
- `app/api/admin/site-api-keys/route.ts` - Manage child site API keys

### Cron Jobs
- `app/api/cron/aggregate-keyin-risk/route.ts` - Aggregates key-in entries

## Files Modified/Simplified

### Removed
- `lib/db/migrations/add-scope-columns.sql` - Not needed for separate DB architecture

### Simplified
- `lib/db/migrations/production-scope-indexes.sql` - Only key-in agent indexes

## API Reference

### For Child Auto Sites

**Push Risk Data:**
```bash
POST /api/risk/ingest
Authorization: Bearer flk_[site_id]_[key]

{
  "lottery_type": "หวยรัฐบาล",
  "draw_date": "2024-02-01",
  "aggregations": [
    {
      "lottery_number": "123",
      "bet_type": "3ตัวบน",
      "total_bet_amount": 10000,
      "payout_liability": 9000000,
      "bet_count": 15
    }
  ]
}
```

### For Super Admins

**Risk Dashboard:**
```
GET /api/risk/dashboard?draw_date=2024-02-01&lottery_type=หวยรัฐบาล
```

**Top Exposure:**
```
GET /api/risk/top-exposure?draw_date=2024-02-01&limit=50
```

**Lookup Number:**
```
GET /api/risk/by-number?number=123&draw_date=2024-02-01
```

**Optimal Outcome:**
```
GET /api/risk/optimal-outcome?draw_date=2024-02-01
```

**Manage API Keys:**
```
GET /api/admin/site-api-keys
POST /api/admin/site-api-keys { site_id, site_name, site_type }
DELETE /api/admin/site-api-keys { site_id }
```

## Key-in Agent Scope (Unchanged)

The existing scope logic for key-in agents remains:
- `lib/customer-scope.ts` - Agents see only their customers
- `lib/data-scope.ts` - Data isolation within FIN LOTTO DB
- APIs scoped: customers, entries, credit_transactions, network-members

## Deployment Steps

1. **Apply database migration:**
   ```sql
   -- Run create-risk-aggregation-system.sql
   ```

2. **Apply index migration (optional, for performance):**
   ```sql
   -- Run production-scope-indexes.sql
   ```

3. **Set up cron job:**
   - Configure `/api/cron/aggregate-keyin-risk` to run every 30-60 seconds
   - Set `CRON_SECRET` environment variable

4. **Create API keys for child sites:**
   - Use `/api/admin/site-api-keys` POST endpoint
   - Distribute keys securely to child site operators

5. **Configure child sites:**
   - Each child site implements their own aggregation logic
   - Pushes to `/api/risk/ingest` every 30-60 seconds

## Security

- Child sites authenticate via `flk_[site_id]_[key]` Bearer tokens
- API keys are hashed (SHA-256) before storage
- Keys cannot be retrieved after creation
- Super admin only access for dashboard and key management
- Rate limiting per site (configurable)

## Risk Threshold Configuration

Default thresholds (configurable per site/lottery/bet_type):
- Low: 0 - 50,000 THB
- Medium: 50,000 - 200,000 THB
- High: 200,000 - 500,000 THB
- Critical: > 500,000 THB

Use `risk_settings` table to override for specific sites or bet types.
