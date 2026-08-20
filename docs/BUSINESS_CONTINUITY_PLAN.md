# BUSINESS CONTINUITY PLAN

**System:** Fin-Lotto Production  
**Version:** 1.0.0  
**Classification:** Confidential

---

## 1. OVERVIEW

This document outlines procedures for maintaining business operations during and after disruptive incidents.

### Recovery Objectives
| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | 1 hour |
| RPO (Recovery Point Objective) | 15 minutes |
| MTTR (Mean Time To Recovery) | 30 minutes |

---

## 2. BACKUP RECOVERY

### Database Backups (Supabase)

**Automatic Backups:**
- Supabase performs daily backups automatically
- Point-in-time recovery available (last 7 days on Pro plan)

**Manual Backup:**
```bash
# Export via Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d).sql
```

**Recovery Procedure:**
1. Go to Supabase Dashboard > Database > Backups
2. Select backup point
3. Click "Restore"
4. Wait for restoration (5-30 minutes)
5. Verify data integrity via /api/safety/verify

### Redis Backups (Upstash)

**Automatic:** Upstash provides persistence and replication

**Recovery:**
1. If data lost, Redis will rebuild from primary
2. Rate limit counters will reset (acceptable)
3. No critical business data stored in Redis

### Blob Storage (Vercel)

**Recovery:**
1. Vercel Blob provides redundancy
2. If files lost, re-upload from source

---

## 3. DATABASE RESTORE PROCEDURES

### Full Database Restore

**When to Use:** Complete data loss, corruption

**Steps:**
1. Enable maintenance mode
2. Go to Supabase Dashboard > Database > Backups
3. Select most recent clean backup
4. Click "Restore to new project" or "Restore"
5. If new project: Update environment variables
6. Run data integrity checks:
   ```sql
   SELECT COUNT(*) FROM customers;
   SELECT COUNT(*) FROM entries WHERE legacy_orphan IS NOT TRUE;
   SELECT COUNT(*) FROM lottery_results WHERE is_processed = true;
   ```
7. Verify /api/safety/verify passes
8. Disable maintenance mode

### Partial Data Recovery

**When to Use:** Specific table corrupted

**Steps:**
1. Identify affected tables
2. Use point-in-time recovery if available
3. Or restore from backup to temp schema:
   ```sql
   CREATE SCHEMA backup_restore;
   -- Restore specific table
   INSERT INTO public.entries 
   SELECT * FROM backup_restore.entries 
   WHERE id NOT IN (SELECT id FROM public.entries);
   ```

---

## 4. REDIS RECOVERY

### Complete Redis Failure

**Impact:** Rate limiting disabled, possible increased load

**Steps:**
1. Check Upstash Console for status
2. If regional outage: Wait for Upstash recovery
3. If configuration issue:
   - Verify KV_REST_API_URL and KV_REST_API_TOKEN
   - Redeploy application
4. Rate limits will reset (counters start fresh)

### Data Loss in Redis

**Impact:** Minimal - no critical business data

**Steps:**
1. Redis stores only:
   - Rate limit counters (will rebuild)
   - Session cache (users re-login)
2. No recovery needed for business continuity

---

## 5. EMERGENCY SHUTDOWN

### Graceful Shutdown

**When to Use:** Planned maintenance, detected threat

**Steps:**
1. Go to /master-control
2. Disable in order:
   - betting_enabled (stop new bets)
   - Wait 5 minutes (let pending process)
   - result_entry_enabled
   - deposit_enabled, withdraw_enabled
3. Enable maintenance_mode in system_settings
4. Notify users via available channels

### Emergency Shutdown

**When to Use:** Active attack, critical data issue

**Steps:**
1. Go to Vercel Dashboard
2. Click "..." on production deployment
3. Select "Disable" or "Pause"
4. Or in database:
   ```sql
   UPDATE system_settings SET value = 'true' WHERE key = 'maintenance_mode';
   UPDATE global_controls SET is_enabled = false;
   ```

---

## 6. SAFE RESTART SEQUENCE

### After Planned Maintenance

1. **Pre-checks:**
   - Verify database accessible
   - Verify Redis accessible
   - Run /api/safety/verify

2. **Enable Services (in order):**
   - result_entry_enabled
   - registration_enabled
   - deposit_enabled
   - betting_enabled
   - withdraw_enabled
   - auto_payout_enabled

3. **Post-restart:**
   - Monitor /operations/kpi for 30 minutes
   - Check for error spikes
   - Verify cron jobs registered

### After Emergency Shutdown

1. **Root Cause Analysis:**
   - Identify what caused the shutdown
   - Verify issue is resolved
   - Document findings

2. **Data Integrity Check:**
   ```sql
   -- Check for orphan entries
   SELECT COUNT(*) FROM entries 
   WHERE customer_id IS NULL 
   AND legacy_orphan IS NOT TRUE;
   
   -- Check ledger balance
   SELECT check_ledger_balance();
   
   -- Check for stuck settlements
   SELECT COUNT(*) FROM lottery_results 
   WHERE is_processed = false 
   AND processing_started_at < NOW() - INTERVAL '10 minutes';
   ```

3. **Gradual Restart:**
   - Enable read-only operations first
   - Monitor for 15 minutes
   - Enable write operations
   - Monitor for 30 minutes
   - Full operations

---

## 7. DISASTER SCENARIOS

### Scenario: Vercel Outage

**Impact:** Application unavailable

**Response:**
1. Monitor status.vercel.com
2. No local action possible
3. Communicate to users via backup channel
4. Vercel has SLA for recovery

### Scenario: Supabase Outage

**Impact:** Database unavailable

**Response:**
1. Monitor status.supabase.com
2. Application will show errors
3. Enable maintenance mode if possible
4. Wait for Supabase recovery
5. Post-recovery: Verify data integrity

### Scenario: Data Breach

**Impact:** Security, compliance risk

**Response:**
1. Immediate shutdown
2. Preserve logs (do not delete)
3. Identify scope of breach
4. Notify affected parties (legal requirement)
5. Engage security team
6. Document everything

### Scenario: Ransomware/Malicious Code

**Impact:** System compromised

**Response:**
1. Immediate shutdown
2. Do not pay ransom
3. Restore from clean backup
4. Rotate all credentials
5. Audit all access logs
6. Report to authorities if required

---

## 8. COMMUNICATION PLAN

### Internal Notification

| Severity | Notify |
|----------|--------|
| Critical | All team immediately |
| High | Technical team + management |
| Medium | Technical team |
| Low | Log for review |

### External Communication

**Customer Communication:**
- Use in-app notification if possible
- Backup: Social media, LINE official
- Do not promise timeline without certainty

**Template:**
```
[System Status Update]
Our system is currently experiencing [brief description].
We are working to resolve this and expect [timeframe/no ETA].
We apologize for any inconvenience.
```

---

## 9. TESTING SCHEDULE

| Test | Frequency | Last Tested |
|------|-----------|-------------|
| Backup Restore | Monthly | |
| Failover Procedure | Quarterly | |
| Emergency Shutdown | Quarterly | |
| Full DR Drill | Annually | |

---

## 10. DOCUMENT CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | FIN LOTTO Development Team | Initial version |

**Next Review Date:** 2026-08-26

---

*This document is confidential and should be stored securely.*
