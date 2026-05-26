# Live Operations Guide

## Overview

This guide covers day-to-day operations for the FIN Lotto production system.

---

## 1. Operations Dashboard

### Access
- URL: `/operations/live`
- Requires: Super Admin role

### Key Metrics Monitored

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Active Customers | Customers who placed bets in last hour | N/A |
| Active Agents | Agents who created entries in last hour | N/A |
| Bets/Minute | Betting velocity (5-min rolling average) | >50 = spike |
| Total Exposure | Sum of all pending bet amounts today | Per number limit |
| Pending Settlements | Lottery results awaiting processing | >0 after result time |
| Payout Queue | Won entries awaiting payout | Amount > 100,000 |
| Failed Payouts | Entries with failed payout status | Any > 0 = critical |

### System Health Indicators

| Component | Healthy | Degraded | Unhealthy |
|-----------|---------|----------|-----------|
| Database | <100ms | 100-500ms | >500ms or error |
| Redis | <50ms | 50-200ms | >200ms or error |
| Overall | All OK | Partial failure | All failed |

---

## 2. Alert Types

### Critical Alerts (Immediate Action Required)
- **Failed Payouts**: Customer won but payout failed - must retry manually
- **High Exposure (>20k)**: Single number exposure exceeds safety limit
- **Settlement Failure**: Result processing failed

### Warning Alerts (Monitor Closely)
- **Payout Spike**: >50,000 THB paid out in 5 minutes
- **High Exposure (10-20k)**: Elevated exposure on number
- **Failed Deposits/Withdrawals**: Multiple failures today
- **Rapid Betting**: Single customer placing excessive bets

---

## 3. Daily Operations Schedule

### Morning (Before Betting Opens)
1. Check system health status
2. Verify all global controls enabled
3. Review overnight alerts
4. Confirm previous day settlements complete

### During Operations
1. Monitor live dashboard every 15-30 minutes
2. Acknowledge and investigate alerts
3. Watch exposure on hot numbers
4. Process deposit/withdrawal queues

### Evening (Before Results)
1. Review total exposure
2. Estimate payout liability
3. Ensure sufficient system resources
4. Confirm result entry staff ready

### After Results
1. Verify settlement completes
2. Check payout queue processing
3. Confirm no failed payouts
4. Review daily P&L

---

## 4. Emergency Procedures

### Disable All Betting
```
Master Control > betting_enabled > OFF
```

### Pause Settlements
```
Master Control > auto_payout_enabled > OFF
```

### Enter Maintenance Mode
```
Master Control > maintenance_mode > ON
```
Message: "ระบบกำลังปรับปรุง กรุณารอสักครู่"

### Rollback Incorrect Result
1. Go to `/results` page
2. Find the incorrect result
3. Click "Rollback" (requires confirmation)
4. Re-enter correct result

### Retry Failed Payout
1. Go to `/payout-agent` or `/payout-key`
2. Find failed payout entry
3. Click "Retry Payout"
4. Verify customer balance updated

---

## 5. Escalation Contacts

| Issue Type | Contact | When |
|------------|---------|------|
| System Down | Tech Lead | Immediately |
| Failed Payouts | Finance Lead | Within 30 min |
| Suspected Fraud | Security Team | Within 1 hour |
| Customer Complaint | Support Lead | As needed |

---

## 6. Monitoring Tools

### Primary Dashboard
- `/operations/live` - Real-time metrics

### Secondary Dashboards
- `/master-control` - Global controls and queues
- `/admin/monitoring` - API metrics and logs
- `/risk-control` - Number exposure limits

### External Monitoring
- Vercel Dashboard - Deployment status
- Supabase Dashboard - Database metrics
- Upstash Console - Redis metrics
