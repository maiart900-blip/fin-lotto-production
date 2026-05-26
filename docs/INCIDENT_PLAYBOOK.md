# Incident Playbook

## Quick Reference: Emergency Actions

| Incident | Immediate Action | Recovery |
|----------|-----------------|----------|
| System Down | Enable maintenance_mode | Contact tech lead |
| Wrong Result | Disable auto_payout | Initiate rollback |
| Failed Payouts | Investigate cause | Retry individual payouts |
| Fraud Detected | Disable betting | Freeze suspicious accounts |
| High Exposure | Set number limit | Monitor closely |

---

## INC-001: System Unavailable

### Symptoms
- Users cannot access website
- API returns 500 errors
- Health check fails

### Immediate Actions
1. Check Vercel deployment status
2. Check Supabase status page
3. Check Upstash status page
4. Enable maintenance mode if partial

### Resolution Steps
```
1. Identify failing component (DB, Redis, API)
2. Check error logs in Vercel dashboard
3. If DB: Check Supabase connection limits
4. If Redis: Check Upstash quota
5. If API: Check for code deployment issue
```

### Escalation
- **Within 5 min**: Contact tech lead
- **Within 15 min**: Post status update
- **Within 30 min**: Executive notification

---

## INC-002: Incorrect Lottery Result Entered

### Symptoms
- Settlement ran with wrong numbers
- Customers received incorrect payouts
- Reports show unexpected winners

### Immediate Actions
1. DISABLE `auto_payout_enabled` immediately
2. Do NOT enter new results
3. Document the incorrect numbers

### Resolution Steps
```
1. Go to /results page
2. Find the incorrect result
3. Click "View Details"
4. If payouts not yet processed:
   - Click "Rollback Result"
   - Re-enter correct numbers
5. If payouts already processed:
   - Document affected customers
   - Calculate payout differences
   - Manual adjustment required
```

### Manual Adjustment Process
```sql
-- Find affected entries
SELECT * FROM entries 
WHERE result_id = '<result_id>' 
AND status = 'won';

-- For each incorrect payout:
-- 1. Create reversal credit adjustment
-- 2. Recalculate correct payout
-- 3. Apply new credit adjustment
-- 4. Document in audit log
```

### Escalation
- **Immediately**: Finance lead + Tech lead
- **Within 1 hour**: All affected customers contacted

---

## INC-003: Failed Payouts

### Symptoms
- `failed_payouts` count > 0 on dashboard
- Customer complaints about missing winnings
- Entries stuck in `payout_status = failed`

### Immediate Actions
1. Check system health (DB and Redis)
2. Review error logs for failure reason

### Resolution Steps
```
1. Go to /payout-agent or /payout-key
2. Filter by status = failed
3. For each failed entry:
   a. Click "View Details"
   b. Check customer balance
   c. Check if partial payout occurred
   d. Click "Retry Payout"
4. Verify customer balance after retry
```

### Common Failure Causes
| Cause | Solution |
|-------|----------|
| DB timeout | Retry during low traffic |
| Invalid customer_id | Link entry to correct customer |
| Insufficient rate config | Configure payout rate |
| Concurrent update | Retry with lock |

### Escalation
- **Within 30 min**: Finance lead
- **Within 2 hours**: All failed payouts resolved

---

## INC-004: Suspected Fraud

### Symptoms
- Unusual betting patterns
- Rapid bets on winning numbers after result
- Multiple accounts from same source
- Agent collusion indicators

### Immediate Actions
1. DO NOT alert the suspect
2. Take screenshots of evidence
3. Freeze suspicious accounts (mark inactive)

### Investigation Steps
```
1. Document suspicious activity
2. Pull betting history for suspect
3. Check IP addresses and device info
4. Check timing of bets vs result publication
5. Review agent relationships
```

### Account Freeze Process
```sql
-- Freeze customer account
UPDATE customers 
SET is_active = false,
    status = 'suspended',
    suspension_reason = 'Fraud investigation'
WHERE id = '<customer_id>';

-- Freeze pending payouts
UPDATE entries 
SET payout_status = 'held'
WHERE customer_id = '<customer_id>'
AND status = 'won'
AND payout_status = 'pending';
```

### Escalation
- **Immediately**: Security team
- **Within 24 hours**: Decision on account status

---

## INC-005: High Exposure Alert

### Symptoms
- Single number exposure > 10,000 THB
- Alert triggered on dashboard
- Risk of significant payout

### Immediate Actions
1. Identify the high-exposure number
2. Review bet distribution (single customer vs many)

### Resolution Options

**Option A: Accept Risk**
- Document decision
- Monitor during result

**Option B: Limit Further Bets**
```
1. Go to /risk-control
2. Find the number
3. Set max_bet_amount lower
4. Enable "block new bets" if critical
```

**Option C: Hedge (Advanced)**
- Consider counter-position if available
- Document hedging strategy

### Escalation
- **>20,000 exposure**: Finance lead notification
- **>50,000 exposure**: Executive approval required

---

## INC-006: Settlement Queue Stuck

### Symptoms
- Result entered but not processed
- `pending_settlements` > 0 for extended period
- Entries still showing `pending` status

### Immediate Actions
1. Check if settlement was manually started
2. Check for error messages in logs

### Resolution Steps
```
1. Go to /results page
2. Find the unprocessed result
3. Check status column
4. If "pending":
   - Click "Process Settlement"
   - Wait for completion
5. If "processing" for >10 min:
   - Check server logs
   - May need to reset and retry
```

### Manual Settlement (Last Resort)
```
1. Set is_processed = false if stuck
2. Clear processing_started_at
3. Retry via API or UI
```

### Escalation
- **Within 30 min**: Tech lead

---

## INC-007: Database Performance Degradation

### Symptoms
- Slow page loads
- DB latency > 500ms on health check
- Timeout errors in logs

### Immediate Actions
1. Check Supabase dashboard for load
2. Enable maintenance mode if severe

### Resolution Steps
```
1. Check for long-running queries
2. Check connection pool usage
3. Check for table locks
4. Consider:
   - Killing long queries
   - Scaling up temporarily
   - Reducing traffic
```

### Escalation
- **If affecting users**: Immediately
- **If degraded but functional**: Within 1 hour

---

## Post-Incident Review

After any incident is resolved:

1. **Document**
   - Timeline of events
   - Root cause identified
   - Actions taken
   - Impact assessment

2. **Review**
   - What went well
   - What could improve
   - Action items for prevention

3. **Update**
   - This playbook if needed
   - Monitoring thresholds
   - Alert configurations
