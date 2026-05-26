# GO-LIVE MASTER CHECKLIST

**System:** Fin-Lotto Production  
**Version:** 1.0.0  
**Date:** 2026-05-26

---

## BEFORE LAUNCH (T-24 hours to T-0)

### Environment Verification
- [ ] All environment variables set in Vercel
  - [ ] SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
  - [ ] KV_REST_API_URL, KV_REST_API_TOKEN (Upstash Redis)
  - [ ] BLOB_READ_WRITE_TOKEN
  - [ ] CRON_SECRET (if using protected crons)
- [ ] Database connection verified
- [ ] Redis connection verified
- [ ] Blob storage verified

### Database Health
- [ ] All migrations applied successfully
- [ ] Tables exist: customers, entries, lottery_results, agents, lotteries, payout_rates
- [ ] Indexes created for performance
- [ ] RLS policies enabled where needed
- [ ] Legacy orphan entries archived (51 entries)

### System Configuration
- [ ] Global controls all ENABLED:
  - [ ] betting_enabled
  - [ ] deposit_enabled
  - [ ] withdraw_enabled
  - [ ] registration_enabled
  - [ ] auto_payout_enabled
  - [ ] result_entry_enabled
- [ ] System settings configured:
  - [ ] maintenance_mode = false
  - [ ] launch_mode = controlled
  - [ ] settlement_confirmation_required = true
- [ ] Payout rates configured correctly

### Cron Jobs Scheduled
- [ ] daily-closing (18:00 daily)
- [ ] daily-owner-report (18:30 daily)
- [ ] data-retention (20:00 Sunday)
- [ ] auto-recovery (every 5 minutes)
- [ ] reconciliation (19:00 daily)
- [ ] cleanup (03:00 daily)

### Security Checks
- [ ] Rate limiting active (Upstash)
- [ ] Authentication middleware working
- [ ] API routes protected
- [ ] No test endpoints exposed
- [ ] CORS configured correctly

### Final Build Verification
- [ ] `pnpm build` succeeds without errors
- [ ] No TypeScript errors
- [ ] No critical lint warnings
- [ ] Bundle size within limits

---

## DURING LAUNCH (T-0)

### Pre-Launch (T-5 minutes)
- [ ] Notify team of imminent launch
- [ ] Open monitoring dashboards:
  - [ ] /operations/live
  - [ ] /operations/kpi
  - [ ] /operations/logs
- [ ] Open Supabase dashboard
- [ ] Open Vercel deployment logs

### Go-Live (T-0)
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Test critical paths:
  - [ ] Login page loads
  - [ ] Customer can view lotteries
  - [ ] API health check returns OK
- [ ] Monitor for errors (first 10 minutes)

### Post-Deploy Verification (T+10 minutes)
- [ ] All pages loading correctly
- [ ] No 500 errors in logs
- [ ] Database queries executing
- [ ] Redis caching working
- [ ] Cron jobs registered in Vercel

---

## AFTER LAUNCH (T+1 hour to T+24 hours)

### First Hour Monitoring
- [ ] Monitor KPI dashboard continuously
- [ ] Check for error spikes
- [ ] Verify first real transactions (if any)
- [ ] Confirm settlement process works
- [ ] Test payout flow end-to-end

### First Day Checklist
- [ ] Review all production logs
- [ ] Check failed jobs count
- [ ] Verify daily-closing cron ran successfully
- [ ] Verify daily-owner-report generated
- [ ] Review customer feedback/issues
- [ ] Document any incidents

### Metrics to Track
- [ ] Active users count
- [ ] Betting volume
- [ ] Payout totals
- [ ] Error rate < 1%
- [ ] Average response time < 500ms
- [ ] Settlement time < 30s

---

## EMERGENCY RESPONSE

### If Critical Error Occurs
1. **Assess Impact**
   - Is it affecting all users or specific feature?
   - Are transactions at risk?

2. **Immediate Actions**
   - Enable maintenance_mode if needed
   - Disable affected feature via global_controls
   - Check /operations/logs for error details

3. **Escalation Path**
   - Level 1: Check logs, attempt quick fix
   - Level 2: Rollback to previous version
   - Level 3: Enable full maintenance mode

### Rollback Procedure
1. Go to Vercel dashboard
2. Navigate to Deployments
3. Find last known good deployment
4. Click "..." menu > "Promote to Production"
5. Verify rollback successful
6. Investigate root cause

---

## SIGN-OFF

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | | | |
| Operations | | | |
| Business Owner | | | |

**Launch Authorization:** [ ] APPROVED / [ ] NOT APPROVED

---

*Document generated: 2026-05-26*
