# PRODUCTION HANDOFF DOCUMENT

**System:** Fin-Lotto Production Platform  
**Handoff Date:** 2026-05-26  
**Version:** 1.0.0

---

## 1. SYSTEM OVERVIEW

### Architecture
- **Frontend:** Next.js 16 (App Router)
- **Backend:** Next.js API Routes (Serverless)
- **Database:** Supabase PostgreSQL
- **Cache/Rate Limiting:** Upstash Redis
- **File Storage:** Vercel Blob
- **Hosting:** Vercel

### Key URLs
- **Production:** (deployed URL)
- **Supabase Dashboard:** https://supabase.com/dashboard/project/ifmcaztqaordcgsbmnij
- **Vercel Dashboard:** (project URL)
- **Upstash Console:** https://console.upstash.com

---

## 2. CRITICAL COMPONENTS

### User Types
| Type | Description | Access Level |
|------|-------------|--------------|
| Customer | End users placing bets | Customer portal (/c/*) |
| Agent | Manages customers, views reports | Agent panel |
| Admin | Full system access | Admin panel, Master Control |
| Owner | Business oversight | All dashboards, reports |

### Core Flows
1. **Customer Betting:** Customer -> Lottery Selection -> Number Entry -> Bet Submission -> Entry Created
2. **Manual Key:** Admin -> Manual Key Page -> Customer Name -> Numbers -> Entry Created
3. **Result Entry:** Admin -> Results Page -> Enter Numbers -> Save
4. **Settlement:** Admin -> Process Results -> Winners Calculated -> Payouts Credited
5. **Payout:** Winning entries credited to customer balance automatically

---

## 3. OPERATIONAL DASHBOARDS

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Master Control | /master-control | Global system controls |
| Live Operations | /operations/live | Real-time metrics |
| KPI Dashboard | /operations/kpi | Business KPIs |
| Logs Viewer | /operations/logs | Production logs |
| Results Management | /results | Lottery result entry |

---

## 4. DATABASE TABLES

### Core Tables
- `customers` - User accounts (5 regular, 2 agents)
- `entries` - All betting entries (52 total, 51 legacy archived)
- `lotteries` - Lottery definitions (5 active)
- `lottery_results` - Draw results (3 processed)
- `payout_rates` - Payout multipliers (8 configured)
- `agents` - Agent records (6 total)

### Support Tables
- `ledger_entries` - Financial transactions
- `audit_logs` - System audit trail
- `production_logs` - Runtime logs
- `operational_alerts` - System alerts
- `recovery_events` - Auto-recovery actions
- `worker_locks` - Distributed locks
- `global_controls` - Feature toggles
- `system_settings` - Configuration

---

## 5. CRON JOBS

| Job | Schedule | Purpose |
|-----|----------|---------|
| daily-closing | 18:00 daily | End of day processing |
| daily-owner-report | 18:30 daily | Generate owner reports |
| data-retention | 20:00 Sunday | Cleanup old data |
| auto-recovery | Every 5 min | Auto-heal system issues |
| reconciliation | 19:00 daily | Financial reconciliation |
| cleanup | 03:00 daily | Maintenance cleanup |

---

## 6. SAFETY MECHANISMS

### Duplicate Payout Prevention
- `is_processed` flag on lottery_results
- `payout_processed_at` timestamp on entries
- `safe_payout_with_ledger()` idempotent function

### Kill Switches (global_controls)
- betting_enabled
- deposit_enabled
- withdraw_enabled
- registration_enabled
- auto_payout_enabled
- result_entry_enabled

### Auto-Recovery
- Stale lock release (>5 min)
- Failed payout retry (max 3 attempts)
- Stuck settlement detection
- Circuit breaker pattern

---

## 7. MONITORING & ALERTS

### Health Checks
- `/api/health` - Basic health endpoint
- `/api/safety/verify` - Safety verification

### Alert Types
- payout_spike - Large payout in short time
- high_exposure - Exposure limits exceeded
- failed_payouts - Payout failures
- settlement_failure - Processing stuck

---

## 8. SUPPORT CONTACTS

| Issue Type | Escalation |
|------------|------------|
| System Down | Immediate - Enable maintenance mode |
| Payout Issues | Check /operations/logs, verify ledger |
| Customer Disputes | Review audit_logs, entries table |
| Performance | Check /operations/kpi, Vercel logs |

---

## 9. KEY FILES

### Configuration
- `vercel.json` - Deployment config, cron schedules
- `lib/rate-limit.ts` - Rate limiting rules
- `lib/safety-guardrails.ts` - Safety checks
- `lib/auto-recovery.ts` - Recovery logic

### APIs
- `/api/results/process` - Settlement engine
- `/api/entries` - Bet submission
- `/api/operations/*` - Monitoring APIs
- `/api/cron/*` - Scheduled jobs

---

## 10. HANDOFF CHECKLIST

- [ ] All environment variables documented
- [ ] Database access provided
- [ ] Vercel project access granted
- [ ] Supabase access granted
- [ ] Upstash access granted
- [ ] Monitoring dashboards demonstrated
- [ ] Emergency procedures reviewed
- [ ] On-call schedule established

---

**Handoff Completed By:** _________________ Date: _________

**Received By:** _________________ Date: _________
