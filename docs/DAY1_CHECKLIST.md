# Day-1 Operations Checklist

## Pre-Launch Verification (T-60 minutes)

### System Health
- [ ] Database connection OK (latency <100ms)
- [ ] Redis connection OK (latency <50ms)
- [ ] API endpoints responding (health check passes)
- [ ] No critical alerts pending

### Global Controls
- [ ] `betting_enabled` = ON
- [ ] `deposit_enabled` = ON
- [ ] `withdraw_enabled` = ON
- [ ] `registration_enabled` = ON
- [ ] `auto_payout_enabled` = ON
- [ ] `maintenance_mode` = OFF

### Data Integrity
- [ ] No orphan entries (legacy_orphan = archived)
- [ ] Customer identity model verified
- [ ] Agent permissions configured
- [ ] Payout rates configured

### Settlement System
- [ ] Settlement queue empty or known
- [ ] Payout limits configured
- [ ] Result entry staff confirmed

---

## Before Betting Opens (T-30 minutes)

### Operational Readiness
- [ ] Operations dashboard accessible
- [ ] Alert notification channel configured
- [ ] On-call staff confirmed available
- [ ] Emergency procedures documented

### Financial Readiness
- [ ] Starting bank balance recorded
- [ ] Payout reserve available
- [ ] Withdrawal processing enabled

### Communication
- [ ] Announcement posted (if needed)
- [ ] Support team briefed
- [ ] Agent network notified

---

## During Betting Window

### Continuous Monitoring (every 15 min)
- [ ] Check `/operations/live` dashboard
- [ ] Review active customers count
- [ ] Monitor bets per minute
- [ ] Watch exposure on top numbers

### Periodic Checks (every hour)
- [ ] Process pending deposits
- [ ] Process pending withdrawals
- [ ] Review and acknowledge alerts
- [ ] Check for stuck transactions

### Red Flags to Watch
- [ ] Sudden drop in betting activity
- [ ] Single number exposure >10,000
- [ ] Multiple failed transactions
- [ ] Unusual agent activity patterns

---

## Before Result Publication (T-15 minutes)

### Pre-Settlement Checklist
- [ ] Confirm betting window closed (if applicable)
- [ ] Review total exposure by number
- [ ] Calculate estimated payout liability
- [ ] Verify settlement staff ready

### Exposure Review
```
Top 10 Numbers Exposure:
1. _____ = _____ THB
2. _____ = _____ THB
3. _____ = _____ THB
...
```

### Payout Estimate
```
Estimated worst-case payout: _____ THB
Estimated likely payout: _____ THB
Available payout reserve: _____ THB
```

---

## Result Entry Procedure

### Entry Checklist
1. [ ] Verify official result source
2. [ ] Double-check all numbers before entry
3. [ ] Have second person verify
4. [ ] Enter result in system
5. [ ] Review settlement summary BEFORE confirming

### Settlement Summary Review
```
Total Winners: _____
Total Payout: _____ THB
Largest Single Payout: _____ THB

[ ] Confirm and Process Settlement
```

---

## Post-Settlement Verification (within 30 min)

### Settlement Success
- [ ] `is_processed` = true for result
- [ ] All winning entries marked `status = won`
- [ ] Payout amounts calculated correctly
- [ ] No entries stuck in `processing` status

### Payout Processing
- [ ] Payout queue count = 0 (or processing)
- [ ] Failed payouts = 0
- [ ] Customer balances updated

### Ledger Balance
- [ ] Total payouts match settlement summary
- [ ] No double payouts detected
- [ ] Ledger entries created for all payouts

### Audit Trail
- [ ] Settlement logged in audit_logs
- [ ] Result entry staff identified
- [ ] Timestamp recorded

---

## End of Day Reconciliation

### Financial Summary
```
Date: _____________

Deposits Received: _____ THB
Withdrawals Paid: _____ THB
Bets Collected: _____ THB
Payouts Issued: _____ THB
--------------------------
Net Position: _____ THB
```

### System Status
- [ ] All queues empty
- [ ] No failed transactions
- [ ] No unresolved incidents
- [ ] Alerts acknowledged

### Sign-Off
```
Operations Lead: _____________ Date: _______
Finance Lead: _____________ Date: _______
```

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Operations Lead | __________ | __________ |
| Tech Lead | __________ | __________ |
| Finance Lead | __________ | __________ |
| Security | __________ | __________ |
