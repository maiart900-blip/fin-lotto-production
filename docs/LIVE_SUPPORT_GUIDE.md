# LIVE SUPPORT GUIDE

**System:** Fin-Lotto Production  
**Version:** 1.0.0

---

## QUICK REFERENCE

### Emergency Actions
| Issue | Immediate Action |
|-------|------------------|
| System Down | Check Vercel status, enable maintenance_mode |
| Payout Failure | Check /operations/logs, retry via auto-recovery |
| High Exposure | Review /operations/kpi, consider disabling betting |
| Data Corruption | Enable maintenance_mode, contact DBA |

### Key URLs
- **Live Ops:** /operations/live
- **KPI Dashboard:** /operations/kpi
- **Logs:** /operations/logs
- **Master Control:** /master-control
- **Safety Check:** /api/safety/verify

---

## COMMON ISSUES & SOLUTIONS

### 1. Failed Payouts

**Symptoms:** Customer reports winning but no credit received

**Diagnosis:**
1. Check `/operations/logs` for payout errors
2. Query entries table:
   ```sql
   SELECT * FROM entries 
   WHERE customer_id = '<id>' 
   AND status = 'won' 
   AND payout_status != 'completed'
   ```

**Resolution:**
1. If entry exists with won status but no payout:
   - Check if `payout_retry_count` < 3
   - Auto-recovery will retry automatically every 5 min
   - For immediate fix, manually update customer balance and entry
2. If settlement never ran:
   - Re-run settlement from /results page

**Prevention:** Auto-recovery handles most cases. Monitor failed_jobs KPI.

---

### 2. Stuck Settlements

**Symptoms:** Results entered but winners not calculated

**Diagnosis:**
1. Check lottery_results table:
   ```sql
   SELECT * FROM lottery_results 
   WHERE is_processed = false 
   ORDER BY created_at DESC
   ```
2. Check for stuck processing_started_at

**Resolution:**
1. If processing_started_at is >10 min old:
   - Auto-recovery will detect and reset
   - Or manually set `is_processed = false, status = 'pending'`
2. Re-click "Process Results" from admin panel

**Prevention:** Monitor settlement_speed KPI. Alert if >30s.

---

### 3. Agent Issues

**Symptoms:** Agent cannot see customers, commission wrong

**Diagnosis:**
1. Verify agent record in agents table
2. Check agent_id linkage in customers table
3. Review commission calculation in agent reports

**Resolution:**
1. If agent_id not linked:
   ```sql
   UPDATE customers SET agent_id = '<agent_uuid>' WHERE id = '<customer_uuid>'
   ```
2. Recalculate commission from agent report page

**Prevention:** Validate agent linkage during customer registration.

---

### 4. Customer Disputes

**Symptoms:** Customer claims bet was placed but not recorded

**Diagnosis:**
1. Check audit_logs for the timeframe
2. Check entries table for customer_id
3. Review production_logs for any errors during submission

**Resolution:**
1. If entry exists: Show customer the record
2. If no entry found:
   - Check audit_logs for submission attempt
   - Review error logs for failures
   - If confirmed lost bet, manual entry may be needed (requires approval)

**Prevention:** All bets create audit logs. Monitor error rates.

---

### 5. Emergency Maintenance

**When to Activate:**
- Multiple critical errors (>5 in 5 minutes)
- Data integrity concerns
- Security incident
- System under attack

**Activation Steps:**
1. Go to /master-control
2. Disable relevant controls (betting_enabled, etc.)
3. Or enable full maintenance mode via system_settings
4. Notify customers (if possible)

**Recovery Steps:**
1. Fix the root cause
2. Run /api/safety/verify to confirm system health
3. Re-enable controls one by one
4. Monitor closely for 30 minutes

---

## DAILY OPERATIONS

### Morning Checklist
- [ ] Check /operations/kpi for overnight issues
- [ ] Review failed_jobs count (should be 0)
- [ ] Verify cron jobs ran (daily-closing, reports)
- [ ] Check customer balance reconciliation

### During Operations
- [ ] Monitor KPI dashboard for anomalies
- [ ] Check exposure levels before peak times
- [ ] Review any operational alerts

### End of Day
- [ ] Verify daily-closing ran successfully
- [ ] Review owner report
- [ ] Check total payouts vs betting volume
- [ ] Archive any support tickets

---

## ESCALATION MATRIX

| Severity | Response Time | Actions |
|----------|---------------|---------|
| Critical | Immediate | Enable maintenance, notify all |
| High | 15 minutes | Disable affected feature, investigate |
| Medium | 1 hour | Log incident, schedule fix |
| Low | Next day | Document, plan resolution |

### Severity Definitions
- **Critical:** System down, data loss risk, security breach
- **High:** Major feature broken, payouts failing
- **Medium:** Performance degraded, minor feature broken
- **Low:** UI issue, non-critical bug

---

## USEFUL SQL QUERIES

### Check System Health
```sql
SELECT control_key, is_enabled FROM global_controls;
SELECT key, value FROM system_settings WHERE key IN ('maintenance_mode', 'launch_mode');
```

### Today's Summary
```sql
SELECT 
  COUNT(*) as total_entries,
  SUM(amount) as total_bet,
  COUNT(CASE WHEN status = 'won' THEN 1 END) as winners
FROM entries 
WHERE created_at >= CURRENT_DATE
  AND legacy_orphan IS NOT TRUE;
```

### Recent Errors
```sql
SELECT level, category, message, created_at 
FROM production_logs 
WHERE level IN ('error', 'critical')
ORDER BY created_at DESC 
LIMIT 20;
```

### Customer Balance Check
```sql
SELECT id, name, credit_balance, is_active 
FROM customers 
ORDER BY credit_balance DESC 
LIMIT 10;
```

---

## CONTACTS

| Role | Contact |
|------|---------|
| Technical Lead | |
| Database Admin | |
| Business Owner | |
| On-Call Support | |

---

*Last Updated: 2026-05-26*
