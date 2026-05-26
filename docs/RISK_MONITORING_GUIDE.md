# Risk Monitoring Guide

## Overview

This guide covers risk management and exposure monitoring for the lottery betting system.

---

## 1. Understanding Exposure

### What is Exposure?
Exposure is the total amount bet on a specific number that would need to be paid out if that number wins.

```
Exposure = Sum of bet amounts on number × Payout rate
```

### Example
```
Number 123 has:
- 10 bets of 100 THB each = 1,000 THB total
- 3 ตัวบน (3-top) payout rate = 900x

Potential Payout if 123 wins:
1,000 × 900 = 900,000 THB
```

---

## 2. Risk Thresholds

### Per-Number Limits

| Threshold | Action |
|-----------|--------|
| < 5,000 THB | Normal - no action |
| 5,000 - 10,000 THB | Monitor closely |
| 10,000 - 20,000 THB | Warning alert |
| > 20,000 THB | Critical - consider limiting |

### Per-Lottery Limits

| Threshold | Action |
|-----------|--------|
| < 50,000 THB | Normal |
| 50,000 - 100,000 THB | Elevated monitoring |
| > 100,000 THB | Executive notification |

### Daily Total Limits

| Threshold | Action |
|-----------|--------|
| < 200,000 THB | Normal |
| 200,000 - 500,000 THB | Enhanced monitoring |
| > 500,000 THB | Risk review required |

---

## 3. Monitoring Tools

### Live Operations Dashboard
- URL: `/operations/live`
- Shows: Top 10 risk numbers with exposure
- Refresh: Every 15 seconds

### Risk Control Page
- URL: `/risk-control`
- Shows: All numbers with current exposure
- Actions: Set limits, block numbers

### Number Exposure Report
- URL: `/reports/number-exposure`
- Shows: Historical exposure by number
- Filters: Date range, lottery type

---

## 4. Exposure Calculation Methods

### By Number
```sql
SELECT 
  number,
  SUM(amount) as total_bet,
  COUNT(*) as bet_count
FROM entries
WHERE lottery_id = '<lottery_id>'
  AND status IN ('pending', 'confirmed', 'active')
  AND (legacy_orphan IS NULL OR legacy_orphan = false)
GROUP BY number
ORDER BY total_bet DESC;
```

### By Bet Type
```sql
SELECT 
  bet_type,
  SUM(amount) as total_bet
FROM entries
WHERE lottery_id = '<lottery_id>'
  AND status IN ('pending', 'confirmed', 'active')
GROUP BY bet_type;
```

### By Customer
```sql
SELECT 
  customer_id,
  SUM(amount) as total_bet,
  COUNT(DISTINCT number) as unique_numbers
FROM entries
WHERE lottery_id = '<lottery_id>'
  AND status IN ('pending', 'confirmed', 'active')
GROUP BY customer_id
ORDER BY total_bet DESC;
```

---

## 5. Risk Mitigation Strategies

### Strategy 1: Number Limits
Set maximum bet amount per number:
```
1. Go to /risk-control
2. Select lottery
3. Find high-exposure number
4. Click "Set Limit"
5. Enter max_bet_amount
6. Save
```

### Strategy 2: Block Hot Numbers
Completely block betting on specific number:
```
1. Go to /number-control
2. Select lottery
3. Add number to blocked list
4. Save
```

### Strategy 3: Customer Limits
Limit betting per customer:
```
1. Go to customer profile
2. Set max_bet_per_round
3. Set max_total_bet_per_day
```

### Strategy 4: Early Cutoff
Close betting early when exposure is high:
```
1. Go to /lottery-management
2. Select lottery
3. Click "Close Betting"
```

---

## 6. Payout Rate Reference

### Standard Thai Lottery Rates

| Bet Type | Rate | Description |
|----------|------|-------------|
| 3 ตัวบน | 900x | 3-digit top |
| 3 ตัวโต๊ด | 150x | 3-digit any order |
| 2 ตัวบน | 90x | 2-digit top |
| 2 ตัวล่าง | 90x | 2-digit bottom |
| วิ่งบน | 3.2x | Run top |
| วิ่งล่าง | 4.2x | Run bottom |

### Exposure Calculation by Type
```
3 ตัวบน: bet × 900
3 ตัวโต๊ด: bet × 150
2 ตัวบน: bet × 90
2 ตัวล่าง: bet × 90
วิ่งบน: bet × 3.2
วิ่งล่าง: bet × 4.2
```

---

## 7. Suspicious Patterns

### Red Flags to Watch

1. **Concentrated Betting**
   - Single customer betting large amounts on few numbers
   - Multiple accounts betting same numbers

2. **Late Betting**
   - Large bets placed close to result time
   - Betting pattern changes after certain time

3. **Win Rate Anomalies**
   - Customer with abnormally high win rate
   - Same numbers winning repeatedly

4. **Agent Patterns**
   - Agent's customers always betting same numbers
   - Agent reporting inconsistent entries

### Investigation Checklist
- [ ] Check customer betting history
- [ ] Check agent relationship
- [ ] Check timing of bets
- [ ] Check IP/device patterns
- [ ] Check cross-reference with other accounts

---

## 8. Daily Risk Review

### Morning Review
1. Check overnight exposure accumulation
2. Review any overnight alerts
3. Identify hot numbers from previous period

### Pre-Result Review
1. Export top 20 exposure numbers
2. Calculate worst-case payout
3. Compare to payout reserve
4. Flag any >20k exposure numbers

### Post-Result Review
1. Analyze actual winners vs exposure
2. Calculate hit rate on hot numbers
3. Update risk models if needed

---

## 9. Reporting

### Daily Risk Report
```
Date: ___________
Lottery: ___________

Top 5 Exposure Numbers:
1. _____ = _____ THB
2. _____ = _____ THB
3. _____ = _____ THB
4. _____ = _____ THB
5. _____ = _____ THB

Total Exposure: _____ THB
Estimated Max Payout: _____ THB
Actual Payout: _____ THB

Risk Actions Taken:
- ___________
- ___________
```

### Weekly Risk Summary
- Total volume by lottery type
- Win/loss ratio
- Exposure trends
- Suspicious activity flagged
- Risk limit changes made
