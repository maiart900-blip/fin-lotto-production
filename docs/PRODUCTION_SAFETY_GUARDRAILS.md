# Production Safety Guardrails

## Overview

This document describes the production safety mechanisms implemented to prevent financial errors, data corruption, and system failures during live operations.

---

## 1. Duplicate Payout Prevention

### Mechanism
- **Entry-level flag**: `payout_processed_at` timestamp on each entry
- **Result-level flag**: `is_processed` boolean on lottery_results
- **Processing lock**: `processing_started_at` timestamp prevents concurrent settlement

### Implementation
```typescript
// Before processing payout
if (entry.payout_processed_at) {
  // Skip - already paid
  return;
}

// After successful payout
await supabase.from('entries')
  .update({ payout_processed_at: new Date() })
  .eq('id', entry.id)
  .is('payout_processed_at', null); // Double-check
```

### Verification Query
```sql
-- Check for duplicate payouts (should return 0)
SELECT COUNT(*) FROM entries
WHERE payout_processed_at IS NOT NULL
GROUP BY customer_id, number, bet_type, lottery_id
HAVING COUNT(*) > 1;
```

---

## 2. Ledger Integrity

### Mechanism
- **Double-entry bookkeeping**: Every credit has a corresponding debit
- **Balance verification**: `check_ledger_balance()` function
- **Atomic transactions**: All ledger entries within single transaction

### Implementation
```typescript
// Create matching ledger entries
await supabase.from('ledger_entries').insert([
  { entry_type: 'debit', amount, account: 'house', ... },
  { entry_type: 'credit', amount, account: 'customer', ... },
]);
```

### Verification Query
```sql
-- Verify ledger balance (should return TRUE)
SELECT check_ledger_balance();

-- Manual check
SELECT 
  SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END) as total_credits
FROM ledger_entries;
```

---

## 3. Worker Lock System

### Mechanism
- **Distributed locks**: `worker_locks` table prevents concurrent worker runs
- **TTL-based expiration**: Locks automatically expire after timeout
- **Heartbeat updates**: Long-running workers extend their locks

### Implementation
```typescript
// Acquire lock
const locked = await acquireWorkerLock('settlement_worker', 'instance-1', 300);
if (!locked) {
  console.log('Another worker is running');
  return;
}

try {
  // Do work...
} finally {
  await releaseWorkerLock('settlement_worker', 'instance-1');
}
```

### Lock Types
| Worker Type | TTL | Purpose |
|-------------|-----|---------|
| settlement_worker | 5 min | Process lottery results |
| payout_worker | 3 min | Credit customer balances |
| reconciliation_worker | 10 min | Daily reconciliation |

---

## 4. Global Controls (Kill Switches)

### Available Controls
| Control | Purpose |
|---------|---------|
| betting_enabled | Enable/disable all betting |
| deposit_enabled | Enable/disable deposits |
| withdraw_enabled | Enable/disable withdrawals |
| registration_enabled | Enable/disable new registrations |
| auto_payout_enabled | Enable/disable automatic payouts |
| maintenance_mode | Full system maintenance |

### Emergency Disable
```bash
# Via API
curl -X POST /api/admin/master-control \
  -H "Content-Type: application/json" \
  -d '{"control_key": "betting_enabled", "is_enabled": false}'

# Via SQL (emergency)
UPDATE global_controls SET is_enabled = false WHERE control_key = 'betting_enabled';
```

---

## 5. Orphan Entry Prevention

### Mechanism
- **Required customer linkage**: Manual entries must have customer_id
- **Auto-create customer**: If customer_name provided, create customer record
- **Legacy flag**: Old orphans marked with `legacy_orphan = true`

### Validation
```typescript
// In /api/entries POST
if (!customer_id && !customer_name) {
  return { error: 'Customer required for payout tracking' };
}
```

---

## 6. Rate Limiting

### Limits
| Endpoint | Limit |
|----------|-------|
| /api/entries (betting) | 100 req/min per user |
| /api/customer/buy | 50 req/min per customer |
| /api/results/process | 10 req/min global |

---

## 7. Safety Verification API

### Endpoint
```
GET /api/safety/verify
```

### Response
```json
{
  "success": true,
  "results": [
    { "check": "duplicate_payouts", "status": "pass", "message": "No duplicates found" },
    { "check": "ledger_integrity", "status": "pass", "message": "Ledger balanced" },
    { "check": "orphan_entries", "status": "warning", "message": "51 legacy orphans (archived)" },
    { "check": "global_controls", "status": "pass", "message": "All controls operational" },
    { "check": "worker_locks", "status": "pass", "message": "No stale locks" }
  ],
  "summary": { "total_checks": 5, "passed": 4, "warnings": 1, "failed": 0 },
  "production_ready": true
}
```

---

## 8. Pre-Launch Checklist

Run before going live:

```bash
# 1. Run safety verification
curl http://localhost:3000/api/safety/verify | jq

# 2. Verify no duplicate payouts
curl http://localhost:3000/api/safety/verify -X POST -d '{"check_type":"duplicate_payouts"}'

# 3. Verify ledger integrity
curl http://localhost:3000/api/safety/verify -X POST -d '{"check_type":"ledger_integrity"}'

# 4. Verify global controls
curl http://localhost:3000/api/safety/verify -X POST -d '{"check_type":"global_controls"}'

# 5. Run load tests
./load-tests/run-scaling-tests.sh
```

---

## 9. Incident Response

### Duplicate Payout Detected
1. **IMMEDIATE**: Disable auto_payout_enabled
2. **INVESTIGATE**: Query duplicate entries
3. **REMEDIATE**: Reverse duplicate credits
4. **ROOT CAUSE**: Fix code path

### Ledger Imbalance Detected
1. **IMMEDIATE**: Disable all financial operations
2. **INVESTIGATE**: Find unbalanced entries
3. **REMEDIATE**: Create correcting entries
4. **AUDIT**: Full ledger reconciliation

### Worker Deadlock
1. **CHECK**: Query stale locks
2. **RELEASE**: Delete expired locks
3. **RESTART**: Resume workers

```sql
-- Clear stale locks (older than 1 hour)
DELETE FROM worker_locks WHERE expires_at < NOW() - INTERVAL '1 hour';
```

---

## 10. Monitoring Queries

### Daily Health Check
```sql
-- 1. Check for anomalies
SELECT 
  DATE(created_at) as date,
  COUNT(*) as entries,
  SUM(amount) as total_bet,
  COUNT(CASE WHEN status = 'won' THEN 1 END) as winners,
  SUM(payout_amount) as total_payout
FROM entries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 2. Customer balance integrity
SELECT 
  c.id, c.name, c.credit_balance,
  COALESCE(SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount ELSE -l.amount END), 0) as ledger_balance
FROM customers c
LEFT JOIN ledger_entries l ON l.customer_id = c.id
GROUP BY c.id, c.name, c.credit_balance
HAVING ABS(c.credit_balance - COALESCE(SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount ELSE -l.amount END), 0)) > 0.01;
```
